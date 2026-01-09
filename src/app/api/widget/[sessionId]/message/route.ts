/**
 * Widget Message API
 *
 * POST /api/widget/[sessionId]/message - Send a message in the chat session
 *
 * Supports two content types:
 * - application/json: Text messages with optional attachments
 * - multipart/form-data: Voice messages (audio file + duration)
 *
 * This endpoint returns a streaming SSE response with real-time events:
 * - ack: Message received (includes audioUrl/transcript for voice messages)
 * - thinking: Agent is processing
 * - tool_call: Agent is executing a tool
 * - notification: Agent transfer notification
 * - delta: Incremental content updates
 * - complete: Final message with metadata
 * - done: Message saved
 * - error: Error occurred
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema/conversations";
import { eq } from "drizzle-orm";
import { getAgentRunner } from "@/lib/ai";
import { withRateLimit } from "@/lib/redis/rate-limit";
import {
  getWidgetSessionCache,
  setWidgetSessionCache,
  type CachedWidgetSession,
} from "@/lib/redis/cache";
import { uploadConversationFile } from "@/lib/supabase/client";
import type { SendMessageRequest } from "@/lib/widget/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Maximum audio file size (10MB)
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

// Allowed audio MIME type prefixes (supports codec parameters like "audio/webm;codecs=opus")
const ALLOWED_AUDIO_TYPE_PREFIXES = [
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/m4a",
  "audio/mp4",
];

/**
 * Check if MIME type is allowed (supports codec parameters)
 */
function isAllowedAudioType(mimeType: string): boolean {
  const baseMimeType = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_AUDIO_TYPE_PREFIXES.some(
    (allowed) => baseMimeType === allowed.toLowerCase()
  );
}

interface RouteParams {
  sessionId: string;
}

/**
 * Format an event as SSE
 */
function formatSSE(eventType: string, data: unknown): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Simple timing tracker for streaming responses
 * AsyncLocalStorage doesn't propagate into ReadableStream callbacks,
 * so we use explicit timing tracking instead
 */
interface StreamingTiming {
  requestId: string;
  sessionId: string;
  startTime: number;
  spans: Array<{ name: string; category: string; startTime: number; endTime?: number; durationMs?: number; metadata?: Record<string, unknown> }>;
}

function createStreamingTiming(requestId: string, sessionId: string): StreamingTiming {
  return {
    requestId,
    sessionId,
    startTime: performance.now(),
    spans: [],
  };
}

function addTimingSpan(timing: StreamingTiming, name: string, category: string, metadata?: Record<string, unknown>) {
  const span = { name, category, startTime: performance.now(), metadata };
  timing.spans.push(span);
  return {
    end: (endMetadata?: Record<string, unknown>) => {
      span.endTime = performance.now();
      span.durationMs = span.endTime - span.startTime;
      if (endMetadata) span.metadata = { ...span.metadata, ...endMetadata };
    },
  };
}

function printStreamingTimingReport(timing: StreamingTiming) {
  if (process.env.ENABLE_PROFILER !== "true") return;

  const totalDuration = performance.now() - timing.startTime;
  const width = 66;
  const divider = "═".repeat(width);
  const thinDivider = "─".repeat(width);

  const lines: string[] = [
    "",
    divider,
    "              STREAMING PERFORMANCE REPORT",
    divider,
    `Request ID: ${timing.requestId}`,
    `Session: ${timing.sessionId}`,
    `Total Duration: ${totalDuration.toFixed(2)}ms`,
    thinDivider,
    "                    OPERATION BREAKDOWN",
    thinDivider,
  ];

  // Sort by duration descending
  const sortedSpans = [...timing.spans]
    .filter(s => s.durationMs !== undefined)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));

  for (const span of sortedSpans) {
    const name = span.name.padEnd(30);
    const ms = (span.durationMs ?? 0).toFixed(2).padStart(10);
    const pct = ((span.durationMs ?? 0) / totalDuration * 100).toFixed(1).padStart(5);
    lines.push(`${name} ${ms}ms (${pct}%)`);
  }

  lines.push(divider);
  lines.push("");

  console.log(lines.join("\n"));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sessionId } = await params;
  const requestId = crypto.randomUUID();

  // Create timing tracker for streaming (passes through to ReadableStream callback)
  const timing = createStreamingTiming(requestId, sessionId);

  // Rate limiting: 60 requests per minute per session
  const rateLimitSpan = addTimingSpan(timing, "rate_limit", "request");
  const rateLimitResult = await withRateLimit(request, "widget", sessionId);
  rateLimitSpan.end();
  if (rateLimitResult) {
    printStreamingTimingReport(timing);
    return rateLimitResult;
  }

  // Get conversation (from Redis cache or DB) - single query instead of 2
  const conversationSpan = addTimingSpan(timing, "db_get_conversation", "db");
  const conversation = await getConversationForSession(sessionId);
  conversationSpan.end({ found: !!conversation });
  if (!conversation) {
    printStreamingTimingReport(timing);
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  const conversationId = conversation.id;

  // Check if conversation is still active
  if (conversation.status === "resolved" || conversation.status === "abandoned") {
    printStreamingTimingReport(timing);
    return NextResponse.json(
      { error: "Conversation is no longer active" },
      { status: 400 }
    );
  }

  // Determine content type and parse accordingly
  const contentType = request.headers.get("content-type") ?? "";
  const isFormData = contentType.includes("multipart/form-data");

  let messageContent: string;
  let messageType: "text" | "audio" = "text";
  let messageAttachments: Array<Record<string, unknown>> = [];
  let voiceData: {
    audioUrl: string;
    storagePath: string;
    transcript: string;
    duration: number;
    mimeType: string;
  } | null = null;

  if (isFormData) {
    // Handle voice message (multipart/form-data)
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const duration = parseInt(formData.get("duration") as string) || 0;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Validate audio file (supports codec parameters like "audio/webm;codecs=opus")
    if (!isAllowedAudioType(audioFile.type)) {
      return NextResponse.json(
        { error: `Invalid audio format. Allowed: ${ALLOWED_AUDIO_TYPE_PREFIXES.join(", ")}` },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "Audio file too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate message ID early for file naming
    const messageId = crypto.randomUUID();
    const fileExtension = audioFile.name.split(".").pop() || "webm";
    const fileName = `${messageId}.${fileExtension}`;

    // Upload audio to Supabase storage
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const uploadSpan = addTimingSpan(timing, "voice_upload", "storage", { size: audioFile.size });
    const { storagePath, signedUrl } = await uploadConversationFile(
      conversation.companyId,
      conversationId,
      fileName,
      audioBuffer,
      audioFile.type
    );
    uploadSpan.end();

    // Transcribe audio using OpenAI Whisper
    const transcribeSpan = addTimingSpan(timing, "voice_transcription", "llm", {
      audioSize: audioFile.size,
      mimeType: audioFile.type,
    });
    const transcribeFile = new File([audioBuffer], audioFile.name, { type: audioFile.type });
    const transcription = await openai.audio.transcriptions.create({
      file: transcribeFile,
      model: "whisper-1",
      response_format: "text",
    });
    transcribeSpan.end();

    const transcript = typeof transcription === "string"
      ? transcription.trim()
      : transcription;

    messageContent = transcript;
    messageType = "audio";
    voiceData = {
      audioUrl: signedUrl,
      storagePath,
      transcript,
      duration,
      mimeType: audioFile.type,
    };
    messageAttachments = [
      {
        type: "audio",
        mimeType: audioFile.type,
        storagePath,
        duration,
        transcript,
      },
    ];
  } else {
    // Handle text message (application/json)
    let body: SendMessageRequest;
    try {
      body = (await request.json()) as SendMessageRequest;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    messageContent = body.content;
    messageAttachments = (body.attachments as Array<Record<string, unknown>>) ?? [];
  }

  // Save user message
  const [userMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      type: messageType,
      content: messageContent,
      attachments: messageAttachments,
    })
    .returning();

  if (!userMessage) {
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }

  // NOTE: Stats update is batched at the end of the request (after assistant message)

  // Create streaming response
  const encoder = new TextEncoder();
  const origin = request.headers.get("origin");

  // Track if controller is closed (set by cancel callback or close call)
  let controllerClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Safe enqueue that handles client disconnection
      const safeEnqueue = (data: Uint8Array) => {
        if (controllerClosed) return false;
        try {
          controller.enqueue(data);
          return true;
        } catch {
          controllerClosed = true;
          return false;
        }
      };

      const aiProcessingSpan = addTimingSpan(timing, "ai_agent_streaming", "llm");
      let fullContent = "";
      let metadata: Record<string, unknown> = {};

      try {
        // Build ack event data
        const ackData: Record<string, unknown> = {
          messageId: userMessage.id,
          conversationId,
          timestamp: userMessage.createdAt.toISOString(),
        };

        // Add voice-specific data to ack
        if (voiceData) {
          ackData.audioUrl = voiceData.audioUrl;
          ackData.transcript = voiceData.transcript;
          ackData.duration = voiceData.duration;
        }

        // Send acknowledgment with user message ID
        safeEnqueue(encoder.encode(formatSSE("ack", ackData)));

        // Run AI agent with streaming (using transcribed text for voice messages)
        const runner = getAgentRunner();

        for await (const event of runner.sendMessageStream({
          conversationId,
          message: messageContent,
        })) {
          // Stream each event to the client (continue processing even if client disconnected)
          safeEnqueue(encoder.encode(formatSSE(event.type, event.data)));

          // Capture content for final message
          if (event.type === "delta") {
            fullContent += (event.data as { content: string }).content;
          } else if (event.type === "complete") {
            const completeData = event.data as {
              content: string;
              metadata?: Record<string, unknown>;
            };
            fullContent = completeData.content;
            metadata = completeData.metadata ?? {};
          }
        }
        aiProcessingSpan.end({ contentLength: fullContent.length });

        // Save assistant message to database (always do this even if client disconnected)
        if (fullContent) {
          const dbSaveSpan = addTimingSpan(timing, "db_save_assistant_message", "db");
          const tokensUsed = metadata.tokensUsed as
            | { totalTokens?: number }
            | undefined;
          const tokenCount = tokensUsed?.totalTokens;
          const processingTimeMs = metadata.processingTimeMs
            ? Math.round(metadata.processingTimeMs as number)
            : undefined;
          const sources = metadata.sources as Array<{ id: string }> | undefined;
          const sourceIds = sources?.map((s) => s.id) ?? [];

          const [assistantMessage] = await db
            .insert(messages)
            .values({
              conversationId,
              role: "assistant",
              type: "text",
              content: fullContent,
              tokenCount,
              processingTimeMs,
              sourceChunkIds: sourceIds,
              toolCalls: [],
              toolResults: [],
            })
            .returning();

          // Batched stats update: +2 messages (user + assistant) in single query
          await db
            .update(conversations)
            .set({
              messageCount: conversation.messageCount + 2,
              userMessageCount: conversation.userMessageCount + 1,
              assistantMessageCount: conversation.assistantMessageCount + 1,
              lastMessageAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));
          dbSaveSpan.end();

          // Send final done event with message ID
          safeEnqueue(
            encoder.encode(
              formatSSE("done", {
                messageId: assistantMessage?.id,
                content: fullContent,
                sourceChunkIds: sourceIds,
              })
            )
          );
        }

        // Print timing report at the end of streaming
        printStreamingTimingReport(timing);
        if (!controllerClosed) {
          controllerClosed = true;
          controller.close();
        }
      } catch (error) {
        aiProcessingSpan.end({ error: true });
        console.error("Widget message streaming error:", error);
        printStreamingTimingReport(timing);
        safeEnqueue(
          encoder.encode(
            formatSSE("error", {
              code: "PROCESSING_ERROR",
              message: "Failed to process message",
              retryable: true,
            })
          )
        );
        if (!controllerClosed) {
          controllerClosed = true;
          controller.close();
        }
      }
    },
    cancel() {
      // Client disconnected - mark controller as closed
      controllerClosed = true;
    },
  });

  // Return streaming response with SSE headers
  const headers: HeadersInit = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return new Response(stream, { headers });
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  const response = new NextResponse(null, { status: 204 });
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

// ============================================================================
// Helper Functions
// ============================================================================

type ConversationRecord = typeof conversations.$inferSelect;

/**
 * Get conversation for session with Redis caching
 *
 * Flow:
 * 1. Check Redis cache for session data
 * 2. If cache hit AND conversation is active, query full conversation by ID
 * 3. If cache miss, query by sessionId and cache the result
 *
 * This reduces DB calls from 2 (validateSession + getConversation) to 1 on cache hit
 */
async function getConversationForSession(
  sessionId: string
): Promise<ConversationRecord | null> {
  // Try Redis cache first
  const cached = await getWidgetSessionCache(sessionId);

  if (cached) {
    // Cache hit - but still need full conversation data for the request
    // Only use cache for quick status check
    if (cached.status === "resolved" || cached.status === "abandoned") {
      return null; // Conversation is closed, no need to query
    }

    // Get full conversation by ID (faster than by sessionId)
    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, cached.conversationId))
      .limit(1);

    return result[0] ?? null;
  }

  // Cache miss - query by sessionId
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .limit(1);

  if (result.length > 0 && result[0]) {
    const conv = result[0];

    // Cache the session mapping for future requests
    const cacheData: CachedWidgetSession = {
      conversationId: conv.id,
      chatbotId: conv.chatbotId,
      companyId: conv.companyId,
      status: conv.status,
    };

    // Fire and forget - don't await cache set
    setWidgetSessionCache(sessionId, cacheData).catch((err) => {
      console.error("Failed to cache widget session:", err);
    });

    return conv;
  }

  return null;
}
