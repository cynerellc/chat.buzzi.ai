import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { companies, invitations, users } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { message: "Token is required" },
        { status: 400 }
      );
    }

    // Find valid invitation
    const invitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.token, token),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date())
      ),
    });

    if (!invitation) {
      return NextResponse.json(
        { message: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Get company details
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, invitation.companyId),
    });

    if (!company) {
      return NextResponse.json(
        { message: "Company not found" },
        { status: 404 }
      );
    }

    // Get inviter details
    const inviter = await db.query.users.findFirst({
      where: eq(users.id, invitation.invitedBy),
    });

    return NextResponse.json({
      email: invitation.email,
      companyName: company.name,
      role: invitation.role,
      inviterName: inviter?.name ?? "A team member",
    });
  } catch (error) {
    console.error("Validate invitation error:", error);

    return NextResponse.json(
      { message: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
