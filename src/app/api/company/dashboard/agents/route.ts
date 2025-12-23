import { NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
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
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all agents for the company
    const companyAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        avatarUrl: agents.avatarUrl,
        status: agents.status,
        type: agents.type,
      })
      .from(agents)
      .where(eq(agents.companyId, company.id))
      .orderBy(agents.name);

    // Get conversation stats for each agent
    const agentOverviews: AgentOverview[] = await Promise.all(
      companyAgents.map(async (agent) => {
        // Today's conversations
        const [todayConversationsResult] = await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.agentId, agent.id),
              gte(conversations.createdAt, today)
            )
          );

        // AI resolved conversations today
        const [aiResolvedResult] = await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.agentId, agent.id),
              eq(conversations.resolutionType, "ai"),
              gte(conversations.resolvedAt, today)
            )
          );

        // Total resolved today
        const [totalResolvedResult] = await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.agentId, agent.id),
              sql`${conversations.resolutionType} IS NOT NULL`,
              gte(conversations.resolvedAt, today)
            )
          );

        const totalResolved = totalResolvedResult?.count ?? 0;
        const aiResolved = aiResolvedResult?.count ?? 0;
        const aiResolutionRate =
          totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0;

        return {
          id: agent.id,
          name: agent.name,
          avatarUrl: agent.avatarUrl,
          status: agent.status as "active" | "paused" | "draft",
          type: agent.type,
          todayConversations: todayConversationsResult?.count ?? 0,
          aiResolutionRate,
        };
      })
    );

    return NextResponse.json({ agents: agentOverviews });
  } catch (error) {
    console.error("Error fetching agents overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents overview" },
      { status: 500 }
    );
  }
}
