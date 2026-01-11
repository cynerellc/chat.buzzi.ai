/**
 * Agent Info API
 *
 * GET /api/widget/[sessionId]/agent-info?userId=<userId>
 * Returns the name and avatar URL of a support agent for display in the widget
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { conversations } from "@/lib/db/schema/conversations";
import { eq } from "drizzle-orm";

interface RouteParams {
  sessionId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { sessionId } = await params;
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Validate session exists
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.sessionId, sessionId))
      .limit(1);

    if (!conversation) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Get user info
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return NextResponse.json({
      name: user?.name || "Support Agent",
      avatarUrl: user?.avatarUrl || user?.image || null,
    });
  } catch (error) {
    console.error("Agent info error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent info" },
      { status: 500 }
    );
  }
}
