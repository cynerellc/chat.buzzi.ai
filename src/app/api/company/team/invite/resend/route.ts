import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { invitations } from "@/lib/db/schema";

interface ResendRequest {
  invitationId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { user: currentUser, company } = await requireCompanyAdmin();

    const body: ResendRequest = await request.json();

    if (!body.invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Get the invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, body.invitationId),
          eq(invitations.companyId, company.id)
        )
      )
      .limit(1);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status === "accepted") {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    if (invitation.status === "revoked") {
      return NextResponse.json(
        { error: "This invitation has been revoked" },
        { status: 400 }
      );
    }

    // Generate new token and expiration
    const newToken = randomBytes(32).toString("hex");
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

    // Update the invitation
    const [updatedInvitation] = await db
      .update(invitations)
      .set({
        token: newToken,
        expiresAt: newExpiresAt,
        status: "pending",
        invitedBy: currentUser.id,
      })
      .where(eq(invitations.id, body.invitationId))
      .returning();

    if (!updatedInvitation) {
      return NextResponse.json(
        { error: "Failed to update invitation" },
        { status: 500 }
      );
    }

    // TODO: Send invitation email with new link
    // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${newToken}`;
    // await sendInvitationEmail(invitation.email, inviteUrl, company.name, currentUser.name);

    return NextResponse.json({
      invitation: {
        id: updatedInvitation.id,
        email: updatedInvitation.email,
        role: updatedInvitation.role,
        status: updatedInvitation.status,
        expiresAt: updatedInvitation.expiresAt.toISOString(),
      },
      message: `Invitation resent to ${invitation.email}`,
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
