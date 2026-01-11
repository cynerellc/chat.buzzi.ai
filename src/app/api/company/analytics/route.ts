import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { dailyAnalytics, hourlyAnalytics, topicAnalytics, conversations } from "@/lib/db/schema";

export interface AnalyticsSummary {
  totalConversations: number;
  resolvedConversations: number;
  escalatedConversations: number;
  averageResolutionTime: number | null;
  satisfactionScore: number | null;
  aiResolutionRate: number;
}

export interface DailyMetric {
  date: string;
  conversations: number;
  messages: number;
  resolved: number;
  escalated: number;
}

export interface HourlyMetric {
  hour: string;
  conversations: number;
  messages: number;
}

export interface TopicItem {
  topic: string;
  occurrences: number;
  sentiment: number | null;
  resolutionRate: number | null;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  dailyMetrics: DailyMetric[];
  hourlyMetrics: HourlyMetric[];
  topTopics: TopicItem[];
  channelBreakdown: Record<string, number>;
  dateRange: {
    start: string;
    end: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    // Get date range from query params (default: last 30 days)
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? parseInt(daysParam) : 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      return date.toISOString().slice(0, 10);
    };
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Get daily analytics
    const dailyData = await db
      .select()
      .from(dailyAnalytics)
      .where(
        and(
          eq(dailyAnalytics.companyId, company.id),
          gte(dailyAnalytics.date, startDateStr),
          lte(dailyAnalytics.date, endDateStr)
        )
      )
      .orderBy(dailyAnalytics.date);

    // Get hourly analytics for the last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const hourlyData = await db
      .select()
      .from(hourlyAnalytics)
      .where(
        and(
          eq(hourlyAnalytics.companyId, company.id),
          gte(hourlyAnalytics.hour, yesterday)
        )
      )
      .orderBy(hourlyAnalytics.hour);

    // Get top topics
    const topicsData = await db
      .select()
      .from(topicAnalytics)
      .where(eq(topicAnalytics.companyId, company.id))
      .orderBy(desc(topicAnalytics.occurrences))
      .limit(10);

    // Calculate summary from daily data
    const totalConversations = dailyData.reduce((sum, d) => sum + d.totalConversations, 0);
    const resolvedConversations = dailyData.reduce((sum, d) => sum + d.resolvedConversations, 0);
    const escalatedConversations = dailyData.reduce((sum, d) => sum + d.escalatedConversations, 0);
    const aiResolved = dailyData.reduce((sum, d) => sum + d.aiResolvedCount, 0);
    const humanResolved = dailyData.reduce((sum, d) => sum + d.humanResolvedCount, 0);

    // Calculate averages
    const resolutionTimes = dailyData.filter(d => d.avgResolutionTime !== null).map(d => d.avgResolutionTime!);
    const avgResolutionTime = resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : null;

    const satisfactionScores = dailyData
      .filter(d => d.avgSatisfactionScore !== null)
      .map(d => parseFloat(d.avgSatisfactionScore!));
    const avgSatisfactionScore = satisfactionScores.length > 0
      ? parseFloat((satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length).toFixed(2))
      : null;

    const totalResolved = aiResolved + humanResolved;
    const aiResolutionRate = totalResolved > 0 ? (aiResolved / totalResolved) * 100 : 0;

    // Aggregate channel breakdown
    const channelBreakdown: Record<string, number> = {};
    dailyData.forEach(d => {
      const channels = d.channelBreakdown as Record<string, number> | null;
      if (channels) {
        Object.entries(channels).forEach(([channel, count]) => {
          channelBreakdown[channel] = (channelBreakdown[channel] || 0) + count;
        });
      }
    });

    // If no analytics data, generate from conversations table
    if (dailyData.length === 0) {
      // Get real conversation count for the period
      const conversationCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(
          and(
            eq(conversations.companyId, company.id),
            gte(conversations.createdAt, startDate)
          )
        );

      // Return basic stats from conversations table
      const response: AnalyticsResponse = {
        summary: {
          totalConversations: Number(conversationCount[0]?.count ?? 0),
          resolvedConversations: 0,
          escalatedConversations: 0,
          averageResolutionTime: null,
          satisfactionScore: null,
          aiResolutionRate: 0,
        },
        dailyMetrics: [],
        hourlyMetrics: [],
        topTopics: [],
        channelBreakdown: { web: Number(conversationCount[0]?.count ?? 0) },
        dateRange: {
          start: startDateStr,
          end: endDateStr,
        },
      };

      return NextResponse.json(response);
    }

    // Transform data
    const dailyMetrics: DailyMetric[] = dailyData.map(d => ({
      date: d.date,
      conversations: d.totalConversations,
      messages: d.totalMessages,
      resolved: d.resolvedConversations,
      escalated: d.escalatedConversations,
    }));

    const hourlyMetrics: HourlyMetric[] = hourlyData.map(h => ({
      hour: h.hour.toISOString(),
      conversations: h.conversations,
      messages: h.messages,
    }));

    const topTopics: TopicItem[] = topicsData.map(t => ({
      topic: t.topic,
      occurrences: t.occurrences,
      sentiment: t.avgSentiment,
      resolutionRate: t.resolutionRate ? parseFloat(t.resolutionRate) : null,
    }));

    const response: AnalyticsResponse = {
      summary: {
        totalConversations,
        resolvedConversations,
        escalatedConversations,
        averageResolutionTime: avgResolutionTime,
        satisfactionScore: avgSatisfactionScore,
        aiResolutionRate: Math.round(aiResolutionRate),
      },
      dailyMetrics,
      hourlyMetrics,
      topTopics,
      channelBreakdown,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
