/**
 * Magic Link API
 *
 * POST - Request a magic link to be sent to an email
 */

import { NextRequest, NextResponse } from "next/server";

import {
  generateMagicLink,
  sendMagicLinkEmail,
} from "@/lib/auth/magic-link";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Generate magic link
    const result = await generateMagicLink(email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to generate magic link" },
        { status: 400 }
      );
    }

    // Send email if token was generated
    if (result.token && result.expiresAt) {
      const emailResult = await sendMagicLinkEmail({
        email,
        token: result.token,
        expiresAt: result.expiresAt,
      });

      if (!emailResult.success) {
        console.error("Failed to send magic link email:", emailResult.error);
        // Don't expose email sending errors to users
      }
    }

    // Always return success for security (don't reveal if email exists)
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a magic link has been sent.",
    });
  } catch (error) {
    console.error("Magic link request failed:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
