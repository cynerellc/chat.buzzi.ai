import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
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
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

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
      conditions.push(eq(conversations.agentId, agentId));
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

    // Get conversations with related data
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
        endUserId: conversations.endUserId,
        agentId: conversations.agentId,
        assignedUserId: conversations.assignedUserId,
      })
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch related data for each conversation
    const enrichedConversationsRaw = await Promise.all(
      conversationList.map(async (conv): Promise<ConversationListItem | null> => {
        // Get end user
        const [endUser] = await db
          .select({
            id: endUsers.id,
            name: endUsers.name,
            email: endUsers.email,
            avatarUrl: endUsers.avatarUrl,
          })
          .from(endUsers)
          .where(eq(endUsers.id, conv.endUserId))
          .limit(1);

        // Get agent
        const [agent] = await db
          .select({
            id: agents.id,
            name: agents.name,
          })
          .from(agents)
          .where(eq(agents.id, conv.agentId))
          .limit(1);

        // Get last message
        const [lastMessage] = await db
          .select({
            content: messages.content,
            role: messages.role,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        // Filter by search if provided (search in end user name/email or conversation subject)
        if (search) {
          const searchLower = search.toLowerCase();
          const matchesName = endUser?.name?.toLowerCase().includes(searchLower);
          const matchesEmail = endUser?.email?.toLowerCase().includes(searchLower);
          const matchesSubject = conv.subject?.toLowerCase().includes(searchLower);
          const matchesMessage = lastMessage?.content?.toLowerCase().includes(searchLower);

          if (!matchesName && !matchesEmail && !matchesSubject && !matchesMessage) {
            return null;
          }
        }

        return {
          id: conv.id,
          status: conv.status,
          subject: conv.subject,
          channel: conv.channel,
          messageCount: conv.messageCount,
          sentiment: conv.sentiment,
          satisfactionRating: conv.satisfactionRating,
          lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
          createdAt: conv.createdAt.toISOString(),
          endUser: endUser || { id: "", name: null, email: null, avatarUrl: null },
          agent: agent || { id: "", name: "Unknown Agent" },
          assignedUser: null as ConversationListItem["assignedUser"], // TODO: Fetch assigned user if needed
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
        };
      })
    );

    // Filter out null results from search
    const filteredConversations = enrichedConversationsRaw.filter(
      (conv): conv is ConversationListItem => conv !== null
    );

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
