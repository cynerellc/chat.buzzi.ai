import { NextResponse } from "next/server";
import { eq, gte, inArray, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, conversations } from "@/lib/db/schema";

export interface AgentOverview {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "paused" | "draft";
  type: string;
  todayConversations: number;
  aiResolutionRate: number;
}

export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all agents for the company
    const companyAgentsRaw = await db
      .select({
        id: agents.id,
        name: agents.name,
        agentsList: agents.agentsList,
        status: agents.status,
        type: agents.type,
      })
      .from(agents)
      .where(eq(agents.companyId, company.id))
      .orderBy(agents.name);

    // Map to include avatarUrl from agentsList[0]
    const companyAgents = companyAgentsRaw.map((agent) => {
      const agentsListData = (agent.agentsList as { avatar_url?: string }[] | null) || [];
      return {
        id: agent.id,
        name: agent.name,
        avatarUrl: agentsListData[0]?.avatar_url || null,
        status: agent.status,
        type: agent.type,
      };
    });

    // C5: Fix N+1 - batch query for all agent stats using GROUP BY
    const agentIds = companyAgents.map((a) => a.id);
    let statsMap: Map<string, { todayConversations: number; aiResolved: number; totalResolved: number }> = new Map();

    if (agentIds.length > 0) {
      const batchedStats = await db
        .select({
          chatbotId: conversations.chatbotId,
          todayConversations: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${today})`,
          aiResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} = 'ai' AND ${conversations.resolvedAt} >= ${today})`,
          totalResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} IS NOT NULL AND ${conversations.resolvedAt} >= ${today})`,
        })
        .from(conversations)
        .where(inArray(conversations.chatbotId, agentIds))
        .groupBy(conversations.chatbotId);

      statsMap = new Map(
        batchedStats.map((s) => [
          s.chatbotId,
          {
            todayConversations: Number(s.todayConversations) || 0,
            aiResolved: Number(s.aiResolved) || 0,
            totalResolved: Number(s.totalResolved) || 0,
          },
        ])
      );
    }

    // Build agent overviews using batched stats
    const agentOverviews: AgentOverview[] = companyAgents.map((agent) => {
      const stats = statsMap.get(agent.id) || { todayConversations: 0, aiResolved: 0, totalResolved: 0 };
      const aiResolutionRate =
        stats.totalResolved > 0 ? Math.round((stats.aiResolved / stats.totalResolved) * 100) : 0;

      return {
        id: agent.id,
        name: agent.name,
        avatarUrl: agent.avatarUrl,
        status: agent.status as "active" | "paused" | "draft",
        type: agent.type,
        todayConversations: stats.todayConversations,
        aiResolutionRate,
      };
    });

    return NextResponse.json({ agents: agentOverviews });
  } catch (error) {
    console.error("Error fetching agents overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents overview" },
      { status: 500 }
    );
  }
}
