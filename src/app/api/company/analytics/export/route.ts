import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { conversations, agents, dailyAnalytics } from "@/lib/db/schema";

interface ExportRequest {
  startDate: string;
  endDate: string;
  format: "csv" | "json";
  metrics: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body: ExportRequest = await request.json();

    if (!body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    // Validate date range (max 1 year)
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      return NextResponse.json(
        { error: "Date range cannot exceed 1 year" },
        { status: 400 }
      );
    }

    // Format dates as strings for the date column (not timestamp)
    const startDateStr = body.startDate;
    const endDateStr = body.endDate;

    // Get analytics data
    const analyticsData = await db
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

    // Get conversation stats
    const conversationStats = await db
      .select({
        date: sql<string>`DATE(${conversations.createdAt})`.as("date"),
        total: count(),
        resolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} IS NOT NULL)`.as("resolved"),
        aiResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} = 'ai')`.as("ai_resolved"),
        humanResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} = 'human')`.as("human_resolved"),
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          gte(conversations.createdAt, startDate),
          lte(conversations.createdAt, endDate)
        )
      )
      .groupBy(sql`DATE(${conversations.createdAt})`);

    // Get agent breakdown
    const agentStats = await db
      .select({
        agentId: conversations.agentId,
        agentName: agents.name,
        totalConversations: count(),
        avgMessageCount: sql<number>`AVG(${conversations.messageCount})`.as("avg_messages"),
      })
      .from(conversations)
      .leftJoin(agents, eq(conversations.agentId, agents.id))
      .where(
        and(
          eq(conversations.companyId, company.id),
          gte(conversations.createdAt, startDate),
          lte(conversations.createdAt, endDate)
        )
      )
      .groupBy(conversations.agentId, agents.name);

    // Format data for export
    const exportData = {
      dateRange: {
        start: body.startDate,
        end: body.endDate,
      },
      summary: {
        totalConversations: conversationStats.reduce((sum, d) => sum + Number(d.total), 0),
        totalResolved: conversationStats.reduce((sum, d) => sum + Number(d.resolved), 0),
        aiResolved: conversationStats.reduce((sum, d) => sum + Number(d.aiResolved), 0),
        humanResolved: conversationStats.reduce((sum, d) => sum + Number(d.humanResolved), 0),
      },
      dailyMetrics: analyticsData.map((d) => ({
        date: d.date,
        conversationsStarted: d.newConversations,
        conversationsResolved: d.resolvedConversations,
        messagesTotal: d.totalMessages,
        avgResponseTime: d.avgResponseTime,
        avgSatisfactionScore: d.avgSatisfactionScore,
        escalationRate: d.totalConversations > 0
          ? Math.round((d.escalatedConversations / d.totalConversations) * 100)
          : 0,
      })),
      conversationsByDay: conversationStats.map((d) => ({
        date: d.date,
        total: d.total,
        resolved: d.resolved,
        aiResolved: d.aiResolved,
        humanResolved: d.humanResolved,
      })),
      agentBreakdown: agentStats.map((a) => ({
        agentId: a.agentId,
        agentName: a.agentName,
        totalConversations: a.totalConversations,
        avgMessageCount: Math.round(Number(a.avgMessageCount) * 10) / 10,
      })),
      exportedAt: new Date().toISOString(),
    };

    if (body.format === "csv") {
      // Generate CSV
      const csvRows: string[] = [];

      // Header
      csvRows.push("Date,Conversations Started,Conversations Resolved,Total Messages,Avg Response Time (ms),Avg Satisfaction,Escalation Rate");

      // Data rows
      exportData.dailyMetrics.forEach((d) => {
        csvRows.push(
          [
            d.date,
            d.conversationsStarted,
            d.conversationsResolved,
            d.messagesTotal,
            d.avgResponseTime,
            d.avgSatisfactionScore,
            d.escalationRate,
          ].join(",")
        );
      });

      const csv = csvRows.join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="analytics-${body.startDate}-${body.endDate}.csv"`,
        },
      });
    }

    // Return JSON
    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Error exporting analytics:", error);
    return NextResponse.json(
      { error: "Failed to export analytics" },
      { status: 500 }
    );
  }
}
