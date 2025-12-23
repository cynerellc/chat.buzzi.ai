import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { conversations, messages, users } from "@/lib/db/schema";

export interface MessageItem {
  id: string;
  role: string;
  type: string;
  content: string;
  attachments: unknown[];
  modelId: string | null;
  tokenCount: number | null;
  processingTimeMs: number | null;
  toolCalls: unknown[];
  toolResults: unknown[];
  sourceChunkIds: unknown[];
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { conversationId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const order = searchParams.get("order") || "asc";
    const offset = (page - 1) * limit;

    // Verify conversation belongs to company
    const [conversation] = await db
      .select({ id: conversations.id })
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

    // Get messages
    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(order === "desc" ? desc(messages.createdAt) : asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with user data for human_agent messages
    const enrichedMessages: MessageItem[] = await Promise.all(
      messageList.map(async (msg) => {
        let user = null;
        if (msg.userId) {
          const [userData] = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(eq(users.id, msg.userId))
            .limit(1);
          user = userData || null;
        }

        return {
          id: msg.id,
          role: msg.role,
          type: msg.type,
          content: msg.content,
          attachments: (msg.attachments as unknown[]) || [],
          modelId: msg.modelId,
          tokenCount: msg.tokenCount,
          processingTimeMs: msg.processingTimeMs,
          toolCalls: (msg.toolCalls as unknown[]) || [],
          toolResults: (msg.toolResults as unknown[]) || [],
          sourceChunkIds: (msg.sourceChunkIds as unknown[]) || [],
          isRead: msg.isRead,
          readAt: msg.readAt?.toISOString() ?? null,
          createdAt: msg.createdAt.toISOString(),
          user,
        };
      })
    );

    return NextResponse.json({
      messages: enrichedMessages,
      pagination: {
        page,
        limit,
        hasMore: messageList.length === limit,
      },
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

interface SendMessageRequest {
  content: string;
  role?: "human_agent" | "system";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { conversationId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: SendMessageRequest = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to company
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

    // Create the message
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        role: body.role || "human_agent",
        type: "text",
        content: body.content.trim(),
        userId: user.id,
      })
      .returning();

    // Update conversation
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        // If human agent is responding, update status
        ...(body.role === "human_agent" || !body.role
          ? {
              status: "with_human" as const,
              assignedUserId: user.id,
            }
          : {}),
      })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({ message: newMessage }, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
