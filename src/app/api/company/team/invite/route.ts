import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companyPermissions, invitations, users } from "@/lib/db/schema";

interface InviteRequest {
  email: string;
  role: "chatapp.company_admin" | "chatapp.support_agent";
}

export async function POST(request: NextRequest) {
  try {
    const { user: currentUser, company } = await requireCompanyAdmin();

    const body: InviteRequest = await request.json();

    // Validate email
    if (!body.email || !body.email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // Validate role
    if (!["chatapp.company_admin", "chatapp.support_agent"].includes(body.role)) {
      return NextResponse.json(
        { error: "Role must be 'chatapp.company_admin' or 'chatapp.support_agent'" },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();

    // Check if user already exists in this company
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(and(eq(users.email, email), eq(companyPermissions.companyId, company.id)))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists in your team" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation
    const [existingInvitation] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.companyId, company.id),
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

    // Generate invitation token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation
    const [invitation] = await db
      .insert(invitations)
      .values({
        companyId: company.id,
        email,
        role: body.role,
        token,
        expiresAt,
        invitedBy: currentUser.id,
      })
      .returning();

    if (!invitation) {
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // TODO: Send invitation email with link to accept
    // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${token}`;
    // await sendInvitationEmail(email, inviteUrl, company.name, currentUser.name);

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}

// Revoke/cancel an invitation
export async function DELETE(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("id");

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Verify invitation belongs to company and is pending
    const [invitation] = await db
      .select({ id: invitations.id, status: invitations.status })
      .from(invitations)
      .where(
        and(eq(invitations.id, invitationId), eq(invitations.companyId, company.id))
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
