import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userEmail: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
}

export async function GET(request: Request) {
  try {
    await requireMasterAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const activities = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        userEmail: auditLogs.userEmail,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      items: activities,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
