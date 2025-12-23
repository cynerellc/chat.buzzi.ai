/**
 * Chat History API
 *
 * GET /api/chat/[sessionId]/history - Get conversation history
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgentRunner } from "@/lib/ai";

// ============================================================================
// GET - Get Conversation History
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Validate session ID
    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    // Get history using agent runner
    const runner = getAgentRunner();
    const history = await runner.getConversationHistory(sessionId);

    if (!history || history.length === 0) {
      return NextResponse.json(
        {
          error: "Conversation not found",
          message: "No history found for the specified session",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        messages: history.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
        })),
        totalMessages: history.length,
      },
    });
  } catch (error) {
    console.error("Get history error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve conversation history",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Clear/End Conversation
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Validate session ID
    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    // End conversation
    const runner = getAgentRunner();
    await runner.endConversation(sessionId);

    return NextResponse.json({
      success: true,
      message: "Conversation ended successfully",
    });
  } catch (error) {
    console.error("End conversation error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to end conversation",
      },
      { status: 500 }
    );
  }
}
