import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, users, dailyAnalytics } from "@/lib/db/schema";

export interface AnalyticsOverview {
  totalConversations: number;
  conversationsGrowth: number;
  activeUsers: number;
  activeUsersGrowth: number;
  totalMessages: number;
  messagesGrowth: number;
  aiResolutionRate: number;
  aiResolutionGrowth: number;
  humanEscalationRate: number;
  humanEscalationGrowth: number;
  totalCompanies: number;
  activeCompanies: number;
  totalAgents: number;
}

export async function GET() {
  try {
    await requireMasterAdmin();

    // Get counts from actual tables
    const [companiesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies);

    const [usersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // Aggregate daily analytics for overview
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [aggregatedMetrics] = await db
      .select({
        totalConversations: sql<number>`coalesce(sum(${dailyAnalytics.totalConversations}), 0)`,
        totalMessages: sql<number>`coalesce(sum(${dailyAnalytics.totalMessages}), 0)`,
        aiResolved: sql<number>`coalesce(sum(${dailyAnalytics.aiResolvedCount}), 0)`,
        humanResolved: sql<number>`coalesce(sum(${dailyAnalytics.humanResolvedCount}), 0)`,
        uniqueUsers: sql<number>`coalesce(sum(${dailyAnalytics.uniqueUsers}), 0)`,
      })
      .from(dailyAnalytics)
      .where(sql`${dailyAnalytics.date} >= ${thirtyDaysAgo.toISOString().split('T')[0]}`);

    // Calculate previous 30 days for comparison
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [previousMetrics] = await db
      .select({
        totalConversations: sql<number>`coalesce(sum(${dailyAnalytics.totalConversations}), 0)`,
        totalMessages: sql<number>`coalesce(sum(${dailyAnalytics.totalMessages}), 0)`,
        aiResolved: sql<number>`coalesce(sum(${dailyAnalytics.aiResolvedCount}), 0)`,
        humanResolved: sql<number>`coalesce(sum(${dailyAnalytics.humanResolvedCount}), 0)`,
        uniqueUsers: sql<number>`coalesce(sum(${dailyAnalytics.uniqueUsers}), 0)`,
      })
      .from(dailyAnalytics)
      .where(sql`${dailyAnalytics.date} >= ${sixtyDaysAgo.toISOString().split('T')[0]} AND ${dailyAnalytics.date} < ${thirtyDaysAgo.toISOString().split('T')[0]}`);

    // Calculate rates
    const totalResolved = Number(aggregatedMetrics?.aiResolved ?? 0) + Number(aggregatedMetrics?.humanResolved ?? 0);
    const aiResolutionRate = totalResolved > 0
      ? Math.round((Number(aggregatedMetrics?.aiResolved ?? 0) / totalResolved) * 100)
      : 0;
    const humanEscalationRate = totalResolved > 0
      ? Math.round((Number(aggregatedMetrics?.humanResolved ?? 0) / totalResolved) * 100)
      : 0;

    // Previous period rates
    const prevTotalResolved = Number(previousMetrics?.aiResolved ?? 0) + Number(previousMetrics?.humanResolved ?? 0);
    const prevAiRate = prevTotalResolved > 0
      ? Math.round((Number(previousMetrics?.aiResolved ?? 0) / prevTotalResolved) * 100)
      : 0;
    const prevHumanRate = prevTotalResolved > 0
      ? Math.round((Number(previousMetrics?.humanResolved ?? 0) / prevTotalResolved) * 100)
      : 0;

    // Calculate growth percentages
    const calcGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const overview: AnalyticsOverview = {
      totalConversations: Number(aggregatedMetrics?.totalConversations ?? 0),
      conversationsGrowth: calcGrowth(
        Number(aggregatedMetrics?.totalConversations ?? 0),
        Number(previousMetrics?.totalConversations ?? 0)
      ),
      activeUsers: Number(aggregatedMetrics?.uniqueUsers ?? 0),
      activeUsersGrowth: calcGrowth(
        Number(aggregatedMetrics?.uniqueUsers ?? 0),
        Number(previousMetrics?.uniqueUsers ?? 0)
      ),
      totalMessages: Number(aggregatedMetrics?.totalMessages ?? 0),
      messagesGrowth: calcGrowth(
        Number(aggregatedMetrics?.totalMessages ?? 0),
        Number(previousMetrics?.totalMessages ?? 0)
      ),
      aiResolutionRate,
      aiResolutionGrowth: aiResolutionRate - prevAiRate,
      humanEscalationRate,
      humanEscalationGrowth: humanEscalationRate - prevHumanRate,
      totalCompanies: Number(companiesCount?.count ?? 0),
      activeCompanies: Number(companiesCount?.count ?? 0),
      totalAgents: Number(usersCount?.count ?? 0),
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Failed to fetch analytics overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics overview" },
      { status: 500 }
    );
  }
}
