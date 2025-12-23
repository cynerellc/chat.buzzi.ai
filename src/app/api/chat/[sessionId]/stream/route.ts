/**
 * Chat Stream API
 *
 * POST /api/chat/[sessionId]/stream - Send a message with streaming response
 *
 * Returns Server-Sent Events (SSE) with the following event types:
 * - thinking: Processing status updates
 * - tool_call: Tool execution status
 * - delta: Incremental response content
 * - complete: Final response with metadata
 * - error: Error notifications
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAgentRunner } from "@/lib/ai";

// ============================================================================
// Request Validation
// ============================================================================

const streamMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(10000, "Message too long"),
  attachments: z
    .array(
      z.object({
        type: z.enum(["image", "file", "audio"]),
        url: z.string().url(),
        mimeType: z.string(),
        fileName: z.string().optional(),
      })
    )
    .optional(),
});

// ============================================================================
// POST - Stream Message Response
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Validate session ID
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(
      JSON.stringify({ error: "Invalid session ID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate request body
  const validation = streamMessageSchema.safeParse(body);
  if (!validation.success) {
    return new Response(
      JSON.stringify({
        error: "Validation error",
        details: validation.error.issues,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const data = validation.data;

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to write SSE events
  const writeEvent = async (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  // Process message in background
  (async () => {
    try {
      const runner = getAgentRunner();

      // Stream the response
      for await (const event of runner.sendMessageStream({
        conversationId: sessionId,
        message: data.message,
        attachments: data.attachments,
      })) {
        await writeEvent(event.type, event.data);
      }
    } catch (error) {
      console.error("Stream error:", error);
      await writeEvent("error", {
        code: "STREAM_ERROR",
        message: "An error occurred while streaming the response",
        retryable: true,
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ============================================================================
// GET - SSE Connection for Ongoing Stream
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Validate session ID
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(
      JSON.stringify({ error: "Invalid session ID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Create a keep-alive stream for listening to events
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Send initial connection event
  const connectionEvent = `event: connected\ndata: ${JSON.stringify({ sessionId, timestamp: Date.now() })}\n\n`;
  await writer.write(encoder.encode(connectionEvent));

  // Keep connection alive with periodic heartbeats
  const heartbeatInterval = setInterval(async () => {
    try {
      const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`;
      await writer.write(encoder.encode(heartbeat));
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 30000); // Every 30 seconds

  // Clean up on client disconnect
  request.signal.addEventListener("abort", () => {
    clearInterval(heartbeatInterval);
    writer.close();
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
