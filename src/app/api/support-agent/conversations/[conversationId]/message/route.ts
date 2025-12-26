/**
 * Support Agent Message API
 *
 * POST /api/support-agent/conversations/[conversationId]/message - Send a message
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema/conversations";
import { requireSupportAgent } from "@/lib/auth/guards";
import { and, eq } from "drizzle-orm";
import { getSSEManager, getConversationChannel } from "@/lib/realtime";

interface RouteParams {
  conversationId: string;
}

interface SendMessageRequest {
  content: string;
  attachments?: Array<{
    type: "image" | "file" | "video";
    url: string;
    name: string;
    size?: number;
    mimeType?: string;
  }>;
  isNote?: boolean; // Internal note, not visible to customer
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { conversationId } = await params;

    const { user, company } = await requireSupportAgent();

    const body = (await request.json()) as SendMessageRequest;
    const { content, attachments, isNote } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Verify conversation exists and belongs to company
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check if conversation is still active
    if (conversation.status === "resolved" || conversation.status === "abandoned") {
      return NextResponse.json(
        { error: "Conversation is no longer active" },
        { status: 400 }
      );
    }

    // Create message
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        role: isNote ? "system" : "human_agent",
        type: isNote ? "system_event" : "text",
        content: content.trim(),
        userId: user.id,
        attachments: attachments ?? [],
        metadata: isNote ? { isInternalNote: true, eventType: "note" } : {},
      })
      .returning();

    if (!newMessage) {
      throw new Error("Failed to create message");
    }

    // Update conversation stats (don't count notes)
    if (!isNote) {
      await db
        .update(conversations)
        .set({
          messageCount: conversation.messageCount + 1,
          assistantMessageCount: conversation.assistantMessageCount + 1,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));

      // Publish to SSE channel for real-time updates
      try {
        const sseManager = getSSEManager();
        const channel = getConversationChannel(conversationId);

        sseManager.publish(channel, "notification", {
          type: "new_message",
          messageId: newMessage.id,
          role: "human_agent",
          content: content.trim(),
          attachments: attachments ?? [],
          userId: user.id,
          userName: user.name,
          createdAt: newMessage.createdAt.toISOString(),
        });
      } catch (sseError) {
        // SSE publish failure shouldn't fail the request
        console.warn("Failed to publish SSE event:", sseError);
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        id: newMessage.id,
        role: newMessage.role,
        type: newMessage.type,
        content: newMessage.content,
        attachments: newMessage.attachments,
        createdAt: newMessage.createdAt,
        userId: user.id,
        userName: user.name,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
