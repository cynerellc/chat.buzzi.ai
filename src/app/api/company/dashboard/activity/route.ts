import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  userName: string | null;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Get recent activity from audit logs
    const recentActivity = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.companyId, company.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    const activityItems: ActivityItem[] = recentActivity.map((log) => {
      // Generate human-readable description
      let description = "";
      const details = log.details as Record<string, unknown> | null;

      switch (log.action) {
        case "agent.created":
          description = `created agent "${details?.name || "Unknown"}"`;
          break;
        case "agent.updated":
          description = `updated agent "${details?.name || "Unknown"}"`;
          break;
        case "knowledge.created":
          description = `added knowledge source "${details?.title || "Unknown"}"`;
          break;
        case "knowledge.updated":
          description = `updated knowledge source "${details?.title || "Unknown"}"`;
          break;
        case "team.user_invited":
          description = `invited ${details?.email || "a team member"}`;
          break;
        case "team.user_joined":
          description = "joined the team";
          break;
        case "settings.updated":
          description = "updated company settings";
          break;
        case "conversation.resolved":
          description = `resolved conversation`;
          break;
        default:
          description = log.action.replace(/\./g, " ").replace(/_/g, " ");
      }

      return {
        id: log.id,
        action: log.action,
        description,
        userName: log.userName || log.userEmail || "System",
        createdAt: log.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ activities: activityItems });
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity feed" },
      { status: 500 }
    );
  }
}
