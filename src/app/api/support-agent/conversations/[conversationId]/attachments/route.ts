/**
 * Support Agent Attachments API
 *
 * GET /api/support-agent/conversations/[conversationId]/attachments - List attachments
 * POST /api/support-agent/conversations/[conversationId]/attachments - Upload attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema/conversations";
import { requireSupportAgent } from "@/lib/auth/guards";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

interface RouteParams {
  conversationId: string;
}

// Attachment types
interface Attachment {
  id: string;
  type: "image" | "file" | "video" | "audio";
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

const uploadAttachmentSchema = z.object({
  type: z.enum(["image", "file", "video", "audio"]),
  name: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().optional(),
  mimeType: z.string().max(100).optional(),
  thumbnailUrl: z.string().url().optional(),
  messageContent: z.string().optional(), // Optional message to send with attachment
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { conversationId } = await params;

    const { user, company } = await requireSupportAgent();

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

    // Get all messages with attachments
    const messagesWithAttachments = await db
      .select({
        id: messages.id,
        attachments: messages.attachments,
        role: messages.role,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`jsonb_array_length(${messages.attachments}) > 0`
        )
      );

    // Flatten attachments with message info
    const attachments: Array<Attachment & { messageId: string; role: string; uploadedAt: Date }> = [];

    for (const message of messagesWithAttachments) {
      const messageAttachments = message.attachments as Attachment[] ?? [];
      for (const attachment of messageAttachments) {
        attachments.push({
          ...attachment,
          messageId: message.id,
          role: message.role,
          uploadedAt: message.createdAt,
        });
      }
    }

    return NextResponse.json({
      attachments,
      total: attachments.length,
    });
  } catch (error) {
    console.error("Get attachments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { conversationId } = await params;

    const { user, company } = await requireSupportAgent();

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

    // Check if conversation is resolved
    if (conversation.status === "resolved" || conversation.status === "abandoned") {
      return NextResponse.json(
        { error: "Cannot add attachments to resolved conversation" },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const data = uploadAttachmentSchema.parse(body);

    // Create attachment object
    const attachment: Attachment = {
      id: crypto.randomUUID(),
      type: data.type,
      name: data.name,
      url: data.url,
      size: data.size,
      mimeType: data.mimeType,
      thumbnailUrl: data.thumbnailUrl,
    };

    // Create message with attachment
    // Map attachment type to message type
    const messageType = data.type === "image" ? "image" : data.type === "audio" ? "audio" : "file";
    const messageContent = data.messageContent || `Sent ${data.type}: ${data.name}`;

    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        role: "human_agent",
        type: messageType,
        content: messageContent,
        attachments: [attachment],
        userId: user.id,
      })
      .returning();

    // Update conversation message count and last message time
    await db
      .update(conversations)
      .set({
        messageCount: sql`${conversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({
      message,
      attachment,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Upload attachment error:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
