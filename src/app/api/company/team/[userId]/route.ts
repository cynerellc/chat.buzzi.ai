import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companyPermissions, users } from "@/lib/db/schema";
import type { CompanyPermissionRole } from "@/lib/db/schema/company-permissions";

interface UpdateMemberRequest {
  role?: CompanyPermissionRole;
  status?: "active" | "inactive" | "suspended";
}

// Update team member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user: currentUser, company } = await requireCompanyAdmin();
    const { userId } = await params;

    // Cannot modify yourself
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot modify your own account from here" },
        { status: 400 }
      );
    }

    // Verify user belongs to company via company_permissions
    const [memberPermission] = await db
      .select({
        permissionId: companyPermissions.id,
        userId: users.id,
        userRole: users.role,
        companyRole: companyPermissions.role,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(and(eq(users.id, userId), eq(companyPermissions.companyId, company.id)))
      .limit(1);

    if (!memberPermission) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Cannot modify master admins
    if (memberPermission.userRole === "chatapp.master_admin") {
      return NextResponse.json(
        { error: "Cannot modify master admin accounts" },
        { status: 403 }
      );
    }

    const body: UpdateMemberRequest = await request.json();

    // Handle role update (update in company_permissions)
    if (body.role !== undefined) {
      if (!["chatapp.company_admin", "chatapp.support_agent"].includes(body.role)) {
        return NextResponse.json(
          { error: "Role must be 'chatapp.company_admin' or 'chatapp.support_agent'" },
          { status: 400 }
        );
      }
      await db
        .update(companyPermissions)
        .set({ role: body.role, updatedAt: new Date() })
        .where(eq(companyPermissions.id, memberPermission.permissionId));
    }

    // Handle status update (update in users)
    if (body.status !== undefined) {
      if (!["active", "inactive", "suspended"].includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      await db
        .update(users)
        .set({
          status: body.status,
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
      .where(and(eq(users.id, userId), eq(companyPermissions.companyId, company.id)))
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
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

// Remove team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user: currentUser, company } = await requireCompanyAdmin();
    const { userId } = await params;

    // Cannot remove yourself
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the team" },
        { status: 400 }
      );
    }

    // Verify user belongs to company via company_permissions
    const [memberPermission] = await db
      .select({
        permissionId: companyPermissions.id,
        userRole: users.role,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(and(eq(users.id, userId), eq(companyPermissions.companyId, company.id)))
      .limit(1);

    if (!memberPermission) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
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
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
