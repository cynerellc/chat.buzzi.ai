/**
 * Call Analytics API
 *
 * Returns analytics data for voice calls within a company.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, callTranscripts } from "@/lib/db/schema/calls";
import { chatbots } from "@/lib/db/schema/chatbots";
import { eq, and, gte, sql, count, avg, sum, desc } from "drizzle-orm";
import { requireCompanyAdmin } from "@/lib/auth/guards";

// ============================================================================
// Types
// ============================================================================

export interface CallAnalyticsResponse {
  summary: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    successRate: number;
    averageDurationSeconds: number | null;
    totalDurationSeconds: number;
    totalTurns: number;
    averageTurns: number | null;
  };
  dailyMetrics: Array<{
    date: string;
    calls: number;
    completed: number;
    failed: number;
    totalDuration: number;
  }>;
  sourceBreakdown: Record<string, number>;
  aiProviderBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  topChatbots: Array<{
    chatbotId: string;
    chatbotName: string;
    totalCalls: number;
    completedCalls: number;
    averageDuration: number | null;
  }>;
  recentCalls: Array<{
    id: string;
    chatbotName: string;
    source: string;
    aiProvider: string;
    status: string;
    durationSeconds: number | null;
    createdAt: string;
    endReason: string | null;
  }>;
  dateRange: {
    start: string;
    end: string;
  };
}

// ============================================================================
// GET - Get Call Analytics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const { company } = await requireCompanyAdmin();

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30", 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Summary stats
    const [summaryResult] = await db
      .select({
        totalCalls: count(calls.id),
        completedCalls: count(
          sql`CASE WHEN ${calls.status} = 'completed' THEN 1 END`
        ),
        failedCalls: count(
          sql`CASE WHEN ${calls.status} = 'failed' THEN 1 END`
        ),
        averageDurationSeconds: avg(calls.durationSeconds),
        totalDurationSeconds: sum(calls.durationSeconds),
        totalTurns: sum(calls.totalTurns),
        averageTurns: avg(calls.totalTurns),
      })
      .from(calls)
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      );

    const summary = {
      totalCalls: Number(summaryResult?.totalCalls || 0),
      completedCalls: Number(summaryResult?.completedCalls || 0),
      failedCalls: Number(summaryResult?.failedCalls || 0),
      successRate:
        summaryResult && Number(summaryResult.totalCalls) > 0
          ? Math.round(
              (Number(summaryResult.completedCalls) /
                Number(summaryResult.totalCalls)) *
                100
            )
          : 0,
      averageDurationSeconds: summaryResult?.averageDurationSeconds
        ? Math.round(Number(summaryResult.averageDurationSeconds))
        : null,
      totalDurationSeconds: Number(summaryResult?.totalDurationSeconds || 0),
      totalTurns: Number(summaryResult?.totalTurns || 0),
      averageTurns: summaryResult?.averageTurns
        ? Math.round(Number(summaryResult.averageTurns))
        : null,
    };

    // Daily metrics
    const dailyMetricsResult = await db
      .select({
        date: sql<string>`DATE(${calls.createdAt})`.as("date"),
        calls: count(calls.id),
        completed: count(
          sql`CASE WHEN ${calls.status} = 'completed' THEN 1 END`
        ),
        failed: count(sql`CASE WHEN ${calls.status} = 'failed' THEN 1 END`),
        totalDuration: sum(calls.durationSeconds),
      })
      .from(calls)
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(${calls.createdAt})`)
      .orderBy(sql`DATE(${calls.createdAt})`);

    const dailyMetrics = dailyMetricsResult.map((row) => ({
      date: row.date,
      calls: Number(row.calls),
      completed: Number(row.completed),
      failed: Number(row.failed),
      totalDuration: Number(row.totalDuration || 0),
    }));

    // Source breakdown
    const sourceResult = await db
      .select({
        source: calls.source,
        count: count(calls.id),
      })
      .from(calls)
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      )
      .groupBy(calls.source);

    const sourceBreakdown: Record<string, number> = {};
    sourceResult.forEach((row) => {
      sourceBreakdown[row.source] = Number(row.count);
    });

    // AI Provider breakdown
    const aiProviderResult = await db
      .select({
        aiProvider: calls.aiProvider,
        count: count(calls.id),
      })
      .from(calls)
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      )
      .groupBy(calls.aiProvider);

    const aiProviderBreakdown: Record<string, number> = {};
    aiProviderResult.forEach((row) => {
      aiProviderBreakdown[row.aiProvider] = Number(row.count);
    });

    // Status breakdown
    const statusResult = await db
      .select({
        status: calls.status,
        count: count(calls.id),
      })
      .from(calls)
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      )
      .groupBy(calls.status);

    const statusBreakdown: Record<string, number> = {};
    statusResult.forEach((row) => {
      statusBreakdown[row.status] = Number(row.count);
    });

    // Top chatbots by call volume
    const topChatbotsResult = await db
      .select({
        chatbotId: calls.chatbotId,
        chatbotName: chatbots.name,
        totalCalls: count(calls.id),
        completedCalls: count(
          sql`CASE WHEN ${calls.status} = 'completed' THEN 1 END`
        ),
        averageDuration: avg(calls.durationSeconds),
      })
      .from(calls)
      .innerJoin(chatbots, eq(calls.chatbotId, chatbots.id))
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      )
      .groupBy(calls.chatbotId, chatbots.name)
      .orderBy(desc(count(calls.id)))
      .limit(5);

    const topChatbots = topChatbotsResult.map((row) => ({
      chatbotId: row.chatbotId,
      chatbotName: row.chatbotName,
      totalCalls: Number(row.totalCalls),
      completedCalls: Number(row.completedCalls),
      averageDuration: row.averageDuration
        ? Math.round(Number(row.averageDuration))
        : null,
    }));

    // Recent calls
    const recentCallsResult = await db
      .select({
        id: calls.id,
        chatbotName: chatbots.name,
        source: calls.source,
        aiProvider: calls.aiProvider,
        status: calls.status,
        durationSeconds: calls.durationSeconds,
        createdAt: calls.createdAt,
        endReason: calls.endReason,
      })
      .from(calls)
      .innerJoin(chatbots, eq(calls.chatbotId, chatbots.id))
      .where(
        and(
          eq(calls.companyId, company.id),
          gte(calls.createdAt, startDate)
        )
      )
      .orderBy(desc(calls.createdAt))
      .limit(10);

    const recentCalls = recentCallsResult.map((row) => ({
      id: row.id,
      chatbotName: row.chatbotName,
      source: row.source,
      aiProvider: row.aiProvider,
      status: row.status,
      durationSeconds: row.durationSeconds,
      createdAt: row.createdAt.toISOString(),
      endReason: row.endReason,
    }));

    const response: CallAnalyticsResponse = {
      summary,
      dailyMetrics,
      sourceBreakdown,
      aiProviderBreakdown,
      statusBreakdown,
      topChatbots,
      recentCalls,
      dateRange: {
        start: startDate.toISOString().split("T")[0] ?? startDate.toISOString(),
        end: endDate.toISOString().split("T")[0] ?? endDate.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[CallAnalyticsAPI] Error:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch call analytics" },
      { status: 500 }
    );
  }
}
