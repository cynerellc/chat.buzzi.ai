/**
 * Magic Link Authentication Service
 *
 * Handles passwordless authentication via email magic links.
 */

import { eq, and, lt, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/lib/db";
import { magicLinkTokens, users } from "@/lib/db/schema";

// ============================================================================
// Constants
// ============================================================================

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MAGIC_LINK_BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ============================================================================
// Types
// ============================================================================

export interface MagicLinkResult {
  success: boolean;
  error?: string;
  token?: string;
  expiresAt?: Date;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  userId?: string;
  email?: string;
}

// ============================================================================
// Magic Link Functions
// ============================================================================

/**
 * Generate a magic link token for an email
 */
export async function generateMagicLink(email: string): Promise<MagicLinkResult> {
  // Check if user exists
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    // For security, don't reveal if user exists
    // Return success but don't actually send (or create a link to registration)
    return { success: true };
  }

  // Check if user is active
  if (!user.isActive || user.status !== "active") {
    return { success: false, error: "Account is not active" };
  }

  // Generate token
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_EXPIRY_MINUTES);

  // Invalidate any existing tokens for this email
  await db
    .delete(magicLinkTokens)
    .where(eq(magicLinkTokens.email, email.toLowerCase()));

  // Create new token
  await db.insert(magicLinkTokens).values({
    email: email.toLowerCase(),
    token,
    expiresAt,
  });

  return {
    success: true,
    token,
    expiresAt,
  };
}

/**
 * Get the magic link URL for a token
 */
export function getMagicLinkUrl(token: string): string {
  return `${MAGIC_LINK_BASE_URL}/api/auth/magic-link/verify?token=${token}`;
}

/**
 * Verify a magic link token
 */
export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  // Find the token
  const magicToken = await db.query.magicLinkTokens.findFirst({
    where: and(
      eq(magicLinkTokens.token, token),
      isNull(magicLinkTokens.usedAt)
    ),
  });

  if (!magicToken) {
    return { success: false, error: "Invalid or expired link" };
  }

  // Check if expired
  if (new Date() > magicToken.expiresAt) {
    // Clean up expired token
    await db.delete(magicLinkTokens).where(eq(magicLinkTokens.id, magicToken.id));
    return { success: false, error: "Link has expired" };
  }

  // Mark as used
  await db
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.id, magicToken.id));

  // Find the user
  const user = await db.query.users.findFirst({
    where: eq(users.email, magicToken.email),
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Update email verified timestamp if not already set
  if (!user.emailVerified) {
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, user.id));
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return {
    success: true,
    userId: user.id,
    email: user.email,
  };
}

/**
 * Clean up expired magic link tokens
 */
export async function cleanupExpiredMagicLinks(): Promise<number> {
  const result = await db
    .delete(magicLinkTokens)
    .where(lt(magicLinkTokens.expiresAt, new Date()))
    .returning();

  return result.length;
}

// ============================================================================
// Email Sending (stub - integrate with actual email service)
// ============================================================================

export interface SendMagicLinkEmailOptions {
  email: string;
  token: string;
  expiresAt: Date;
}

/**
 * Send magic link email
 * This is a stub - integrate with Resend or another email service
 */
export async function sendMagicLinkEmail(
  options: SendMagicLinkEmailOptions
): Promise<{ success: boolean; error?: string }> {
  const { email, token, expiresAt } = options;
  const magicLinkUrl = getMagicLinkUrl(token);

  // In development, log the link
  if (process.env.NODE_ENV === "development") {
    console.log("\n========================================");
    console.log("MAGIC LINK (Development)");
    console.log("========================================");
    console.log(`Email: ${email}`);
    console.log(`Link: ${magicLinkUrl}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    console.log("========================================\n");
    return { success: true };
  }

  // Production: Use Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "noreply@example.com",
        to: email,
        subject: "Sign in to your account",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Sign in to your account</h1>
            <p>Click the button below to sign in. This link will expire in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
            <a href="${magicLinkUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Sign In
            </a>
            <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">This link expires at ${expiresAt.toLocaleString()}</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message ?? "Failed to send email" };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send magic link email:", error);
    return { success: false, error: "Failed to send email" };
  }
}
