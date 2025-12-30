import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companyPermissions, invitations, users } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// GET /api/master-admin/companies/[companyId]/team - Get team members and invitations
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;

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

    // Get all team members (users belonging to this company via company_permissions)
    const teamMembers = await db
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
          eq(companyPermissions.companyId, companyId),
          ne(users.role, "chatapp.master_admin"),
          sql`${users.deletedAt} IS NULL`
        )
      )
      .orderBy(users.createdAt);

    // Get pending invitations
    const pendingInvitations = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        inviterId: invitations.invitedBy,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.companyId, companyId),
          eq(invitations.status, "pending")
        )
      )
      .orderBy(invitations.createdAt);

    // Get inviter details for invitations
    const inviterIds = [...new Set(pendingInvitations.map((i) => i.inviterId))];
    let inviters: { id: string; name: string | null; email: string }[] = [];

    if (inviterIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      inviters = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, inviterIds));
    }

    const inviterMap = new Map(inviters.map((i) => [i.id, i]));

    // Transform to response format
    const members = teamMembers.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      status: m.status,
      avatarUrl: m.avatarUrl,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    }));

    const invitationsList = pendingInvitations.map((i) => {
      const inviter = inviterMap.get(i.inviterId);
      return {
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        expiresAt: i.expiresAt.toISOString(),
        invitedBy: {
          id: i.inviterId,
          name: inviter?.name ?? null,
          email: inviter?.email ?? "Unknown",
        },
        createdAt: i.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      members,
      invitations: invitationsList,
    });
  } catch (error) {
    console.error("Error fetching company team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
