import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { auditLogs, companies, users } from "@/lib/db/schema";

export interface AuditLogDetails {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  companyId: string | null;
  companyName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  try {
    await requireMasterAdmin();

    const { logId } = await params;

    const [logData] = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        userName: users.name,
        userRole: users.role,
        companyId: auditLogs.companyId,
        companyName: companies.name,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(companies, eq(auditLogs.companyId, companies.id))
      .where(eq(auditLogs.id, logId))
      .limit(1);

    if (!logData) {
      return NextResponse.json(
        { error: "Audit log not found" },
        { status: 404 }
      );
    }

    const response: AuditLogDetails = {
      id: logData.id,
      userId: logData.userId,
      userName: logData.userName,
      userEmail: logData.userEmail,
      userRole: logData.userRole,
      companyId: logData.companyId,
      companyName: logData.companyName,
      action: logData.action,
      resource: logData.resource,
      resourceId: logData.resourceId,
      details: logData.details as Record<string, unknown>,
      oldValues: logData.oldValues as Record<string, unknown> | null,
      newValues: logData.newValues as Record<string, unknown> | null,
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
      createdAt: logData.createdAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch audit log details:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log details" },
      { status: 500 }
    );
  }
}
