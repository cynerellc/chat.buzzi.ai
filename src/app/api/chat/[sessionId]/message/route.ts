/**
 * Chat Message API
 *
 * POST /api/chat/[sessionId]/message - Send a message and get a response
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAgentRunner } from "@/lib/ai";

// ============================================================================
// Request Validation
// ============================================================================

const sendMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(10000, "Message too long"),
  attachments: z
    .array(
      z.object({
        type: z.enum(["image", "file", "audio"]),
        url: z.string().url(),
        mimeType: z.string(),
        fileName: z.string().optional(),
      })
    )
    .optional(),
});

// ============================================================================
// POST - Send Message
// ============================================================================

export async function POST(
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

    const body = await request.json();

    // Validate request body
    const validation = sendMessageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Send message using agent runner
    const runner = getAgentRunner();
    const response = await runner.sendMessage({
      conversationId: sessionId,
      message: data.message,
      attachments: data.attachments,
    });

    if (!response) {
      return NextResponse.json(
        {
          error: "Conversation not found",
          message: "The specified session does not exist",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        content: response.content,
        metadata: response.metadata,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process message",
      },
      { status: 500 }
    );
  }
}
