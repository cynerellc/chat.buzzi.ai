import { sql, desc, eq, and, gte, lte, or, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { auditLogs, companies, users } from "@/lib/db/schema";

export interface AuditLogListItem {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogsListResponse {
  logs: AuditLogListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10);
    const action = searchParams.get("action");
    const resource = searchParams.get("resource");
    const userId = searchParams.get("userId");
    const companyId = searchParams.get("companyId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    // Build conditions
    const conditions = [];

    if (action) {
      conditions.push(ilike(auditLogs.action, `${action}%`));
    }

    if (resource) {
      conditions.push(eq(auditLogs.resource, resource));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (companyId) {
      conditions.push(eq(auditLogs.companyId, companyId));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, end));
    }

    if (search) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.userEmail, `%${search}%`),
          ilike(auditLogs.resource, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // Get logs with related data
    const logsData = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        userName: users.name,
        companyId: auditLogs.companyId,
        companyName: companies.name,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(companies, eq(auditLogs.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const logs: AuditLogListItem[] = logsData.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName,
      userEmail: log.userEmail,
      companyId: log.companyId,
      companyName: log.companyName,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }));

    const response: AuditLogsListResponse = {
      logs,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
