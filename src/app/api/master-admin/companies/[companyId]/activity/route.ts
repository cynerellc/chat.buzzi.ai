import { desc, eq, and, gte, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * GET /api/master-admin/companies/[companyId]/activity
 * Get activity log for a specific company
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") ?? "all";
    const timeframe = searchParams.get("timeframe") ?? "7d";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "100", 10);

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;
    switch (timeframe) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Build conditions
    const conditions = [
      eq(auditLogs.companyId, companyId),
      gte(auditLogs.createdAt, startDate),
    ];

    // Apply filter
    if (filter !== "all") {
      switch (filter) {
        case "user":
          conditions.push(ilike(auditLogs.resource, "user%"));
          break;
        case "agent":
          conditions.push(ilike(auditLogs.resource, "agent%"));
          break;
        case "conversation":
          conditions.push(ilike(auditLogs.resource, "conversation%"));
          break;
        case "subscription":
          conditions.push(ilike(auditLogs.resource, "subscription%"));
          break;
        case "settings":
          conditions.push(ilike(auditLogs.resource, "settings%"));
          break;
      }
    }

    // Query activities
    const activitiesData = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        userName: users.name,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const activities: ActivityItem[] = activitiesData.map((activity) => ({
      id: activity.id,
      action: activity.action,
      resource: activity.resource,
      resourceId: activity.resourceId,
      userId: activity.userId,
      userName: activity.userName,
      userEmail: activity.userEmail,
      details: activity.details as Record<string, unknown> | null,
      ipAddress: activity.ipAddress,
      createdAt: activity.createdAt.toISOString(),
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching company activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch company activity" },
      { status: 500 }
    );
  }
}
