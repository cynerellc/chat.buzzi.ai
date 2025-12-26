import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companyPermissions, invitations, users } from "@/lib/db/schema";

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
}

export interface TeamResponse {
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export async function GET() {
  try {
    const { user, company } = await requireCompanyAdmin();

    // Get all team members (users belonging to this company via company_permissions)
    const teamMembers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: companyPermissions.role, // Company role from permissions
        status: users.status,
        avatarUrl: users.avatarUrl,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(companyPermissions.companyId, company.id),
          ne(users.role, "chatapp.master_admin") // Exclude master admins
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
          eq(invitations.companyId, company.id),
          eq(invitations.status, "pending")
        )
      )
      .orderBy(invitations.createdAt);

    // Get inviter details for invitations
    const inviterIds = [...new Set(pendingInvitations.map((i) => i.inviterId))];
    let inviters: { id: string; name: string | null; email: string }[] = [];

    if (inviterIds.length > 0) {
      // Get all inviters using inArray for multiple IDs
      const { inArray } = await import("drizzle-orm");
      inviters = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, inviterIds));
    }

    const inviterMap = new Map(inviters.map((i) => [i.id, i]));

    // Transform to response format
    const members: TeamMember[] = teamMembers.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      status: m.status,
      avatarUrl: m.avatarUrl,
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    }));

    const invitationsList: TeamInvitation[] = pendingInvitations.map((i) => {
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

    // If current user is in members, move to front
    const currentUserIndex = members.findIndex((m) => m.id === user.id);
    if (currentUserIndex > 0) {
      const spliced = members.splice(currentUserIndex, 1);
      if (spliced[0]) {
        members.unshift(spliced[0]);
      }
    }

    const response: TeamResponse = {
      members,
      invitations: invitationsList,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
