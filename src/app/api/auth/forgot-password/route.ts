import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { db } from "@/lib/db";
import { users, verificationTokens } from "@/lib/db/schema";
import { withRateLimit } from "@/lib/redis/rate-limit";

const forgotPasswordSchema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  try {
    // Rate limiting: 10 password reset requests per minute per IP
    const rateLimitResult = await withRateLimit(request, "auth");
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json(
        { message: "If an account exists, a password reset link will be sent" },
        { status: 200 }
      );
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

    // Delete any existing tokens for this email
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, email));

    // Create new verification token
    await db.insert(verificationTokens).values({
      identifier: email,
      token,
      expires,
    });

    // TODO: Send password reset email
    // In production, integrate with email service (e.g., Resend, SendGrid)
    // The email should contain a link like:
    // ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}

    console.log(`Password reset token for ${email}: ${token}`);

    return NextResponse.json(
      { message: "If an account exists, a password reset link will be sent" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid email address" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to process request" },
      { status: 500 }
    );
  }
}
