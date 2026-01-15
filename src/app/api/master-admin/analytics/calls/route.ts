import { sql, desc, eq, and, gte } from "drizzle-orm";
import { NextResponse, NextRequest } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { calls, companies, chatbots } from "@/lib/db/schema";

// ============================================================================
// Types
// ============================================================================

export interface CallAnalyticsOverview {
  totalCalls: number;
  callsGrowth: number;
  completedCalls: number;
  failedCalls: number;
  successRate: number;
  successRateGrowth: number;
  totalDurationMinutes: number;
  averageDurationSeconds: number;
  durationGrowth: number;
  totalTurns: number;
  averageTurns: number;
}

export interface CallsByProvider {
  provider: string;
  count: number;
  percentage: number;
  totalDuration: number;
  avgDuration: number;
}

export interface CallsBySource {
  source: string;
  count: number;
  percentage: number;
}

export interface CallsByStatus {
  status: string;
  count: number;
  percentage: number;
}

export interface CallsByCompany {
  companyId: string;
  companyName: string;
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  successRate: number;
}

export interface CallDataPoint {
  date: string;
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  totalDuration: number;
}

export interface CallAnalyticsResponse {
  overview: CallAnalyticsOverview;
  byProvider: CallsByProvider[];
  bySource: CallsBySource[];
  byStatus: CallsByStatus[];
  topCompanies: CallsByCompany[];
  dailyData: CallDataPoint[];
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - days * 2);
    previousStartDate.setHours(0, 0, 0, 0);

    // ========================================================================
    // Current Period Aggregations
    // ========================================================================

    const [currentMetrics] = await db
      .select({
        totalCalls: sql<number>`count(*)`,
        completedCalls: sql<number>`count(*) filter (where ${calls.status} = 'completed')`,
        failedCalls: sql<number>`count(*) filter (where ${calls.status} = 'failed')`,
        totalDurationSeconds: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)`,
        avgDurationSeconds: sql<number>`coalesce(avg(${calls.durationSeconds}), 0)`,
        totalTurns: sql<number>`coalesce(sum(${calls.totalTurns}), 0)`,
        avgTurns: sql<number>`coalesce(avg(${calls.totalTurns}), 0)`,
      })
      .from(calls)
      .where(gte(calls.createdAt, startDate));

    // ========================================================================
    // Previous Period (for growth calculations)
    // ========================================================================

    const [previousMetrics] = await db
      .select({
        totalCalls: sql<number>`count(*)`,
        completedCalls: sql<number>`count(*) filter (where ${calls.status} = 'completed')`,
        totalDurationSeconds: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)`,
      })
      .from(calls)
      .where(
        and(
          gte(calls.createdAt, previousStartDate),
          sql`${calls.createdAt} < ${startDate}`
        )
      );

    // ========================================================================
    // Calls by AI Provider
    // ========================================================================

    const providerStats = await db
      .select({
        provider: calls.aiProvider,
        count: sql<number>`count(*)`,
        totalDuration: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)`,
        avgDuration: sql<number>`coalesce(avg(${calls.durationSeconds}), 0)`,
      })
      .from(calls)
      .where(gte(calls.createdAt, startDate))
      .groupBy(calls.aiProvider);

    const totalCallsForProvider = Number(currentMetrics?.totalCalls ?? 0);
    const byProvider: CallsByProvider[] = providerStats.map((stat) => ({
      provider: stat.provider || "unknown",
      count: Number(stat.count),
      percentage:
        totalCallsForProvider > 0
          ? Math.round((Number(stat.count) / totalCallsForProvider) * 100)
          : 0,
      totalDuration: Number(stat.totalDuration),
      avgDuration: Math.round(Number(stat.avgDuration)),
    }));

    // ========================================================================
    // Calls by Source
    // ========================================================================

    const sourceStats = await db
      .select({
        source: calls.source,
        count: sql<number>`count(*)`,
      })
      .from(calls)
      .where(gte(calls.createdAt, startDate))
      .groupBy(calls.source);

    const bySource: CallsBySource[] = sourceStats.map((stat) => ({
      source: stat.source || "unknown",
      count: Number(stat.count),
      percentage:
        totalCallsForProvider > 0
          ? Math.round((Number(stat.count) / totalCallsForProvider) * 100)
          : 0,
    }));

    // ========================================================================
    // Calls by Status
    // ========================================================================

    const statusStats = await db
      .select({
        status: calls.status,
        count: sql<number>`count(*)`,
      })
      .from(calls)
      .where(gte(calls.createdAt, startDate))
      .groupBy(calls.status);

    const byStatus: CallsByStatus[] = statusStats.map((stat) => ({
      status: stat.status || "unknown",
      count: Number(stat.count),
      percentage:
        totalCallsForProvider > 0
          ? Math.round((Number(stat.count) / totalCallsForProvider) * 100)
          : 0,
    }));

    // ========================================================================
    // Top Companies by Call Volume
    // ========================================================================

    const companyStats = await db
      .select({
        companyId: calls.companyId,
        companyName: companies.name,
        totalCalls: sql<number>`count(*)`,
        totalDuration: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)`,
        avgDuration: sql<number>`coalesce(avg(${calls.durationSeconds}), 0)`,
        completedCalls: sql<number>`count(*) filter (where ${calls.status} = 'completed')`,
      })
      .from(calls)
      .innerJoin(companies, eq(calls.companyId, companies.id))
      .where(gte(calls.createdAt, startDate))
      .groupBy(calls.companyId, companies.name)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    const topCompanies: CallsByCompany[] = companyStats.map((stat) => ({
      companyId: stat.companyId,
      companyName: stat.companyName || "Unknown",
      totalCalls: Number(stat.totalCalls),
      totalDuration: Number(stat.totalDuration),
      avgDuration: Math.round(Number(stat.avgDuration)),
      successRate:
        Number(stat.totalCalls) > 0
          ? Math.round(
              (Number(stat.completedCalls) / Number(stat.totalCalls)) * 100
            )
          : 0,
    }));

    // ========================================================================
    // Daily Call Data (for charts)
    // ========================================================================

    const dailyStats = await db
      .select({
        date: sql<string>`date(${calls.createdAt})`,
        totalCalls: sql<number>`count(*)`,
        completedCalls: sql<number>`count(*) filter (where ${calls.status} = 'completed')`,
        failedCalls: sql<number>`count(*) filter (where ${calls.status} = 'failed')`,
        totalDuration: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)`,
      })
      .from(calls)
      .where(gte(calls.createdAt, startDate))
      .groupBy(sql`date(${calls.createdAt})`)
      .orderBy(sql`date(${calls.createdAt})`);

    const dailyData: CallDataPoint[] = dailyStats.map((stat) => ({
      date: stat.date,
      totalCalls: Number(stat.totalCalls),
      completedCalls: Number(stat.completedCalls),
      failedCalls: Number(stat.failedCalls),
      totalDuration: Number(stat.totalDuration),
    }));

    // ========================================================================
    // Calculate Growth
    // ========================================================================

    const calcGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const currentTotal = Number(currentMetrics?.totalCalls ?? 0);
    const previousTotal = Number(previousMetrics?.totalCalls ?? 0);
    const currentCompleted = Number(currentMetrics?.completedCalls ?? 0);
    const previousCompleted = Number(previousMetrics?.completedCalls ?? 0);
    const currentDuration = Number(currentMetrics?.totalDurationSeconds ?? 0);
    const previousDuration = Number(previousMetrics?.totalDurationSeconds ?? 0);

    const currentSuccessRate =
      currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0;
    const previousSuccessRate =
      previousTotal > 0
        ? Math.round((previousCompleted / previousTotal) * 100)
        : 0;

    // ========================================================================
    // Build Response
    // ========================================================================

    const overview: CallAnalyticsOverview = {
      totalCalls: currentTotal,
      callsGrowth: calcGrowth(currentTotal, previousTotal),
      completedCalls: currentCompleted,
      failedCalls: Number(currentMetrics?.failedCalls ?? 0),
      successRate: currentSuccessRate,
      successRateGrowth: currentSuccessRate - previousSuccessRate,
      totalDurationMinutes: Math.round(currentDuration / 60),
      averageDurationSeconds: Math.round(
        Number(currentMetrics?.avgDurationSeconds ?? 0)
      ),
      durationGrowth: calcGrowth(currentDuration, previousDuration),
      totalTurns: Number(currentMetrics?.totalTurns ?? 0),
      averageTurns: Math.round(Number(currentMetrics?.avgTurns ?? 0)),
    };

    const response: CallAnalyticsResponse = {
      overview,
      byProvider,
      bySource,
      byStatus,
      topCompanies,
      dailyData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch call analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch call analytics" },
      { status: 500 }
    );
  }
}
