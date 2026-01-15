import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companyPermissions, users } from "@/lib/db/schema";
import type { CompanyPermissionRole } from "@/lib/db/schema/company-permissions";

const updateSchema = z.object({
  role: z.enum(["chatapp.company_admin", "chatapp.support_agent"]).optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

interface RouteContext {
  params: Promise<{ companyId: string; userId: string }>;
}

// PATCH /api/master-admin/companies/[companyId]/team/[userId] - Update member
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId, userId } = await context.params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Check if company exists
    const [company] = await db
      .select({ id: companies.id })
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

    // Check if user exists and belongs to company
    const [memberPermission] = await db
      .select({
        permissionId: companyPermissions.id,
        userId: users.id,
        userRole: users.role,
        companyRole: companyPermissions.role,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(users.id, userId),
          eq(companyPermissions.companyId, companyId),
          sql`${users.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!memberPermission) {
      return NextResponse.json(
        { error: "User not found in this company" },
        { status: 404 }
      );
    }

    // Cannot modify master admins
    if (memberPermission.userRole === "chatapp.master_admin") {
      return NextResponse.json(
        { error: "Cannot modify master admin accounts" },
        { status: 403 }
      );
    }

    // Handle role update (update in company_permissions)
    if (data.role !== undefined) {
      await db
        .update(companyPermissions)
        .set({ role: data.role as CompanyPermissionRole, updatedAt: new Date() })
        .where(eq(companyPermissions.id, memberPermission.permissionId));
    }

    // Handle status update (update in users)
    if (data.status !== undefined) {
      await db
        .update(users)
        .set({
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }

    // Fetch updated member
    const [updatedMember] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: companyPermissions.role,
        status: users.status,
        avatarUrl: users.avatarUrl,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(users.id, userId),
          eq(companyPermissions.companyId, companyId)
        )
      )
      .limit(1);

    if (!updatedMember) {
      return NextResponse.json(
        { error: "Failed to update team member" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      member: {
        id: updatedMember.id,
        email: updatedMember.email,
        name: updatedMember.name,
        role: updatedMember.role,
        status: updatedMember.status,
        avatarUrl: updatedMember.avatarUrl,
        lastLoginAt: updatedMember.lastLoginAt?.toISOString() ?? null,
        createdAt: updatedMember.createdAt.toISOString(),
      },
      message: "Team member updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/master-admin/companies/[companyId]/team/[userId] - Remove member
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId, userId } = await context.params;

    // Check if company exists
    const [company] = await db
      .select({ id: companies.id })
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

    // Check if user exists and belongs to company
    const [memberPermission] = await db
      .select({
        permissionId: companyPermissions.id,
        userRole: users.role,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(users.id, userId),
          eq(companyPermissions.companyId, companyId),
          sql`${users.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!memberPermission) {
      return NextResponse.json(
        { error: "User not found in this company" },
        { status: 404 }
      );
    }

    // Cannot remove master admins
    if (memberPermission.userRole === "chatapp.master_admin") {
      return NextResponse.json(
        { error: "Cannot remove master admin accounts" },
        { status: 403 }
      );
    }

    // Remove the company permission (removes user from this company)
    await db
      .delete(companyPermissions)
      .where(eq(companyPermissions.id, memberPermission.permissionId));

    return NextResponse.json({ message: "Team member removed successfully" });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
