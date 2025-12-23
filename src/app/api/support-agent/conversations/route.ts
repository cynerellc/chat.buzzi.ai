/**
 * Support Agent Conversations API
 *
 * GET /api/support-agent/conversations - List conversations for the agent
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, endUsers, messages, escalations } from "@/lib/db/schema/conversations";
import { agents } from "@/lib/db/schema/agents";
import { users } from "@/lib/db/schema/users";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { and, eq, or, desc, sql, isNull, isNotNull, inArray, ilike } from "drizzle-orm";

type ConversationStatus = "active" | "waiting_human" | "with_human" | "resolved" | "abandoned";

interface ConversationListParams {
  filter?: "all" | "waiting" | "active" | "resolved" | "starred" | "unassigned";
  status?: ConversationStatus;
  search?: string;
  agentId?: string;
  page?: number;
  limit?: number;
}

export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params: ConversationListParams = {
      filter: searchParams.get("filter") as ConversationListParams["filter"] ?? "all",
      status: searchParams.get("status") as ConversationStatus | undefined,
      search: searchParams.get("search") ?? undefined,
      agentId: searchParams.get("agentId") ?? undefined,
      page: parseInt(searchParams.get("page") ?? "1"),
      limit: Math.min(parseInt(searchParams.get("limit") ?? "20"), 100),
    };

    // Build where conditions
    const conditions = [eq(conversations.companyId, company.id)];

    // Filter by assignment
    if (params.filter === "unassigned") {
      conditions.push(isNull(conversations.assignedUserId));
      conditions.push(
        or(
          eq(conversations.status, "waiting_human"),
          eq(conversations.status, "active")
        )!
      );
    } else if (params.filter !== "all") {
      // For other filters, show only assigned to current user
      conditions.push(eq(conversations.assignedUserId, session.user.id));
    }

    // Filter by status
    if (params.filter === "waiting") {
      conditions.push(eq(conversations.status, "waiting_human"));
      // Waiting = assigned to agent but agent hasn't responded yet
    } else if (params.filter === "active") {
      conditions.push(
        or(
          eq(conversations.status, "active"),
          eq(conversations.status, "with_human")
        )!
      );
    } else if (params.filter === "resolved") {
      conditions.push(eq(conversations.status, "resolved"));
    } else if (params.filter === "starred") {
      // Starred is stored in metadata
      conditions.push(
        sql`${conversations.metadata}->>'starred' = 'true'`
      );
    }

    // Apply specific status filter if provided
    if (params.status) {
      conditions.push(eq(conversations.status, params.status));
    }

    // Filter by agent
    if (params.agentId) {
      conditions.push(eq(conversations.agentId, params.agentId));
    }

    // Calculate offset
    const offset = (params.page! - 1) * params.limit!;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(and(...conditions));

    const total = countResult[0]?.count ?? 0;

    // Get conversations with related data
    const conversationList = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        subject: conversations.subject,
        messageCount: conversations.messageCount,
        sentiment: conversations.sentiment,
        tags: conversations.tags,
        metadata: conversations.metadata,
        createdAt: conversations.createdAt,
        lastMessageAt: conversations.lastMessageAt,
        // End user info
        endUser: {
          id: endUsers.id,
          name: endUsers.name,
          email: endUsers.email,
          avatarUrl: endUsers.avatarUrl,
          channel: endUsers.channel,
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
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(params.limit!)
      .offset(offset);

    // Get last message for each conversation
    const conversationIds = conversationList.map((c) => c.id);
    const lastMessages = conversationIds.length > 0
      ? await db
          .select({
            conversationId: messages.conversationId,
            content: messages.content,
            role: messages.role,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds))
          .orderBy(desc(messages.createdAt))
      : [];

    // Group last messages by conversation
    const lastMessageMap = new Map<string, typeof lastMessages[0]>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversationId)) {
        lastMessageMap.set(msg.conversationId, msg);
      }
    }

    // Get pending escalations
    const pendingEscalations = conversationIds.length > 0
      ? await db
          .select({
            conversationId: escalations.conversationId,
            priority: escalations.priority,
            reason: escalations.reason,
            createdAt: escalations.createdAt,
          })
          .from(escalations)
          .where(
            and(
              inArray(escalations.conversationId, conversationIds),
              eq(escalations.status, "pending")
            )
          )
      : [];

    const escalationMap = new Map(
      pendingEscalations.map((e) => [e.conversationId, e])
    );

    // Format response
    const formattedConversations = conversationList.map((conv) => {
      const lastMessage = lastMessageMap.get(conv.id);
      const escalation = escalationMap.get(conv.id);
      const metadata = conv.metadata as Record<string, unknown> | null;

      return {
        id: conv.id,
        status: conv.status,
        subject: conv.subject,
        messageCount: conv.messageCount,
        sentiment: conv.sentiment,
        tags: conv.tags,
        isStarred: metadata?.starred === true,
        createdAt: conv.createdAt,
        lastMessageAt: conv.lastMessageAt,
        endUser: conv.endUser,
        agent: conv.agent,
        assignedUser: conv.assignedUser,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content.slice(0, 100) + (lastMessage.content.length > 100 ? "..." : ""),
              role: lastMessage.role,
              createdAt: lastMessage.createdAt,
            }
          : null,
        escalation: escalation
          ? {
              priority: escalation.priority,
              reason: escalation.reason,
              createdAt: escalation.createdAt,
            }
          : null,
      };
    });

    // Get stats for the current user
    const stats = await getAgentStats(company.id, session.user.id);

    return NextResponse.json({
      conversations: formattedConversations,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit!),
      },
      stats,
    });
  } catch (error) {
    console.error("Support agent conversations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

async function getAgentStats(companyId: string, userId: string) {
  // Get assigned conversation counts
  const [assignedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.companyId, companyId),
        eq(conversations.assignedUserId, userId),
        or(
          eq(conversations.status, "active"),
          eq(conversations.status, "with_human")
        )
      )
    );

  // Get unassigned waiting count
  const [unassignedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.companyId, companyId),
        isNull(conversations.assignedUserId),
        eq(conversations.status, "waiting_human")
      )
    );

  // Get resolved today count
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [resolvedTodayCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.companyId, companyId),
        eq(conversations.resolvedBy, userId),
        eq(conversations.status, "resolved"),
        sql`${conversations.resolvedAt} >= ${today}`
      )
    );

  // Get waiting count (assigned but no recent agent response)
  const [waitingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.companyId, companyId),
        eq(conversations.assignedUserId, userId),
        eq(conversations.status, "active")
      )
    );

  return {
    myConversations: assignedCount?.count ?? 0,
    unassigned: unassignedCount?.count ?? 0,
    resolvedToday: resolvedTodayCount?.count ?? 0,
    waiting: waitingCount?.count ?? 0,
  };
}
