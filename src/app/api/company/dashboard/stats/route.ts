import { NextResponse } from "next/server";
import { and, count, eq, gte, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";

export interface DashboardStats {
  activeConversations: number;
  activeConversationsChange: number;
  aiResolutionRate: number;
  aiResolutionChange: number;
  humanEscalations: number;
  humanEscalationsChange: number;
  avgResponseTime: number;
  avgResponseTimeChange: number;
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

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Active conversations (status = 'active' or 'waiting')
    const [activeConversationsResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          sql`${conversations.status} IN ('active', 'waiting')`
        )
      );

    // Yesterday's active for comparison
    const [yesterdayActiveResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          sql`${conversations.status} IN ('active', 'waiting')`,
          gte(conversations.createdAt, yesterday),
          sql`${conversations.createdAt} < ${today}`
        )
      );

    // AI resolved conversations (today)
    const [aiResolvedToday] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          eq(conversations.resolutionType, "ai"),
          gte(conversations.resolvedAt, today)
        )
      );

    // Total resolved conversations (today)
    const [totalResolvedToday] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          sql`${conversations.resolutionType} IS NOT NULL`,
          gte(conversations.resolvedAt, today)
        )
      );

    // Human escalations (today)
    const [humanEscalationsToday] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          sql`${conversations.assignedUserId} IS NOT NULL`,
          gte(conversations.updatedAt, today)
        )
      );

    // Calculate AI resolution rate
    const totalResolved = totalResolvedToday?.count ?? 0;
    const aiResolved = aiResolvedToday?.count ?? 0;
    const aiResolutionRate =
      totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0;

    // For avg response time, we'd need to track first response time
    // Using a placeholder for now
    const avgResponseTime = 1.2; // minutes

    const activeCount = activeConversationsResult?.count ?? 0;
    const yesterdayCount = yesterdayActiveResult?.count ?? 0;
    const escalationsCount = humanEscalationsToday?.count ?? 0;

    const stats: DashboardStats = {
      activeConversations: activeCount,
      activeConversationsChange:
        yesterdayCount > 0
          ? Math.round(((activeCount - yesterdayCount) / yesterdayCount) * 100)
          : 0,
      aiResolutionRate,
      aiResolutionChange: 0, // Would need historical data
      humanEscalations: escalationsCount,
      humanEscalationsChange: 0, // Would need historical data
      avgResponseTime,
      avgResponseTimeChange: 0, // Would need historical data
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
