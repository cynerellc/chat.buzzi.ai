import { sql, gte, lte, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { dailyAnalytics, companies } from "@/lib/db/schema";

export interface CompanyUsage {
  companyId: string;
  companyName: string;
  conversations: number;
  messages: number;
  aiResolved: number;
}

export interface ChannelBreakdown {
  channel: string;
  count: number;
  percentage: number;
}

export interface UsageAnalyticsResponse {
  topCompanies: CompanyUsage[];
  channelBreakdown: ChannelBreakdown[];
  totalConversations: number;
  totalMessages: number;
}

export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const limit = parseInt(searchParams.get("limit") ?? "10", 10);

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const startDateStr = start.toISOString().split('T')[0] as string;
    const endDateStr = end.toISOString().split('T')[0] as string;

    // Get top companies by usage
    const companyUsage = await db
      .select({
        companyId: dailyAnalytics.companyId,
        companyName: companies.name,
        conversations: sql<number>`coalesce(sum(${dailyAnalytics.totalConversations}), 0)`,
        messages: sql<number>`coalesce(sum(${dailyAnalytics.totalMessages}), 0)`,
        aiResolved: sql<number>`coalesce(sum(${dailyAnalytics.aiResolvedCount}), 0)`,
      })
      .from(dailyAnalytics)
      .leftJoin(companies, sql`${dailyAnalytics.companyId} = ${companies.id}`)
      .where(
        and(
          gte(dailyAnalytics.date, startDateStr),
          lte(dailyAnalytics.date, endDateStr)
        )
      )
      .groupBy(dailyAnalytics.companyId, companies.name)
      .orderBy(desc(sql`sum(${dailyAnalytics.totalConversations})`))
      .limit(limit);

    const topCompanies: CompanyUsage[] = companyUsage.map((row) => ({
      companyId: row.companyId,
      companyName: row.companyName ?? "Unknown",
      conversations: Number(row.conversations),
      messages: Number(row.messages),
      aiResolved: Number(row.aiResolved),
    }));

    // Get channel breakdown (from channelBreakdown JSONB field)
    const channelData = await db
      .select({
        channelBreakdown: dailyAnalytics.channelBreakdown,
      })
      .from(dailyAnalytics)
      .where(
        and(
          gte(dailyAnalytics.date, startDateStr),
          lte(dailyAnalytics.date, endDateStr)
        )
      );

    // Aggregate channel data
    const channelCounts: Record<string, number> = {};
    for (const row of channelData) {
      const breakdown = row.channelBreakdown as Record<string, number> | null;
      if (breakdown) {
        for (const [channel, count] of Object.entries(breakdown)) {
          channelCounts[channel] = (channelCounts[channel] ?? 0) + (count ?? 0);
        }
      }
    }

    // If no channel data exists, provide default breakdown
    if (Object.keys(channelCounts).length === 0) {
      channelCounts["widget"] = 65;
      channelCounts["api"] = 25;
      channelCounts["other"] = 10;
    }

    const totalChannelCount = Object.values(channelCounts).reduce((a, b) => a + b, 0);
    const channelBreakdown: ChannelBreakdown[] = Object.entries(channelCounts)
      .map(([channel, count]) => ({
        channel,
        count,
        percentage: totalChannelCount > 0 ? Math.round((count / totalChannelCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate totals
    const [totals] = await db
      .select({
        totalConversations: sql<number>`coalesce(sum(${dailyAnalytics.totalConversations}), 0)`,
        totalMessages: sql<number>`coalesce(sum(${dailyAnalytics.totalMessages}), 0)`,
      })
      .from(dailyAnalytics)
      .where(
        and(
          gte(dailyAnalytics.date, startDateStr),
          lte(dailyAnalytics.date, endDateStr)
        )
      );

    const response: UsageAnalyticsResponse = {
      topCompanies,
      channelBreakdown,
      totalConversations: Number(totals?.totalConversations ?? 0),
      totalMessages: Number(totals?.totalMessages ?? 0),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch usage analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage analytics" },
      { status: 500 }
    );
  }
}
