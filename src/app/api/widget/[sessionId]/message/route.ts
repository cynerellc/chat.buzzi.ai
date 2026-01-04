/**
 * Widget Message API
 *
 * POST /api/widget/[sessionId]/message - Send a message in the chat session
 *
 * This endpoint returns a streaming SSE response with real-time events:
 * - thinking: Agent is processing
 * - tool_call: Agent is executing a tool
 * - notification: Agent transfer notification
 * - delta: Incremental content updates
 * - complete: Final message with metadata
 * - error: Error occurred
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema/conversations";
import { eq } from "drizzle-orm";
import { getAgentRunner } from "@/lib/ai";
import { withRateLimit } from "@/lib/redis/rate-limit";
import type { SendMessageRequest } from "@/lib/widget/types";

interface RouteParams {
  sessionId: string;
}

/**
 * Format an event as SSE
 */
function formatSSE(eventType: string, data: unknown): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sessionId } = await params;

  // Rate limiting: 60 requests per minute per session
  const rateLimitResult = await withRateLimit(request, "widget", sessionId);
  if (rateLimitResult) return rateLimitResult;

  let body: SendMessageRequest;
  try {
    body = (await request.json()) as SendMessageRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { content, attachments } = body;

  // Validate session and get conversation
  const conversationId = await validateSession(sessionId);
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  // Get conversation details
  const conversationResult = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (conversationResult.length === 0 || !conversationResult[0]) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const conversation = conversationResult[0];

  // Check if conversation is still active
  if (conversation.status === "resolved" || conversation.status === "abandoned") {
    return NextResponse.json(
      { error: "Conversation is no longer active" },
      { status: 400 }
    );
  }

  // Save user message
  const [userMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      type: "text",
      content,
      attachments: attachments ?? [],
    })
    .returning();

  if (!userMessage) {
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }

  // Update conversation stats for user message
  await db
    .update(conversations)
    .set({
      messageCount: conversation.messageCount + 1,
      userMessageCount: conversation.userMessageCount + 1,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));

  // Create streaming response
  const encoder = new TextEncoder();
  const origin = request.headers.get("origin");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send acknowledgment with user message ID
        controller.enqueue(
          encoder.encode(
            formatSSE("ack", {
              messageId: userMessage.id,
              conversationId,
              timestamp: userMessage.createdAt.toISOString(),
            })
          )
        );

        // Run AI agent with streaming
        const runner = getAgentRunner();
        let fullContent = "";
        let metadata: Record<string, unknown> = {};

        for await (const event of runner.sendMessageStream({
          conversationId,
          message: content,
        })) {
          // Stream each event to the client
          controller.enqueue(encoder.encode(formatSSE(event.type, event.data)));

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

        // Save assistant message to database
        if (fullContent) {
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

          // Update conversation stats for assistant message
          const updatedConversation = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

          if (updatedConversation.length > 0 && updatedConversation[0]) {
            await db
              .update(conversations)
              .set({
                messageCount: updatedConversation[0].messageCount + 1,
                assistantMessageCount:
                  updatedConversation[0].assistantMessageCount + 1,
                lastMessageAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(conversations.id, conversationId));
          }

          // Send final done event with message ID
          controller.enqueue(
            encoder.encode(
              formatSSE("done", {
                messageId: assistantMessage?.id,
                content: fullContent,
                sourceChunkIds: sourceIds,
              })
            )
          );
        }

        controller.close();
      } catch (error) {
        console.error("Widget message streaming error:", error);
        controller.enqueue(
          encoder.encode(
            formatSSE("error", {
              code: "PROCESSING_ERROR",
              message: "Failed to process message",
              retryable: true,
            })
          )
        );
        controller.close();
      }
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

async function validateSession(sessionId: string): Promise<string | null> {
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .limit(1);

  if (result.length > 0 && result[0]) {
    return result[0].id;
  }

  return null;
}
