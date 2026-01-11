/**
 * Cancel Escalation API
 *
 * POST /api/widget/[sessionId]/cancel-escalation
 * Cancels a pending human escalation and returns the conversation to AI mode
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, escalations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSSEManager, getConversationChannel } from "@/lib/realtime";
import {
  getWidgetSessionCache,
  setWidgetSessionCache,
  type CachedWidgetSession,
} from "@/lib/redis/cache";

interface RouteParams {
  sessionId: string;
}

/**
 * Get conversation by session ID using Redis cache for performance
 */
async function getConversationForSession(sessionId: string) {
  // Try Redis cache first
  const cached = await getWidgetSessionCache(sessionId);

  if (cached) {
    if (cached.status === "resolved" || cached.status === "abandoned") {
      return null;
    }

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
    const cacheData: CachedWidgetSession = {
      conversationId: conv.id,
      chatbotId: conv.chatbotId,
      companyId: conv.companyId,
      status: conv.status,
    };
    setWidgetSessionCache(sessionId, cacheData).catch(() => {});
    return conv;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { sessionId } = await params;

    // Get conversation from session
    const conversation = await getConversationForSession(sessionId);
    if (!conversation) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Only allow canceling if in waiting_human status
    // If already active, treat as success (idempotent behavior)
    if (conversation.status === "active") {
      return NextResponse.json({ success: true, message: "Already in active state" });
    }

    if (conversation.status !== "waiting_human") {
      return NextResponse.json(
        { error: "Cannot cancel - not in waiting state", currentStatus: conversation.status },
        { status: 400 }
      );
    }

    // Update conversation status back to active
    await db
      .update(conversations)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id));

    // Update cache with new status
    const cacheData: CachedWidgetSession = {
      conversationId: conversation.id,
      chatbotId: conversation.chatbotId,
      companyId: conversation.companyId,
      status: "active",
    };
    setWidgetSessionCache(sessionId, cacheData).catch(() => {});

    // Cancel any pending escalations (returned_to_ai status)
    await db
      .update(escalations)
      .set({ status: "returned_to_ai", resolvedAt: new Date() })
      .where(
        and(
          eq(escalations.conversationId, conversation.id),
          eq(escalations.status, "pending")
        )
      );

    // Emit SSE event to notify widget
    try {
      const sseManager = getSSEManager();
      const channel = getConversationChannel(conversation.id);
      sseManager.publish(channel, "escalation_cancelled", {
        message: "Escalation cancelled, returning to AI assistant",
      });
    } catch (sseError) {
      console.warn("Failed to publish escalation_cancelled SSE event:", sseError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel escalation error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
