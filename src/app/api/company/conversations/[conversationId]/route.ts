import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { conversations, endUsers, agents, escalations, users } from "@/lib/db/schema";
import { getSSEManager, getConversationChannel } from "@/lib/realtime";

export interface ConversationDetail {
  id: string;
  status: string;
  subject: string | null;
  channel: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  sentiment: number | null;
  sentimentHistory: unknown[];
  satisfactionRating: number | null;
  satisfactionFeedback: string | null;
  resolutionType: string | null;
  resolvedAt: string | null;
  pageUrl: string | null;
  referrer: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  endUser: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    channel: string;
    location: Record<string, unknown>;
    totalConversations: number;
    lastSeenAt: string | null;
    createdAt: string;
  };
  agent: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  assignedUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  escalation: {
    id: string;
    status: string;
    priority: string;
    reason: string | null;
    triggerType: string | null;
    createdAt: string;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { conversationId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get conversation
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

    // Get end user
    const [endUser] = await db
      .select()
      .from(endUsers)
      .where(eq(endUsers.id, conversation.endUserId))
      .limit(1);

    // Get agent
    const [agentRow] = await db
      .select({
        id: agents.id,
        name: agents.name,
        agentsList: agents.agentsList,
      })
      .from(agents)
      .where(eq(agents.id, conversation.chatbotId))
      .limit(1);

    // Extract avatarUrl from agentsList[0]
    const agentsListData = (agentRow?.agentsList as { avatar_url?: string }[] | null) || [];
    const agent = agentRow ? {
      id: agentRow.id,
      name: agentRow.name,
      avatarUrl: agentsListData[0]?.avatar_url || null,
    } : null;

    // Get assigned user if any
    let assignedUser = null;
    if (conversation.assignedUserId) {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, conversation.assignedUserId))
        .limit(1);
      assignedUser = user || null;
    }

    // Get active escalation if any
    const [escalation] = await db
      .select()
      .from(escalations)
      .where(eq(escalations.conversationId, conversationId))
      .orderBy(escalations.createdAt)
      .limit(1);

    const conversationDetail: ConversationDetail = {
      id: conversation.id,
      status: conversation.status,
      subject: conversation.subject,
      channel: conversation.channel,
      messageCount: conversation.messageCount,
      userMessageCount: conversation.userMessageCount,
      assistantMessageCount: conversation.assistantMessageCount,
      sentiment: conversation.sentiment,
      sentimentHistory: (conversation.sentimentHistory as unknown[]) || [],
      satisfactionRating: conversation.satisfactionRating,
      satisfactionFeedback: conversation.satisfactionFeedback,
      resolutionType: conversation.resolutionType,
      resolvedAt: conversation.resolvedAt?.toISOString() ?? null,
      pageUrl: conversation.pageUrl,
      referrer: conversation.referrer,
      metadata: (conversation.metadata as Record<string, unknown>) || {},
      tags: (conversation.tags as string[]) || [],
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      endUser: {
        id: endUser?.id ?? "",
        name: endUser?.name ?? null,
        email: endUser?.email ?? null,
        phone: endUser?.phone ?? null,
        avatarUrl: endUser?.avatarUrl ?? null,
        channel: endUser?.channel ?? "web",
        location: (endUser?.location as Record<string, unknown>) || {},
        totalConversations: endUser?.totalConversations ?? 0,
        lastSeenAt: endUser?.lastSeenAt?.toISOString() ?? null,
        createdAt: endUser?.createdAt?.toISOString() ?? new Date().toISOString(),
      },
      agent: agent || { id: "", name: "Unknown Agent", avatarUrl: null },
      assignedUser,
      escalation: escalation
        ? {
            id: escalation.id,
            status: escalation.status,
            priority: escalation.priority,
            reason: escalation.reason,
            triggerType: escalation.triggerType,
            createdAt: escalation.createdAt.toISOString(),
          }
        : null,
    };

    return NextResponse.json({ conversation: conversationDetail });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

interface UpdateConversationRequest {
  // Action-based API (preferred, matches support-agent API)
  action?: "takeOver" | "returnToAi" | "resolve";
  data?: Record<string, unknown>;
  // Legacy field-based API
  status?: "active" | "waiting_human" | "with_human" | "resolved" | "abandoned";
  subject?: string;
  assignedUserId?: string | null;
  tags?: string[];
  resolutionType?: "ai" | "human" | "abandoned" | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { company, user } = await requireCompanyAdmin();
    const { conversationId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: UpdateConversationRequest = await request.json();

    // Verify conversation belongs to company
    const [existingConversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!existingConversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Handle action-based API (matches support-agent API)
    if (body.action) {
      switch (body.action) {
        case "takeOver": {
          // Update status to with_human and assign to current user
          await db
            .update(conversations)
            .set({
              status: "with_human",
              assignedUserId: user.id,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

          // Emit SSE event for widget
          try {
            const sseManager = getSSEManager();
            const channel = getConversationChannel(conversationId);
            sseManager.publish(channel, "human_joined", {
              humanAgentId: user.id,
              humanAgentName: user.name || user.email,
              humanAgentAvatarUrl: null,
            });
          } catch (sseError) {
            console.warn("Failed to publish human_joined SSE event:", sseError);
          }

          // Get updated conversation
          const [updated] = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

          return NextResponse.json({ success: true, conversation: updated });
        }

        case "returnToAi": {
          // Clear assignment and reset status to active
          await db
            .update(conversations)
            .set({
              status: "active",
              assignedUserId: null,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

          // Emit SSE event for widget
          try {
            const sseManager = getSSEManager();
            const channel = getConversationChannel(conversationId);
            sseManager.publish(channel, "human_exited", {
              humanAgentId: user.id,
              humanAgentName: user.name || user.email,
            });
          } catch (sseError) {
            console.warn("Failed to publish human_exited SSE event:", sseError);
          }

          // Get updated conversation
          const [updated] = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

          return NextResponse.json({ success: true, conversation: updated });
        }

        case "resolve": {
          const resolutionType = body.data?.resolutionType as string | undefined;

          await db
            .update(conversations)
            .set({
              status: "resolved",
              resolutionType: (resolutionType as "ai" | "human" | "abandoned" | "escalated") ?? "human",
              resolvedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, conversationId));

          // Get updated conversation
          const [updated] = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

          return NextResponse.json({ success: true, conversation: updated });
        }

        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    }

    // Legacy field-based API (fallback)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined) {
      updateData.status = body.status;

      // If taking over (with_human), assign to current user
      if (body.status === "with_human") {
        updateData.assignedUserId = user.id;
      }

      // If resolving, set resolved timestamp
      if (body.status === "resolved") {
        updateData.resolvedAt = new Date();
        if (body.resolutionType) {
          updateData.resolutionType = body.resolutionType;
        }
      }
    }

    if (body.subject !== undefined) {
      updateData.subject = body.subject;
    }

    if (body.assignedUserId !== undefined) {
      updateData.assignedUserId = body.assignedUserId;
    }

    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    if (body.resolutionType !== undefined) {
      updateData.resolutionType = body.resolutionType;
    }

    // Update conversation
    const [updatedConversation] = await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, conversationId))
      .returning();

    // Emit SSE events for status changes to human handling states
    if (body.status === "with_human") {
      try {
        const sseManager = getSSEManager();
        const channel = getConversationChannel(conversationId);

        sseManager.publish(channel, "human_joined", {
          humanAgentId: user.id,
          humanAgentName: user.name || user.email,
          humanAgentAvatarUrl: null,
        });
      } catch (sseError) {
        console.warn("Failed to publish human_joined SSE event:", sseError);
      }
    }

    // Emit human_exited when returning to AI mode
    if (body.status === "active") {
      try {
        const sseManager = getSSEManager();
        const channel = getConversationChannel(conversationId);

        sseManager.publish(channel, "human_exited", {
          humanAgentId: user.id,
          humanAgentName: user.name || user.email,
        });
      } catch (sseError) {
        console.warn("Failed to publish human_exited SSE event:", sseError);
      }
    }

    return NextResponse.json({ conversation: updatedConversation });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
