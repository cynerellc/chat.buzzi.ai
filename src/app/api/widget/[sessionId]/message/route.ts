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
import { uploadConversationFile, broadcastMessage } from "@/lib/supabase/client";
import type { SendMessageRequest } from "@/lib/widget/types";
import { createEscalation } from "@/lib/escalation/escalation-service";

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

// Whisper verbose_json response types for silence detection
interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  no_speech_prob: number;
  avg_logprob: number;
}

interface WhisperVerboseResponse {
  text: string;
  segments: WhisperSegment[];
}

/**
 * Known Whisper hallucination patterns on silent/noise audio
 * These are common outputs when there's no real speech
 */
const HALLUCINATION_PATTERNS = [
  /^[\s\.,!?…]+$/,                    // Only punctuation/whitespace
  /^(bye\.?\s*)+$/i,                  // "Bye. Bye." variations
  /^(hey\.?\s*)+$/i,                  // "Hey. Hey." variations
  /^(this way\.?\s*)+$/i,             // "This way." variations
  /^(thank(s| you).*watch)/i,         // "Thanks for watching"
  /^(see you|goodbye|later)\.?$/i,    // Sign-off phrases
  /^(eat|food|way|go)\.?\s*$/i,       // Random single words
  /^\.+$/,                            // Just periods
  /^\s*$/,                            // Empty/whitespace only
];

/**
 * Check if Whisper transcription is likely a hallucination from silent/noise audio
 * Uses multiple detection layers for robust filtering
 */
function isLikelySilentAudio(response: WhisperVerboseResponse): boolean {
  // Layer 0: No segments or empty response
  if (!response.segments || response.segments.length === 0) {
    return true;
  }

  const text = response.text?.trim() || "";

  // Layer 1: Empty or very short text (< 3 meaningful chars)
  if (text.length < 3) {
    return true;
  }

  // Layer 2: Known hallucination patterns
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(text))) {
    console.log(`[Whisper] Hallucination pattern detected: "${text}"`);
    return true;
  }

  // Layer 3: Transcript quality heuristics (Unicode-aware)
  // Use Unicode property escapes: \p{L} = any letter (Latin, CJK, Arabic, etc.), \p{N} = any number
  // This properly handles non-English scripts like Chinese, Japanese, Korean, Arabic, Hebrew, etc.
  const contentChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;

  // If too few actual content characters (letters/numbers in any script), likely garbage
  if (contentChars < 3 && text.length < 20) {
    console.log(
      `[Whisper] Too few content characters (${contentChars}): "${text}"`
    );
    return true;
  }

  // Layer 4: Segment-based analysis with relaxed thresholds for non-English support
  // Note: Whisper's confidence metrics are calibrated on English data, so non-English
  // languages may have higher uncertainty even for valid speech
  let silentSegmentCount = 0;
  let totalNoSpeechProb = 0;

  for (const seg of response.segments) {
    totalNoSpeechProb += seg.no_speech_prob;

    // Count as silent if EITHER condition is met (thresholds relaxed for non-English)
    const highNoSpeechProb = seg.no_speech_prob > 0.75;  // Was 0.6
    const lowConfidence = seg.avg_logprob < -1.0;        // Was -0.8

    if (highNoSpeechProb || lowConfidence) {
      silentSegmentCount++;
    }
  }

  const avgNoSpeechProb = totalNoSpeechProb / response.segments.length;
  const silentRatio = silentSegmentCount / response.segments.length;

  // Log for debugging
  console.log(
    `[Whisper] Analysis: text="${text}", avgNoSpeechProb=${avgNoSpeechProb.toFixed(3)}, silentRatio=${silentRatio.toFixed(2)}`
  );

  // Silent if: very high average no_speech_prob OR most segments flagged
  if (avgNoSpeechProb > 0.65) {  // Was 0.5
    console.log(`[Whisper] High avg no_speech_prob: ${avgNoSpeechProb.toFixed(3)}`);
    return true;
  }

  if (silentRatio > 0.6) {  // Was 0.5
    console.log(`[Whisper] High silent segment ratio: ${silentRatio.toFixed(2)}`);
    return true;
  }

  // Layer 5: Very short transcript + elevated no_speech_prob (stricter on length, more lenient on prob)
  if (text.length < 10 && avgNoSpeechProb > 0.5) {  // Was length < 15, prob > 0.3
    console.log(`[Whisper] Short text with elevated no_speech_prob`);
    return true;
  }

  return false;
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
  const span: StreamingTiming["spans"][number] = { name, category, startTime: performance.now(), metadata };
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

  // Check if conversation is being handled by a human or waiting for human
  const isHumanHandling = conversation.status === "waiting_human" || conversation.status === "with_human";

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

    // Pre-Whisper silence detection using file size heuristics
    // This saves API costs by rejecting obviously silent audio before transcription
    const silenceCheckOrigin = request.headers.get("origin");

    // Check 1: Minimum duration (reject very short recordings)
    if (duration < 1) {
      console.log(`[Whisper] Pre-check: Recording too short (${duration}s)`);
      const errorEncoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            errorEncoder.encode(
              formatSSE("error", {
                message: "Recording too short. Please hold the button longer and speak clearly.",
                code: "RECORDING_TOO_SHORT",
              })
            )
          );
          controller.close();
        },
      });
      return new Response(errorStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...(silenceCheckOrigin && { "Access-Control-Allow-Origin": silenceCheckOrigin }),
        },
      });
    }

    // Check 2: Bytes-per-second heuristic for silence detection
    // Silent audio compresses extremely well in webm/opus format
    // Speech: typically > 3KB/s, Silent: typically < 1KB/s
    // Note: Non-English languages may compress differently, so we use a more lenient threshold
    const bytesPerSecond = audioFile.size / duration;
    if (bytesPerSecond < 1000 && duration >= 3) {
      console.log(
        `[Whisper] Pre-check: Likely silent audio (${bytesPerSecond.toFixed(0)} bytes/s for ${duration}s)`
      );
      const errorEncoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            errorEncoder.encode(
              formatSSE("error", {
                message: "I couldn't detect any speech in your recording. Please speak clearly into the microphone.",
                code: "SILENT_AUDIO",
              })
            )
          );
          controller.close();
        },
      });
      return new Response(errorStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...(silenceCheckOrigin && { "Access-Control-Allow-Origin": silenceCheckOrigin }),
        },
      });
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

    // Transcribe audio using OpenAI Whisper with verbose_json for silence detection
    const transcribeSpan = addTimingSpan(timing, "voice_transcription", "llm", {
      audioSize: audioFile.size,
      mimeType: audioFile.type,
    });
    const transcribeFile = new File([audioBuffer], audioFile.name, { type: audioFile.type });
    const transcription = await openai.audio.transcriptions.create({
      file: transcribeFile,
      model: "whisper-1",
      response_format: "verbose_json",
    });
    transcribeSpan.end();

    // Cast to verbose response type for silence detection
    const verboseResponse = transcription as unknown as WhisperVerboseResponse;

    // Check for silence/noise (prevents Whisper hallucinations like "Thanks for watching")
    if (isLikelySilentAudio(verboseResponse)) {
      // Return SSE error stream without saving message to DB
      const silentOrigin = request.headers.get("origin");
      const errorEncoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            errorEncoder.encode(
              formatSSE("error", {
                message: "I couldn't hear anything in your voice message. Please hold the microphone button and speak clearly.",
                code: "SILENT_AUDIO",
              })
            )
          );
          controller.close();
        },
      });

      return new Response(errorStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...(silentOrigin && { "Access-Control-Allow-Origin": silentOrigin }),
        },
      });
    }

    // Extract transcript from verbose response
    const transcript = verboseResponse.text?.trim() || "";

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

  // Broadcast user message to admin pages via Supabase Realtime
  try {
    await broadcastMessage(conversationId, {
      id: userMessage.id,
      conversationId,
      role: "user",
      content: messageContent,
      createdAt: userMessage.createdAt.toISOString(),
    });
  } catch (broadcastError) {
    console.warn("Failed to broadcast user message:", broadcastError);
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
      let escalationTriggered = false;
      let escalationData: { reason?: string; urgency?: string; initiatingAgentId?: string; initiatingAgentName?: string } = {};

      // Track agent info during streaming for agentDetails
      let lastAgentId: string | null = null;
      let lastAgentName: string | null = null;

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

        // Check if human is handling - skip AI processing
        if (isHumanHandling) {
          const statusMessage = conversation.status === "waiting_human"
            ? "Please wait, a support agent will be with you shortly."
            : "A support agent is handling your request.";

          safeEnqueue(encoder.encode(formatSSE("human_handling", {
            status: conversation.status,
            message: statusMessage,
          })));

          // Update conversation message counts (user message was sent)
          await db
            .update(conversations)
            .set({
              messageCount: conversation.messageCount + 1,
              userMessageCount: conversation.userMessageCount + 1,
              lastMessageAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

          aiProcessingSpan.end({ skipped: true, reason: "human_handling" });
          printStreamingTimingReport(timing);
          if (!controllerClosed) {
            controllerClosed = true;
            controller.close();
          }
          return;
        }

        // Run AI agent with streaming (using transcribed text for voice messages)
        const runner = getAgentRunner();

        for await (const event of runner.sendMessageStream({
          conversationId,
          message: messageContent,
        })) {
          // Check for human_escalation event from AI
          if (event.type === "human_escalation") {
            escalationTriggered = true;
            escalationData = event.data as typeof escalationData;

            // Create escalation record IMMEDIATELY before sending SSE event
            // This ensures conversation status is "waiting_human" before widget shows the waiting bubble
            try {
              const { escalationId } = await createEscalation({
                conversationId,
                reason: escalationData.reason || "Customer requested human assistance",
                triggerType: "explicit_request",
                priority: escalationData.urgency === "high" ? "high" : "medium",
                metadata: {
                  initiatingAgentId: escalationData.initiatingAgentId,
                  initiatingAgentName: escalationData.initiatingAgentName,
                },
              });

              // Update cache with new status
              try {
                const cacheData: CachedWidgetSession = {
                  conversationId,
                  chatbotId: conversation.chatbotId,
                  companyId: conversation.companyId,
                  status: "waiting_human",
                };
                setWidgetSessionCache(sessionId, cacheData).catch(() => {});
              } catch {
                // Cache update is best-effort
              }

              // Forward the event to client (now that DB is updated)
              safeEnqueue(encoder.encode(formatSSE("human_escalation", {
                ...event.data,
                escalationId,
              })));
            } catch (escalationError) {
              console.error("Failed to create escalation:", escalationError);
              // Still send the event but without escalationId
              safeEnqueue(encoder.encode(formatSSE("human_escalation", event.data)));
            }

            // Don't continue processing - escalation breaks the loop
            break;
          }

          // Stream each event to the client (continue processing even if client disconnected)
          safeEnqueue(encoder.encode(formatSSE(event.type, event.data)));

          // Capture agent info from notification events
          if (event.type === "notification") {
            const notificationData = event.data as { targetAgentId?: string; targetAgentName?: string };
            if (notificationData.targetAgentId) {
              lastAgentId = notificationData.targetAgentId;
              lastAgentName = notificationData.targetAgentName || null;
            }
          }

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
            // Also capture agent info from metadata if available
            if (metadata.agentId && !lastAgentId) {
              lastAgentId = metadata.agentId as string;
              lastAgentName = (metadata.agentName as string) || null;
            }
          }
        }
        aiProcessingSpan.end({ contentLength: fullContent.length, escalationTriggered });

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
              agentDetails: {
                agentId: lastAgentId || "main",
                agentType: "ai",
                agentName: lastAgentName || "AI Assistant",
              },
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

        // Note: Escalation is now created immediately when human_escalation event is detected
        // (see the for-await loop above) to avoid race conditions with the Cancel button

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
