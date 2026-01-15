import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { companies, companyPermissions, users } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

const suspendSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  notifyUsers: z.boolean().default(true),
});

const unsuspendSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

/**
 * POST /api/master-admin/companies/[companyId]/suspend
 * Suspend a company account
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireMasterAdmin();
    const { companyId } = await context.params;
    const body = await request.json();
    const data = suspendSchema.parse(body);

    // Check if company exists and is not already suspended
    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name,
        status: companies.status,
      })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    if (company.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot suspend a cancelled company" },
        { status: 400 }
      );
    }

    // Store previous status for potential restoration
    const previousStatus = company.status;

    // Update company status to suspended (using expired as suspended state)
    const [updatedCompany] = await db
      .update(companies)
      .set({
        status: "expired", // Using expired status as suspended
        settings: sql`jsonb_set(
          COALESCE(${companies.settings}, '{}'::jsonb),
          '{suspension}',
          ${JSON.stringify({
            suspendedAt: new Date().toISOString(),
            suspendedBy: session.id,
            reason: data.reason ?? "No reason provided",
            previousStatus,
          })}::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();

    // Optionally deactivate all users (they can't log in)
    if (data.notifyUsers) {
      const companyUserIds = await db
        .select({ userId: companyPermissions.userId })
        .from(companyPermissions)
        .where(eq(companyPermissions.companyId, companyId));

      if (companyUserIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        await db
          .update(users)
          .set({
            status: "suspended",
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(users.id, companyUserIds.map(u => u.userId)),
              sql`${users.deletedAt} IS NULL`
            )
          );
      }
    }

    // Log the suspension
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      companyId: companyId,
      action: "company.suspend",
      resource: "company",
      resourceId: companyId,
      details: {
        companyName: company.name,
        reason: data.reason ?? "No reason provided",
        previousStatus,
        notifyUsers: data.notifyUsers,
      },
    });

    if (!updatedCompany) {
      return NextResponse.json(
        { error: "Failed to update company" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Company suspended successfully",
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        status: updatedCompany.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error suspending company:", error);
    return NextResponse.json(
      { error: "Failed to suspend company" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-admin/companies/[companyId]/suspend
 * Unsuspend (reactivate) a company account
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireMasterAdmin();
    const { companyId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const data = unsuspendSchema.parse(body);

    // Check if company exists and is suspended
    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name,
        status: companies.status,
        settings: companies.settings,
      })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    if (company.status !== "expired") {
      return NextResponse.json(
        { error: "Company is not currently suspended" },
        { status: 400 }
      );
    }

    // Get the previous status from settings
    const settings = company.settings as Record<string, unknown> | null;
    const suspension = settings?.suspension as Record<string, unknown> | undefined;
    const previousStatus = (suspension?.previousStatus as string) ?? "active";

    // Restore company to previous status
    const [updatedCompany] = await db
      .update(companies)
      .set({
        status: previousStatus as typeof company.status,
        settings: sql`${companies.settings} - 'suspension'`, // Remove suspension info
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();

    // Reactivate all users
    const companyUserIds = await db
      .select({ userId: companyPermissions.userId })
      .from(companyPermissions)
      .where(eq(companyPermissions.companyId, companyId));

    if (companyUserIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db
        .update(users)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(users.id, companyUserIds.map(u => u.userId)),
            sql`${users.deletedAt} IS NULL`
          )
        );
    }

    // Log the unsuspension
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      companyId: companyId,
      action: "company.unsuspend",
      resource: "company",
      resourceId: companyId,
      details: {
        companyName: company.name,
        reason: data.reason ?? "No reason provided",
        restoredStatus: previousStatus,
      },
    });

    if (!updatedCompany) {
      return NextResponse.json(
        { error: "Failed to update company" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Company reactivated successfully",
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        status: updatedCompany.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error unsuspending company:", error);
    return NextResponse.json(
      { error: "Failed to reactivate company" },
      { status: 500 }
    );
  }
}
