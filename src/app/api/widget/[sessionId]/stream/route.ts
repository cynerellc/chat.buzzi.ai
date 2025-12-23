/**
 * Widget SSE Stream API
 *
 * GET /api/widget/[sessionId]/stream - Server-Sent Events stream for real-time updates
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema/conversations";
import { eq } from "drizzle-orm";
import {
  getSSEManager,
  getConversationChannel,
  type SSEEvent,
} from "@/lib/realtime";

interface RouteParams {
  sessionId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { sessionId } = await params;

  // Validate session and get conversation
  const conversationId = await validateSession(sessionId);
  if (!conversationId) {
    return new Response("Invalid or expired session", { status: 401 });
  }

  // Create SSE response stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Get SSE manager and subscribe to conversation channel
      const sseManager = getSSEManager();
      const channel = getConversationChannel(conversationId);

      // Subscribe to events
      const subscription = sseManager.subscribe(
        channel,
        (event: SSEEvent) => {
          try {
            const sseEvent = formatSSEEvent(event.type, event.data);
            controller.enqueue(encoder.encode(sseEvent));
          } catch {
            // Stream closed
          }
        }
      );

      // Send initial connected event
      const connectedEvent = formatSSEEvent("connected", {
        conversationId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(connectedEvent));

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        subscription.unsubscribe();
        controller.close();
      });

      // Start heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = formatSSEEvent("heartbeat", {
            timestamp: new Date().toISOString(),
          });
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          // Stream closed
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
      });
    },
  });

  // Return SSE response with appropriate headers
  const origin = request.headers.get("origin");
  const headers: HeadersInit = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
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

  const response = new Response(null, { status: 204 });
  const headers = response.headers;

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function validateSession(sessionId: string): Promise<string | null> {
  // Look up conversation by session ID
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

function formatSSEEvent(eventType: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${jsonData}\n\n`;
}
