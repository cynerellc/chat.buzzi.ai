/**
 * Widget Session API
 *
 * POST /api/widget/session - Create a new widget chat session
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { conversations, endUsers } from "@/lib/db/schema/conversations";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/redis/rate-limit";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
} from "@/lib/widget/types";

// Session token duration (24 hours)
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 60 session creations per minute per IP (uses widget limiter)
    const rateLimitResult = await withRateLimit(request, "widget");
    if (rateLimitResult) return rateLimitResult;

    const body = (await request.json()) as CreateSessionRequest;
    const { agentId, companyId, customer, pageUrl, referrer, userAgent } = body;

    // 1. Validate required fields
    if (!agentId || !companyId) {
      return NextResponse.json(
        { error: "Missing required fields: agentId and companyId" },
        { status: 400 }
      );
    }

    // 2. Validate origin (if domain restrictions are enabled)
    const origin = request.headers.get("origin");
    const isValidOrigin = await validateWidgetOrigin(companyId, agentId, origin);
    if (!isValidOrigin) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }

    // 3. Verify company exists and is active
    const companyResult = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.status, "active")
        )
      )
      .limit(1);

    if (companyResult.length === 0) {
      return NextResponse.json(
        { error: "Company not found or inactive" },
        { status: 404 }
      );
    }

    // 4. Verify agent exists and is active
    const agentResult = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, companyId),
          eq(agents.status, "active")
        )
      )
      .limit(1);

    if (agentResult.length === 0) {
      return NextResponse.json(
        { error: "Agent not found or inactive" },
        { status: 404 }
      );
    }

    // 5. Find or create end user
    const endUser = await findOrCreateEndUser(companyId, customer, userAgent);

    // 6. Generate session token
    const sessionId = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    // 7. Create conversation with session ID
    const [conversation] = await db
      .insert(conversations)
      .values({
        companyId,
        chatbotId: agentId,
        endUserId: endUser.id,
        channel: "web",
        status: "active",
        pageUrl,
        referrer,
        sessionId, // Store session ID in conversation
        lastMessageAt: new Date(),
      })
      .returning();

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    // 8. Return session info (session is stored in conversation record)

    const response: CreateSessionResponse = {
      sessionId,
      conversationId: conversation.id,
      endUserId: endUser.id,
      expiresAt: expiresAt.toISOString(),
    };

    // Set CORS headers
    const res = NextResponse.json(response);
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return res;
  } catch (error) {
    console.error("Widget session error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  const response = new NextResponse(null, { status: 204 });
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function validateWidgetOrigin(
  companyId: string,
  agentId: string,
  origin: string | null
): Promise<boolean> {
  // In development, allow all origins
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // If no origin, reject (unless it's a server-side request)
  if (!origin) {
    return true; // Allow server-side requests
  }

  // Get agent behavior config
  const agentResult = await db
    .select({ behavior: agents.behavior })
    .from(agents)
    .where(
      and(
        eq(agents.id, agentId),
        eq(agents.companyId, companyId)
      )
    )
    .limit(1);

  if (agentResult.length === 0) {
    return false;
  }

  const agent = agentResult[0];
  const behavior = agent?.behavior as { widgetConfig?: { allowedDomains?: string[] } } | null;
  const allowedDomains = behavior?.widgetConfig?.allowedDomains ?? [];

  // Empty array means all domains allowed
  if (allowedDomains.length === 0) {
    return true;
  }

  try {
    const originHostname = new URL(origin).hostname;
    return allowedDomains.some((domain) => {
      if (domain.startsWith("*.")) {
        // Wildcard subdomain
        const baseDomain = domain.slice(2);
        return (
          originHostname === baseDomain ||
          originHostname.endsWith("." + baseDomain)
        );
      }
      return originHostname === domain;
    });
  } catch {
    return false;
  }
}

async function findOrCreateEndUser(
  companyId: string,
  customer?: CreateSessionRequest["customer"],
  userAgent?: string
) {
  // If customer has an ID, try to find existing user
  if (customer?.id) {
    const existingResult = await db
      .select()
      .from(endUsers)
      .where(
        and(
          eq(endUsers.companyId, companyId),
          eq(endUsers.externalId, customer.id)
        )
      )
      .limit(1);

    if (existingResult.length > 0 && existingResult[0]) {
      // Update user info if provided
      const existing = existingResult[0];
      await db
        .update(endUsers)
        .set({
          name: customer.name ?? existing.name,
          email: customer.email ?? existing.email,
          phone: customer.phone ?? existing.phone,
          avatarUrl: customer.avatarUrl ?? existing.avatarUrl,
          metadata: customer.metadata
            ? { ...(existing.metadata as object), ...customer.metadata }
            : existing.metadata,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(endUsers.id, existing.id));

      return existing;
    }
  }

  // Create new end user
  const [newEndUser] = await db
    .insert(endUsers)
    .values({
      companyId,
      externalId: customer?.id,
      name: customer?.name,
      email: customer?.email,
      phone: customer?.phone,
      avatarUrl: customer?.avatarUrl,
      channel: "web",
      metadata: customer?.metadata ?? {},
      userAgent,
      lastSeenAt: new Date(),
    })
    .returning();

  if (!newEndUser) {
    throw new Error("Failed to create end user");
  }

  return newEndUser;
}

function generateSessionToken(): string {
  // Generate a secure random session token
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
