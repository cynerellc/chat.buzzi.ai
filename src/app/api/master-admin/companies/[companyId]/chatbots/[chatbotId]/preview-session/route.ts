/**
 * Chatbot Preview Session API (Master Admin)
 *
 * POST /api/master-admin/companies/[companyId]/chatbots/[chatbotId]/preview-session
 * Creates a widget session for preview purposes (works with draft chatbots)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { conversations, endUsers } from "@/lib/db/schema/conversations";

interface RouteContext {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

interface CreatePreviewSessionRequest {
  customer?: {
    name?: string;
    email?: string;
  };
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
}

// Session token duration (24 hours)
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    const body: CreatePreviewSessionRequest = await request.json();
    const { customer, pageUrl, referrer, userAgent } = body;

    // Verify company exists
    const companyResult = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (companyResult.length === 0) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Verify chatbot exists (no status check - allows draft chatbots)
    const chatbotResult = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (chatbotResult.length === 0) {
      return NextResponse.json(
        { error: "Chatbot not found" },
        { status: 404 }
      );
    }

    // Find or create end user
    const endUser = await findOrCreateEndUser(
      companyId,
      customer,
      userAgent || request.headers.get("user-agent") || "Unknown"
    );

    // Generate session token
    const sessionId = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    // Create conversation with session ID
    const [conversation] = await db
      .insert(conversations)
      .values({
        companyId,
        chatbotId,
        endUserId: endUser.id,
        status: "active",
        channel: "web",
        sessionId,
        sessionExpiresAt: expiresAt,
        metadata: {
          pageUrl,
          referrer,
          userAgent,
          isPreview: true,
        },
      })
      .returning();

    return NextResponse.json({
      sessionId,
      conversationId: conversation.id,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Preview session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create preview session" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function findOrCreateEndUser(
  companyId: string,
  customer?: { name?: string; email?: string },
  userAgent?: string
) {
  // If customer has email, try to find existing user
  if (customer?.email) {
    const [existingUser] = await db
      .select()
      .from(endUsers)
      .where(
        and(
          eq(endUsers.companyId, companyId),
          eq(endUsers.email, customer.email)
        )
      )
      .limit(1);

    if (existingUser) {
      // Update name if provided and different
      if (customer.name && customer.name !== existingUser.name) {
        const [updated] = await db
          .update(endUsers)
          .set({ name: customer.name })
          .where(eq(endUsers.id, existingUser.id))
          .returning();
        return updated;
      }
      return existingUser;
    }
  }

  // Create new end user
  const [newUser] = await db
    .insert(endUsers)
    .values({
      companyId,
      name: customer?.name || "Preview User",
      email: customer?.email || null,
      metadata: {
        userAgent,
        isPreview: true,
      },
    })
    .returning();

  return newUser;
}

function generateSessionToken(): string {
  return `preview_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
