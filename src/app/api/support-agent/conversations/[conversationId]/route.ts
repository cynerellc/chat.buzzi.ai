/**
 * Support Agent Single Conversation API
 *
 * GET /api/support-agent/conversations/[conversationId] - Get conversation details
 * PATCH /api/support-agent/conversations/[conversationId] - Update conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, endUsers, messages, escalations } from "@/lib/db/schema/conversations";
import { agents } from "@/lib/db/schema/agents";
import { users } from "@/lib/db/schema/users";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { and, eq, desc } from "drizzle-orm";

interface RouteParams {
  conversationId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { conversationId } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get conversation with related data
    const conversationResult = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        subject: conversations.subject,
        channel: conversations.channel,
        messageCount: conversations.messageCount,
        userMessageCount: conversations.userMessageCount,
        assistantMessageCount: conversations.assistantMessageCount,
        sentiment: conversations.sentiment,
        sentimentHistory: conversations.sentimentHistory,
        satisfactionRating: conversations.satisfactionRating,
        satisfactionFeedback: conversations.satisfactionFeedback,
        tags: conversations.tags,
        metadata: conversations.metadata,
        pageUrl: conversations.pageUrl,
        referrer: conversations.referrer,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        lastMessageAt: conversations.lastMessageAt,
        resolvedAt: conversations.resolvedAt,
        resolutionType: conversations.resolutionType,
        // End user info
        endUser: {
          id: endUsers.id,
          name: endUsers.name,
          email: endUsers.email,
          phone: endUsers.phone,
          avatarUrl: endUsers.avatarUrl,
          channel: endUsers.channel,
          metadata: endUsers.metadata,
          totalConversations: endUsers.totalConversations,
          lastSeenAt: endUsers.lastSeenAt,
          createdAt: endUsers.createdAt,
        },
        // Agent info
        agent: {
          id: agents.id,
          name: agents.name,
          avatarUrl: agents.avatarUrl,
        },
        // Assigned user info
        assignedUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(conversations)
      .leftJoin(endUsers, eq(conversations.endUserId, endUsers.id))
      .leftJoin(agents, eq(conversations.agentId, agents.id))
      .leftJoin(users, eq(conversations.assignedUserId, users.id))
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    const conversation = conversationResult[0];

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get messages
    const messageList = await db
      .select({
        id: messages.id,
        role: messages.role,
        type: messages.type,
        content: messages.content,
        attachments: messages.attachments,
        isRead: messages.isRead,
        readAt: messages.readAt,
        toolCalls: messages.toolCalls,
        sourceChunkIds: messages.sourceChunkIds,
        metadata: messages.metadata,
        createdAt: messages.createdAt,
        // User info for human_agent messages
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Get escalation history
    const escalationHistory = await db
      .select({
        id: escalations.id,
        status: escalations.status,
        priority: escalations.priority,
        reason: escalations.reason,
        triggerType: escalations.triggerType,
        resolution: escalations.resolution,
        returnedToAi: escalations.returnedToAi,
        createdAt: escalations.createdAt,
        resolvedAt: escalations.resolvedAt,
        // Assigned user
        assignedUser: {
          id: users.id,
          name: users.name,
        },
      })
      .from(escalations)
      .leftJoin(users, eq(escalations.assignedUserId, users.id))
      .where(eq(escalations.conversationId, conversationId))
      .orderBy(desc(escalations.createdAt));

    // Get previous conversations for this end user
    const previousConversations = conversation.endUser
      ? await db
          .select({
            id: conversations.id,
            subject: conversations.subject,
            status: conversations.status,
            createdAt: conversations.createdAt,
            resolvedAt: conversations.resolvedAt,
            satisfactionRating: conversations.satisfactionRating,
          })
          .from(conversations)
          .where(
            and(
              eq(conversations.endUserId, conversation.endUser.id),
              eq(conversations.companyId, company.id)
            )
          )
          .orderBy(desc(conversations.createdAt))
          .limit(10)
      : [];

    // Mark unread messages as read
    await db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.isRead, false)
        )
      );

    return NextResponse.json({
      conversation: {
        ...conversation,
        isStarred: (conversation.metadata as Record<string, unknown> | null)?.starred === true,
      },
      messages: messageList,
      escalationHistory,
      previousConversations: previousConversations.filter((c) => c.id !== conversationId),
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { conversationId } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, data } = body as {
      action: "resolve" | "star" | "unstar" | "addTag" | "removeTag" | "assign" | "unassign" | "returnToAi";
      data?: Record<string, unknown>;
    };

    // Verify conversation exists and belongs to company
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const existingMetadata = (existing.metadata as Record<string, unknown>) ?? {};
    const existingTags = (existing.tags as string[]) ?? [];

    switch (action) {
      case "resolve": {
        const resolutionType = data?.resolutionType as string | undefined;
        const closingMessage = data?.closingMessage as string | undefined;

        // Send closing message if provided
        if (closingMessage) {
          await db.insert(messages).values({
            conversationId,
            role: "human_agent",
            type: "text",
            content: closingMessage,
            userId: session.user.id,
          });
        }

        // Update conversation
        await db
          .update(conversations)
          .set({
            status: "resolved",
            resolutionType: (resolutionType as "ai" | "human" | "abandoned" | "escalated") ?? "human",
            resolvedAt: new Date(),
            resolvedBy: session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        // Update any pending escalations
        await db
          .update(escalations)
          .set({
            status: "resolved",
            resolvedAt: new Date(),
            resolvedBy: session.user.id,
            resolution: "Resolved by agent",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(escalations.conversationId, conversationId),
              eq(escalations.status, "pending")
            )
          );

        break;
      }

      case "star": {
        await db
          .update(conversations)
          .set({
            metadata: { ...existingMetadata, starred: true },
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
        break;
      }

      case "unstar": {
        await db
          .update(conversations)
          .set({
            metadata: { ...existingMetadata, starred: false },
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
        break;
      }

      case "addTag": {
        const tag = data?.tag as string;
        if (tag && !existingTags.includes(tag)) {
          await db
            .update(conversations)
            .set({
              tags: [...existingTags, tag],
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));
        }
        break;
      }

      case "removeTag": {
        const tag = data?.tag as string;
        if (tag) {
          await db
            .update(conversations)
            .set({
              tags: existingTags.filter((t) => t !== tag),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));
        }
        break;
      }

      case "assign": {
        const targetUserId = data?.userId as string | undefined;
        await db
          .update(conversations)
          .set({
            assignedUserId: targetUserId ?? session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        // Update escalation if exists
        await db
          .update(escalations)
          .set({
            status: "assigned",
            assignedUserId: targetUserId ?? session.user.id,
            assignedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(escalations.conversationId, conversationId),
              eq(escalations.status, "pending")
            )
          );
        break;
      }

      case "unassign": {
        await db
          .update(conversations)
          .set({
            assignedUserId: null,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
        break;
      }

      case "returnToAi": {
        // Clear assignment and update escalation
        await db
          .update(conversations)
          .set({
            assignedUserId: null,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));

        // Mark escalation as returned to AI
        await db
          .update(escalations)
          .set({
            returnedToAi: true,
            returnedAt: new Date(),
            status: "resolved",
            resolvedAt: new Date(),
            resolvedBy: session.user.id,
            resolution: "Returned to AI",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(escalations.conversationId, conversationId),
              eq(escalations.status, "assigned")
            )
          );

        // Add system message
        await db.insert(messages).values({
          conversationId,
          role: "system",
          type: "text",
          content: "Conversation returned to AI assistant",
        });
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get updated conversation
    const [updated] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    return NextResponse.json({
      success: true,
      conversation: updated,
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
