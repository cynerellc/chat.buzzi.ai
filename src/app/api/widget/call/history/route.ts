/**
 * Call History API Route
 *
 * GET /api/widget/call/history - Get call history for an end user
 *
 * Query params:
 * - chatbotId: The chatbot ID
 * - endUserId: The end user ID (optional, uses session cookie if not provided)
 * - limit: Max number of calls to return (default 10)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema/calls";
import { eq, and, desc, isNotNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");
    const endUserId = searchParams.get("endUserId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    if (!chatbotId) {
      return NextResponse.json(
        { error: "Missing required parameter: chatbotId" },
        { status: 400 }
      );
    }

    if (!endUserId) {
      return NextResponse.json(
        { error: "Missing required parameter: endUserId" },
        { status: 400 }
      );
    }

    // Fetch call history for this user and chatbot
    const callHistory = await db
      .select({
        id: calls.id,
        status: calls.status,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        endReason: calls.endReason,
        aiProvider: calls.aiProvider,
      })
      .from(calls)
      .where(
        and(
          eq(calls.chatbotId, chatbotId),
          eq(calls.endUserId, endUserId),
          isNotNull(calls.startedAt) // Only include calls that actually started
        )
      )
      .orderBy(desc(calls.startedAt))
      .limit(limit);

    // Format the response
    const history = callHistory.map((call) => ({
      id: call.id,
      status: call.status,
      startedAt: call.startedAt?.toISOString(),
      endedAt: call.endedAt?.toISOString(),
      durationSeconds: call.durationSeconds || 0,
      endReason: call.endReason,
      aiProvider: call.aiProvider,
    }));

    // Set CORS headers
    const origin = request.headers.get("origin");
    const res = NextResponse.json({ history });
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return res;
  } catch (error) {
    console.error("[CallHistory] Error fetching call history:", error);
    return NextResponse.json(
      { error: "Failed to fetch call history" },
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
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}
