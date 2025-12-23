import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

interface UpdateMemberRequest {
  role?: "company_admin" | "support_agent";
  status?: "active" | "inactive" | "suspended";
}

// Update team member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { userId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Cannot modify yourself
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot modify your own account from here" },
        { status: 400 }
      );
    }

    // Verify user belongs to company
    const [member] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.companyId, company.id)))
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Cannot modify master admins
    if (member.role === "master_admin") {
      return NextResponse.json(
        { error: "Cannot modify master admin accounts" },
        { status: 403 }
      );
    }

    const body: UpdateMemberRequest = await request.json();

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.role !== undefined) {
      if (!["company_admin", "support_agent"].includes(body.role)) {
        return NextResponse.json(
          { error: "Role must be 'company_admin' or 'support_agent'" },
          { status: 400 }
        );
      }
      updateData.role = body.role;
    }

    if (body.status !== undefined) {
      if (!["active", "inactive", "suspended"].includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      updateData.status = body.status;
      updateData.isActive = body.status === "active";
    }

    const [updatedMember] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        avatarUrl: users.avatarUrl,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      });

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
    const currentUser = await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { userId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Cannot remove yourself
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the team" },
        { status: 400 }
      );
    }

    // Verify user belongs to company
    const [member] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.companyId, company.id)))
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Cannot remove master admins
    if (member.role === "master_admin") {
      return NextResponse.json(
        { error: "Cannot remove master admin accounts" },
        { status: 403 }
      );
    }

    // Soft delete: set status to inactive and remove from company
    await db
      .update(users)
      .set({
        status: "inactive",
        isActive: false,
        companyId: null, // Remove from company
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ message: "Team member removed successfully" });
  } catch (error) {
    console.error("Error removing team member:", error);
    return NextResponse.json(
      { error: "Failed to remove team member" },
      { status: 500 }
    );
  }
}
