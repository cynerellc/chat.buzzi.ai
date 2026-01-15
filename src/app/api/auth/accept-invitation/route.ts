import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { db } from "@/lib/db";
import { companyPermissions, invitations, users } from "@/lib/db/schema";
import type { CompanyPermissionRole } from "@/lib/db/schema/company-permissions";

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(2),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, fullName, password } = acceptInvitationSchema.parse(body);

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

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, invitation.email),
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with base role (company-specific role is via company_permissions)
    const userResult = await db
      .insert(users)
      .values({
        email: invitation.email,
        name: fullName,
        hashedPassword,
        role: "chatapp.user",
        status: "active",
      })
      .returning();

    const user = userResult[0];
    if (!user) {
      throw new Error("Failed to create user");
    }

    // Create company permission for the user with the invited role
    await db.insert(companyPermissions).values({
      companyId: invitation.companyId,
      userId: user.id,
      role: invitation.role as CompanyPermissionRole,
    });

    // Update invitation status
    await db
      .update(invitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedUserId: user.id,
      })
      .where(eq(invitations.id, invitation.id));

    return NextResponse.json(
      {
        message: "Invitation accepted successfully",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Accept invitation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
