/**
 * Magic Link Verification API
 *
 * GET - Verify a magic link token and authenticate the user
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verifyMagicLink } from "@/lib/auth/magic-link";
import { signIn } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
    }

    // Verify the magic link
    const result = await verifyMagicLink(token);

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(result.error ?? "verification_failed")}`, request.url)
      );
    }

    // The user is now verified - redirect to NextAuth callback
    // We'll use a special callback to handle magic link auth
    const callbackUrl = new URL("/api/auth/callback/magic-link", request.url);
    callbackUrl.searchParams.set("userId", result.userId!);
    callbackUrl.searchParams.set("email", result.email!);

    // For security, create a short-lived session token
    const cookieStore = await cookies();
    cookieStore.set("magic-link-verified", result.userId!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60, // 1 minute
      path: "/",
    });

    // Redirect to dashboard after successful verification
    // In a real implementation, you'd integrate with NextAuth's signIn
    return NextResponse.redirect(new URL("/dashboard?magicLinkVerified=true", request.url));
  } catch (error) {
    console.error("Magic link verification failed:", error);
    return NextResponse.redirect(new URL("/login?error=verification_failed", request.url));
  }
}
