/**
 * Individual Session Management API
 *
 * DELETE - Revoke a specific session
 * PATCH - Trust/untrust a device session
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { revokeSession, trustDeviceSession } from "@/lib/auth/session-manager";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const success = await revokeSession(sessionId, session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke session:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { trusted } = body;

    if (typeof trusted !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (trusted) {
      await trustDeviceSession(sessionId, session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
