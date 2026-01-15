/**
 * Widget Call End API
 *
 * POST /api/widget/call/[sessionId]/end - End a call session gracefully
 *
 * This endpoint allows the client to explicitly end a call session,
 * triggering proper cleanup and recording of call metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCallRunner } from "@/lib/call/execution/call-runner";
import { getCallSessionManager } from "@/lib/call/execution/call-session-manager";
import { withRateLimit } from "@/lib/redis/rate-limit";

// ============================================================================
// Types
// ============================================================================

interface EndCallRequest {
  reason?: string;
}

interface EndCallResponse {
  success: boolean;
  message: string;
  callSummary?: {
    callId: string;
    durationSeconds: number;
    status: string;
    endedAt: string;
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Rate limiting: 60 end call requests per minute per IP
    const rateLimitResult = await withRateLimit(request, "widget");
    if (rateLimitResult) return rateLimitResult;

    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    // Parse request body
    let reason = "user_ended";
    try {
      const body = (await request.json()) as EndCallRequest;
      reason = body.reason || "user_ended";
    } catch {
      // No body is fine, use default reason
    }

    console.log(`[CallEndAPI] Ending call session: ${sessionId} (reason: ${reason})`);

    // Get session info before ending
    const sessionManager = getCallSessionManager();
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found or already ended" },
        { status: 404 }
      );
    }

    // Calculate duration
    const startTime = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // End the call through CallRunnerService
    const callRunner = getCallRunner();
    await callRunner.endCall(sessionId, reason);

    // Prepare response
    const response: EndCallResponse = {
      success: true,
      message: "Call ended successfully",
      callSummary: {
        callId: session.callId,
        durationSeconds,
        status: "completed",
        endedAt: new Date().toISOString(),
      },
    };

    console.log(`[CallEndAPI] Call ended: ${session.callId} (duration: ${durationSeconds}s)`);

    // Set CORS headers
    const origin = request.headers.get("origin");
    const res = NextResponse.json(response);
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return res;
  } catch (error) {
    console.error("[CallEndAPI] Error:", error);
    return NextResponse.json(
      { error: "Failed to end call" },
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
