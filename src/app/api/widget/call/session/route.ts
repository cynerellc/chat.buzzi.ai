/**
 * Widget Call Session API
 *
 * POST /api/widget/call/session - Create a new widget call session
 *
 * This endpoint creates a call session and returns the sessionId and WebSocket URL
 * for establishing the voice call connection.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatbots } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { endUsers } from "@/lib/db/schema/conversations";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/redis/rate-limit";
import { getCallRunner } from "@/lib/call/execution/call-runner";

// ============================================================================
// Types
// ============================================================================

interface CreateCallSessionRequest {
  chatbotId: string;
  companyId: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
}

interface CreateCallSessionResponse {
  sessionId: string;
  callId: string;
  wsUrl: string;
  expiresAt: string;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 30 call session creations per minute per IP
    const rateLimitResult = await withRateLimit(request, "widget");
    if (rateLimitResult) return rateLimitResult;

    const body = (await request.json()) as CreateCallSessionRequest;
    const { chatbotId, companyId, customer, pageUrl, referrer, userAgent } = body;

    // 1. Validate required fields
    if (!chatbotId || !companyId) {
      return NextResponse.json(
        { error: "Missing required fields: chatbotId and companyId" },
        { status: 400 }
      );
    }

    // 2. Validate origin (if domain restrictions are enabled)
    const origin = request.headers.get("origin");
    const isValidOrigin = await validateWidgetOrigin(companyId, chatbotId, origin);
    if (!isValidOrigin) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    // 3. Verify company exists and is active
    const companyResult = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.status, "active")))
      .limit(1);

    if (companyResult.length === 0) {
      return NextResponse.json(
        { error: "Company not found or inactive" },
        { status: 404 }
      );
    }

    // 4. Verify chatbot exists, is active, and has call enabled
    const chatbotResult = await db
      .select({
        id: chatbots.id,
        enabledCall: chatbots.enabledCall,
        callAiProvider: chatbots.callAiProvider,
        status: chatbots.status,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          eq(chatbots.status, "active")
        )
      )
      .limit(1);

    if (chatbotResult.length === 0) {
      return NextResponse.json(
        { error: "Chatbot not found or inactive" },
        { status: 404 }
      );
    }

    const chatbot = chatbotResult[0];
    if (!chatbot || !chatbot.enabledCall) {
      return NextResponse.json(
        { error: "Call feature not enabled for this chatbot" },
        { status: 403 }
      );
    }

    if (!chatbot.callAiProvider) {
      return NextResponse.json(
        { error: "Call AI provider not configured" },
        { status: 500 }
      );
    }

    // 5. Find or create end user
    const endUser = await findOrCreateEndUser(companyId, customer, userAgent);

    // 6. Create call session via CallRunnerService
    const callRunner = getCallRunner();
    const session = await callRunner.createSession({
      chatbotId,
      companyId,
      endUserId: endUser.id,
      source: "web",
      callerName: customer?.name,
      callerEmail: customer?.email,
      metadata: {
        pageUrl,
        referrer,
        userAgent,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create call session" },
        { status: 500 }
      );
    }

    // 7. Generate WebSocket URL
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${host}/api/widget/call/ws?sessionId=${session.sessionId}`;

    // 8. Return session info
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const response: CreateCallSessionResponse = {
      sessionId: session.sessionId,
      callId: session.callId,
      wsUrl,
      expiresAt: expiresAt.toISOString(),
    };

    // Set CORS headers
    const res = NextResponse.json(response);
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    console.log(`[CallSessionAPI] Created session ${session.sessionId} for call ${session.callId}`);
    return res;
  } catch (error) {
    console.error("[CallSessionAPI] Error:", error);
    return NextResponse.json({ error: "Failed to create call session" }, { status: 500 });
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
  chatbotId: string,
  origin: string | null
): Promise<boolean> {
  // In development, allow all origins
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // If no origin, allow (server-side requests)
  if (!origin) {
    return true;
  }

  // Get chatbot behavior config
  const chatbotResult = await db
    .select({ behavior: chatbots.behavior })
    .from(chatbots)
    .where(and(eq(chatbots.id, chatbotId), eq(chatbots.companyId, companyId)))
    .limit(1);

  if (chatbotResult.length === 0) {
    return false;
  }

  const chatbot = chatbotResult[0];
  const behavior = chatbot?.behavior as { widgetConfig?: { allowedDomains?: string[] } } | null;
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
        return originHostname === baseDomain || originHostname.endsWith("." + baseDomain);
      }
      return originHostname === domain;
    });
  } catch {
    return false;
  }
}

async function findOrCreateEndUser(
  companyId: string,
  customer?: CreateCallSessionRequest["customer"],
  userAgent?: string
) {
  // If customer has an ID, try to find existing user
  if (customer?.id) {
    const existingResult = await db
      .select()
      .from(endUsers)
      .where(and(eq(endUsers.companyId, companyId), eq(endUsers.externalId, customer.id)))
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
          metadata: customer
            ? { ...(existing.metadata as object), phone: customer.phone }
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
      channel: "web",
      metadata: customer || {},
      userAgent,
      lastSeenAt: new Date(),
    })
    .returning();

  if (!newEndUser) {
    throw new Error("Failed to create end user");
  }

  return newEndUser;
}
