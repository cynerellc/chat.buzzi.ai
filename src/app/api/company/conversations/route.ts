import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { conversations, endUsers, agents, messages } from "@/lib/db/schema";

type ConversationStatus = "active" | "waiting_human" | "with_human" | "resolved" | "abandoned";
type ChannelType = "web" | "whatsapp" | "telegram" | "messenger" | "instagram" | "slack" | "teams" | "custom";

export interface ConversationListItem {
  id: string;
  status: ConversationStatus;
  subject: string | null;
  channel: ChannelType;
  messageCount: number;
  sentiment: number | null;
  satisfactionRating: number | null;
  lastMessageAt: string | null;
  createdAt: string;
  endUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  agent: {
    id: string;
    name: string;
  };
  assignedUser: {
    id: string;
    name: string;
  } | null;
  lastMessage: {
    content: string;
    role: string;
    createdAt: string;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const agentId = searchParams.get("agentId");
    const channel = searchParams.get("channel");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(conversations.companyId, company.id)];

    if (status && status !== "all") {
      conditions.push(
        eq(
          conversations.status,
          status as "active" | "waiting_human" | "with_human" | "resolved" | "abandoned"
        )
      );
    }

    if (agentId) {
      conditions.push(eq(conversations.chatbotId, agentId));
    }

    if (channel && channel !== "all") {
      conditions.push(
        eq(
          conversations.channel,
          channel as "web" | "whatsapp" | "telegram" | "messenger" | "instagram" | "slack" | "teams" | "custom"
        )
      );
    }

    if (startDate) {
      conditions.push(gte(conversations.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(conversations.createdAt, new Date(endDate)));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(and(...conditions));

    // C1: Use JOINs instead of N+1 queries
    // Single query with LEFT JOINs for conversations, end users, and agents
    const conversationList = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        subject: conversations.subject,
        channel: conversations.channel,
        messageCount: conversations.messageCount,
        sentiment: conversations.sentiment,
        satisfactionRating: conversations.satisfactionRating,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        assignedUserId: conversations.assignedUserId,
        // End user fields via JOIN
        endUserId: endUsers.id,
        endUserName: endUsers.name,
        endUserEmail: endUsers.email,
        endUserAvatarUrl: endUsers.avatarUrl,
        // Agent fields via JOIN
        agentId: agents.id,
        agentName: agents.name,
      })
      .from(conversations)
      .leftJoin(endUsers, eq(conversations.endUserId, endUsers.id))
      .leftJoin(agents, eq(conversations.chatbotId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch query for last messages using DISTINCT ON (PostgreSQL)
    // This reduces N queries to 1 query regardless of page size
    const conversationIds = conversationList.map((c) => c.id);
    const lastMessagesMap = new Map<string, { content: string; role: string; createdAt: Date }>();

    if (conversationIds.length > 0) {
      const lastMessages = await db
        .selectDistinctOn([messages.conversationId], {
          conversationId: messages.conversationId,
          content: messages.content,
          role: messages.role,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.conversationId, conversationIds))
        .orderBy(messages.conversationId, desc(messages.createdAt));

      lastMessages.forEach((msg) => {
        lastMessagesMap.set(msg.conversationId, {
          content: msg.content,
          role: msg.role,
          createdAt: msg.createdAt,
        });
      });
    }

    // Map and filter results
    const enrichedConversations: ConversationListItem[] = [];
    for (const conv of conversationList) {
      const lastMessage = lastMessagesMap.get(conv.id);

      // Filter by search if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesName = conv.endUserName?.toLowerCase().includes(searchLower);
        const matchesEmail = conv.endUserEmail?.toLowerCase().includes(searchLower);
        const matchesSubject = conv.subject?.toLowerCase().includes(searchLower);
        const matchesMessage = lastMessage?.content?.toLowerCase().includes(searchLower);

        if (!matchesName && !matchesEmail && !matchesSubject && !matchesMessage) {
          continue;
        }
      }

      enrichedConversations.push({
        id: conv.id,
        status: conv.status,
        subject: conv.subject,
        channel: conv.channel,
        messageCount: conv.messageCount,
        sentiment: conv.sentiment,
        satisfactionRating: conv.satisfactionRating,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
        createdAt: conv.createdAt.toISOString(),
        endUser: {
          id: conv.endUserId ?? "",
          name: conv.endUserName,
          email: conv.endUserEmail,
          avatarUrl: conv.endUserAvatarUrl,
        },
        agent: {
          id: conv.agentId ?? "",
          name: conv.agentName ?? "Unknown Agent",
        },
        assignedUser: null, // TODO: Fetch assigned user if needed
        lastMessage: lastMessage
          ? {
              content:
                lastMessage.content.length > 100
                  ? lastMessage.content.substring(0, 100) + "..."
                  : lastMessage.content,
              role: lastMessage.role,
              createdAt: lastMessage.createdAt.toISOString(),
            }
          : null,
      });
    }

    const filteredConversations = enrichedConversations;

    // Get status counts for filter badges
    const statusCounts = await db
      .select({
        status: conversations.status,
        count: count(),
      })
      .from(conversations)
      .where(eq(conversations.companyId, company.id))
      .groupBy(conversations.status);

    const statusCountMap: Record<string, number> = {};
    statusCounts.forEach((sc) => {
      statusCountMap[sc.status] = sc.count;
    });

    return NextResponse.json({
      conversations: filteredConversations,
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
