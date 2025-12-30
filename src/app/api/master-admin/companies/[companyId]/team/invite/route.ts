import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, invitations, users } from "@/lib/db/schema";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["chatapp.company_admin", "chatapp.support_agent"]),
});

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// POST /api/master-admin/companies/[companyId]/team/invite - Invite a team member
export async function POST(request: Request, context: RouteContext) {
  try {
    const currentUser = await requireMasterAdmin();

    const { companyId } = await context.params;
    const body = await request.json();
    const data = inviteSchema.parse(body);

    // Check if company exists
    const [company] = await db
      .select({ id: companies.id, name: companies.name })
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

    // Check if user with this email already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Check for pending invitation with same email
    const [existingInvitation] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, data.email),
          eq(invitations.companyId, companyId),
          eq(invitations.status, "pending")
        )
      )
      .limit(1);

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 400 }
      );
    }

    // Create invitation
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const [invitation] = await db
      .insert(invitations)
      .values({
        email: data.email,
        companyId,
        role: data.role,
        token,
        invitedBy: currentUser.id,
        status: "pending",
        expiresAt,
      })
      .returning();

    // TODO: Send invitation email

    return NextResponse.json(
      {
        invitation,
        message: `Invitation sent to ${data.email}`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error sending invitation:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}

// DELETE /api/master-admin/companies/[companyId]/team/invite?id=... - Revoke invitation
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("id");

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

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

    // Verify invitation belongs to company and is pending
    const [invitation] = await db
      .select({ id: invitations.id, status: invitations.status })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.companyId, companyId)
        )
      )
      .limit(1);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invitations can be revoked" },
        { status: 400 }
      );
    }

    // Update invitation status to revoked
    await db
      .update(invitations)
      .set({ status: "revoked" })
      .where(eq(invitations.id, invitationId));

    return NextResponse.json({ message: "Invitation revoked successfully" });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
