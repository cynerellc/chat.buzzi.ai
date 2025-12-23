/**
 * Typing Indicator API
 *
 * POST /api/chat/[sessionId]/typing - Send typing indicator
 * GET /api/chat/[sessionId]/typing - Get typing status
 *
 * Manages real-time typing indicators for chat sessions.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTypingService } from "@/lib/realtime/typing-service";

// ============================================================================
// Request Validation
// ============================================================================

const typingRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  userName: z.string().optional(),
  userType: z.enum(["end_user", "support_agent", "ai_agent"]).default("end_user"),
  isTyping: z.boolean(),
});

// ============================================================================
// POST - Send Typing Indicator
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Validate session ID format
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(
      JSON.stringify({ error: "Invalid session ID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate request body
  const validation = typingRequestSchema.safeParse(body);
  if (!validation.success) {
    return new Response(
      JSON.stringify({
        error: "Validation error",
        details: validation.error.issues,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const data = validation.data;
  const typingService = getTypingService();

  if (data.isTyping) {
    // Start typing indicator
    const isNew = typingService.startTyping(sessionId, data.userId, {
      userName: data.userName,
      userType: data.userType,
    });

    return new Response(
      JSON.stringify({
        success: true,
        isTyping: true,
        wasAlreadyTyping: !isNew,
        conversationId: sessionId,
        typingUsers: typingService.getTypingUsers(sessionId),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } else {
    // Stop typing indicator
    const wasStopped = typingService.stopTyping(sessionId, data.userId);

    return new Response(
      JSON.stringify({
        success: true,
        isTyping: false,
        wasStopped,
        conversationId: sessionId,
        typingUsers: typingService.getTypingUsers(sessionId),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ============================================================================
// GET - Get Typing Status
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Validate session ID format
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(
      JSON.stringify({ error: "Invalid session ID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const typingService = getTypingService();

  // Get optional userId filter from query params
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (userId) {
    // Check if specific user is typing
    const isTyping = typingService.isUserTyping(sessionId, userId);

    return new Response(
      JSON.stringify({
        conversationId: sessionId,
        userId,
        isTyping,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Get all typing users
  const typingUsers = typingService.getTypingUsers(sessionId);
  const isAnyoneTyping = typingUsers.length > 0;
  const indicatorText = typingService.getTypingIndicatorText(sessionId);

  return new Response(
    JSON.stringify({
      conversationId: sessionId,
      isTyping: isAnyoneTyping,
      typingUsers: typingUsers.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userType: u.userType,
        startedAt: u.startedAt.toISOString(),
      })),
      indicatorText,
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// ============================================================================
// DELETE - Clear Typing Status
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Validate session ID format
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return new Response(
      JSON.stringify({ error: "Invalid session ID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const typingService = getTypingService();

  if (userId) {
    // Clear typing for specific user
    const wasStopped = typingService.stopTyping(sessionId, userId);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        wasStopped,
        conversationId: sessionId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Clear all typing for conversation
  typingService.clearConversation(sessionId);

  return new Response(
    JSON.stringify({
      success: true,
      conversationId: sessionId,
      message: "All typing indicators cleared",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
