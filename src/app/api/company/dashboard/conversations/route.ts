import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, conversations, endUsers } from "@/lib/db/schema";

export interface RecentConversation {
  id: string;
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
  status: string;
  lastMessage: string | null;
  createdAt: string;
  lastMessageAt: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20);

    // Get recent conversations with end user and agent info
    const recentConversations = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        subject: conversations.subject,
        createdAt: conversations.createdAt,
        lastMessageAt: conversations.lastMessageAt,
        endUser: {
          id: endUsers.id,
          name: endUsers.name,
          email: endUsers.email,
          avatarUrl: endUsers.avatarUrl,
        },
        agent: {
          id: agents.id,
          name: agents.name,
        },
      })
      .from(conversations)
      .innerJoin(endUsers, eq(conversations.endUserId, endUsers.id))
      .innerJoin(agents, eq(conversations.agentId, agents.id))
      .where(eq(conversations.companyId, company.id))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(limit);

    const formattedConversations: RecentConversation[] = recentConversations.map(
      (conv) => ({
        id: conv.id,
        endUser: conv.endUser,
        agent: conv.agent,
        status: conv.status,
        lastMessage: conv.subject,
        createdAt: conv.createdAt.toISOString(),
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      })
    );

    return NextResponse.json({ conversations: formattedConversations });
  } catch (error) {
    console.error("Error fetching recent conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent conversations" },
      { status: 500 }
    );
  }
}
