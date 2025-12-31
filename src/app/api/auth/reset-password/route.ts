import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { withRateLimit } from "@/lib/redis/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    // Rate limiting: 10 password reset attempts per minute per IP
    const rateLimitResult = await withRateLimit(request, "auth");
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Find valid token
    const verificationToken = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.token, token),
        gt(verificationTokens.expires, new Date())
      ),
    });

    if (!verificationToken) {
      return NextResponse.json(
        { message: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, verificationToken.identifier),
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await db
      .update(users)
      .set({
        hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Delete the used token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token));

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid input" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to reset password" },
      { status: 500 }
    );
  }
}
