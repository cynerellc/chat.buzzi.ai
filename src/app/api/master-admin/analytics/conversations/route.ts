import { sql, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { dailyAnalytics } from "@/lib/db/schema";

export interface ConversationDataPoint {
  date: string;
  total: number;
  aiResolved: number;
  humanResolved: number;
  escalated: number;
}

export interface ConversationsAnalyticsResponse {
  data: ConversationDataPoint[];
  summary: {
    total: number;
    aiResolved: number;
    humanResolved: number;
    escalated: number;
    avgPerDay: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const startDateStr = start.toISOString().split('T')[0] as string;
    const endDateStr = end.toISOString().split('T')[0] as string;

    // Get daily data aggregated across all companies
    const dailyData = await db
      .select({
        date: dailyAnalytics.date,
        total: sql<number>`coalesce(sum(${dailyAnalytics.totalConversations}), 0)`,
        aiResolved: sql<number>`coalesce(sum(${dailyAnalytics.aiResolvedCount}), 0)`,
        humanResolved: sql<number>`coalesce(sum(${dailyAnalytics.humanResolvedCount}), 0)`,
        escalated: sql<number>`coalesce(sum(${dailyAnalytics.escalatedConversations}), 0)`,
      })
      .from(dailyAnalytics)
      .where(
        and(
          gte(dailyAnalytics.date, startDateStr),
          lte(dailyAnalytics.date, endDateStr)
        )
      )
      .groupBy(dailyAnalytics.date)
      .orderBy(dailyAnalytics.date);

    // Transform to response format
    const data: ConversationDataPoint[] = dailyData.map((row) => ({
      date: row.date,
      total: Number(row.total),
      aiResolved: Number(row.aiResolved),
      humanResolved: Number(row.humanResolved),
      escalated: Number(row.escalated),
    }));

    // Calculate summary
    const totalConversations = data.reduce((sum, d) => sum + d.total, 0);
    const totalAiResolved = data.reduce((sum, d) => sum + d.aiResolved, 0);
    const totalHumanResolved = data.reduce((sum, d) => sum + d.humanResolved, 0);
    const totalEscalated = data.reduce((sum, d) => sum + d.escalated, 0);

    const response: ConversationsAnalyticsResponse = {
      data,
      summary: {
        total: totalConversations,
        aiResolved: totalAiResolved,
        humanResolved: totalHumanResolved,
        escalated: totalEscalated,
        avgPerDay: data.length > 0 ? Math.round(totalConversations / data.length) : 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch conversations analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations analytics" },
      { status: 500 }
    );
  }
}
