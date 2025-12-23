/**
 * Session Management API
 *
 * GET - List all active sessions for the current user
 * DELETE - Revoke all other sessions
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getUserSessions, revokeAllSessions } from "@/lib/auth/session-manager";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current session token from cookie (if tracking device sessions)
    // For now, we'll just get all sessions
    const sessions = await getUserSessions(session.user.id);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Failed to get sessions:", error);
    return NextResponse.json(
      { error: "Failed to get sessions" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Revoke all sessions
    const count = await revokeAllSessions(session.user.id);

    return NextResponse.json({
      success: true,
      revokedCount: count,
    });
  } catch (error) {
    console.error("Failed to revoke sessions:", error);
    return NextResponse.json(
      { error: "Failed to revoke sessions" },
      { status: 500 }
    );
  }
}
