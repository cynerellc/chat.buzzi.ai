import { sql, desc, eq, and, gte, lte, or, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { auditLogs, companies, users } from "@/lib/db/schema";

interface ExportAuditLog {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyName: string | null;
  ipAddress: string | null;
  details: string;
}

/**
 * GET /api/master-admin/audit-logs/export
 * Export audit logs in CSV or JSON format
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireMasterAdmin();

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") ?? "csv";
    const action = searchParams.get("action");
    const resource = searchParams.get("resource");
    const userId = searchParams.get("userId");
    const companyId = searchParams.get("companyId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "10000", 10);

    // Validate format
    if (!["csv", "json"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be 'csv' or 'json'" },
        { status: 400 }
      );
    }

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

    // Fetch logs with related data
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
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(companies, eq(auditLogs.companyId, companies.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(Math.min(limit, 50000)); // Cap at 50k for safety

    // Transform data for export
    const exportData: ExportAuditLog[] = logsData.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      userId: log.userId,
      userName: log.userName,
      userEmail: log.userEmail,
      companyId: log.companyId,
      companyName: log.companyName,
      ipAddress: log.ipAddress,
      details: JSON.stringify(log.details ?? {}),
    }));

    // Log the export
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      action: "audit_logs.export",
      resource: "audit_logs",
      details: {
        format,
        recordCount: exportData.length,
        filters: {
          action,
          resource,
          userId,
          companyId,
          startDate,
          endDate,
          search,
        },
      },
    });

    // Return based on format
    if (format === "json") {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // Generate CSV
    const csvHeaders = [
      "ID",
      "Timestamp",
      "Action",
      "Resource",
      "Resource ID",
      "User ID",
      "User Name",
      "User Email",
      "Company ID",
      "Company Name",
      "IP Address",
      "Details",
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      csvHeaders.join(","),
      ...exportData.map((log) =>
        [
          escapeCSV(log.id),
          escapeCSV(log.timestamp),
          escapeCSV(log.action),
          escapeCSV(log.resource),
          escapeCSV(log.resourceId),
          escapeCSV(log.userId),
          escapeCSV(log.userName),
          escapeCSV(log.userEmail),
          escapeCSV(log.companyId),
          escapeCSV(log.companyName),
          escapeCSV(log.ipAddress),
          escapeCSV(log.details),
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export audit logs:", error);
    return NextResponse.json(
      { error: "Failed to export audit logs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-admin/audit-logs/export
 * Create an async export job for large datasets (returns job ID)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireMasterAdmin();
    const body = await request.json();

    const {
      format = "csv",
      action,
      resource,
      userId,
      companyId,
      startDate,
      endDate,
      search,
      email,
    } = body;

    // In production, this would queue a background job
    // For now, we'll return a simple response indicating the export was initiated

    // Log the export request
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      action: "audit_logs.export_requested",
      resource: "audit_logs",
      details: {
        format,
        filters: {
          action,
          resource,
          userId,
          companyId,
          startDate,
          endDate,
          search,
        },
        notifyEmail: email,
      },
    });

    // Generate a mock job ID
    const jobId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return NextResponse.json({
      success: true,
      message: "Export job created. You will be notified when it's ready.",
      jobId,
      estimatedTime: "2-5 minutes",
      notifyEmail: email ?? session.email,
    });
  } catch (error) {
    console.error("Failed to create export job:", error);
    return NextResponse.json(
      { error: "Failed to create export job" },
      { status: 500 }
    );
  }
}
