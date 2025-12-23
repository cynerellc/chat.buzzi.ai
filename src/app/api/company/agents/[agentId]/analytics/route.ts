import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { agents, conversations } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export interface AgentAnalytics {
  totalConversations: number;
  aiResolutionRate: number;
  avgResponseTime: number;
  satisfactionScore: number;
  conversationsByDay: { date: string; count: number }[];
  resolutionBreakdown: {
    ai: number;
    human: number;
    abandoned: number;
    escalated: number;
  };
  topTopics: { topic: string; count: number }[];
  escalationReasons: { reason: string; percentage: number }[];
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { agentId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Verify agent belongs to company
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total conversations in period
    const [totalResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          gte(conversations.createdAt, startDate)
        )
      );

    // Resolution counts
    const [aiResolvedResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.resolutionType, "ai"),
          gte(conversations.resolvedAt, startDate)
        )
      );

    const [humanResolvedResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.resolutionType, "human"),
          gte(conversations.resolvedAt, startDate)
        )
      );

    const [abandonedResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.resolutionType, "abandoned"),
          gte(conversations.resolvedAt, startDate)
        )
      );

    const [escalatedResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.resolutionType, "escalated"),
          gte(conversations.resolvedAt, startDate)
        )
      );

    const totalResolved =
      (aiResolvedResult?.count ?? 0) +
      (humanResolvedResult?.count ?? 0) +
      (abandonedResult?.count ?? 0) +
      (escalatedResult?.count ?? 0);

    const aiResolutionRate =
      totalResolved > 0
        ? Math.round(((aiResolvedResult?.count ?? 0) / totalResolved) * 100)
        : 0;

    // Conversations by day
    const conversationsByDay: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [dayResult] = await db
        .select({ count: count() })
        .from(conversations)
        .where(
          and(
            eq(conversations.agentId, agentId),
            gte(conversations.createdAt, date),
            sql`${conversations.createdAt} < ${nextDate}`
          )
        );

      conversationsByDay.push({
        date: date.toISOString().split("T")[0] ?? "",
        count: dayResult?.count ?? 0,
      });
    }

    const analytics: AgentAnalytics = {
      totalConversations: totalResult?.count ?? 0,
      aiResolutionRate,
      avgResponseTime: agent.avgResolutionTime ?? 0,
      satisfactionScore: agent.satisfactionScore ?? 0,
      conversationsByDay,
      resolutionBreakdown: {
        ai: aiResolvedResult?.count ?? 0,
        human: humanResolvedResult?.count ?? 0,
        abandoned: abandonedResult?.count ?? 0,
        escalated: escalatedResult?.count ?? 0,
      },
      topTopics: [], // Would need topic extraction from conversations
      escalationReasons: [], // Would need escalation reason tracking
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Error fetching agent analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent analytics" },
      { status: 500 }
    );
  }
}
