import { NextResponse } from "next/server";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { cacheThrough } from "@/lib/redis/cache";
import { REDIS_KEYS, REDIS_TTL } from "@/lib/redis/client";

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

async function fetchCompanyDashboardStats(companyId: string): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Run all queries in parallel for better performance
  const [
    activeConversationsResult,
    yesterdayActiveResult,
    aiResolvedToday,
    totalResolvedToday,
    humanEscalationsToday,
  ] = await Promise.all([
    // Active conversations (status = 'active', 'waiting_human', or 'with_human')
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.status} IN ('active', 'waiting_human', 'with_human')`
        )
      ),
    // Yesterday's active for comparison
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.status} IN ('active', 'waiting_human', 'with_human')`,
          gte(conversations.createdAt, yesterday),
          lt(conversations.createdAt, today)
        )
      ),
    // AI resolved conversations (today)
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          eq(conversations.resolutionType, "ai"),
          gte(conversations.resolvedAt, today)
        )
      ),
    // Total resolved conversations (today)
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.resolutionType} IS NOT NULL`,
          gte(conversations.resolvedAt, today)
        )
      ),
    // Human escalations (today)
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.assignedUserId} IS NOT NULL`,
          gte(conversations.updatedAt, today)
        )
      ),
  ]);

  // Calculate AI resolution rate
  const totalResolved = totalResolvedToday[0]?.count ?? 0;
  const aiResolved = aiResolvedToday[0]?.count ?? 0;
  const aiResolutionRate =
    totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0;

  // For avg response time, we'd need to track first response time
  // Using a placeholder for now
  const avgResponseTime = 1.2; // minutes

  const activeCount = activeConversationsResult[0]?.count ?? 0;
  const yesterdayCount = yesterdayActiveResult[0]?.count ?? 0;
  const escalationsCount = humanEscalationsToday[0]?.count ?? 0;

  return {
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
}

export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    // Use cache-through pattern with 5 minute TTL
    const stats = await cacheThrough(
      REDIS_KEYS.dashboardCompanyStats(company.id),
      () => fetchCompanyDashboardStats(company.id),
      REDIS_TTL.DASHBOARD_STATS
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
