/**
 * Widget Message API
 *
 * POST /api/widget/[sessionId]/message - Send a message in the chat session
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema/conversations";
import { eq } from "drizzle-orm";
import { getAgentRunner } from "@/lib/ai";
import { withRateLimit } from "@/lib/redis/rate-limit";
import type { SendMessageRequest } from "@/lib/widget/types";

interface RouteParams {
  sessionId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { sessionId } = await params;

    // Rate limiting: 60 requests per minute per session
    const rateLimitResult = await withRateLimit(request, "widget", sessionId);
    if (rateLimitResult) return rateLimitResult;

    const body = (await request.json()) as SendMessageRequest;
    const { content, attachments } = body;

    // 1. Validate session and get conversation
    const conversationId = await validateSession(sessionId);
    if (!conversationId) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // 2. Get conversation details
    const conversationResult = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conversationResult.length === 0 || !conversationResult[0]) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const conversation = conversationResult[0];

    // 3. Check if conversation is still active
    if (conversation.status === "resolved" || conversation.status === "abandoned") {
      return NextResponse.json(
        { error: "Conversation is no longer active" },
        { status: 400 }
      );
    }

    // 4. Save user message
    const [userMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        role: "user",
        type: "text",
        content,
        attachments: attachments ?? [],
      })
      .returning();

    if (!userMessage) {
      throw new Error("Failed to save message");
    }

    // 5. Update conversation stats
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 1,
        userMessageCount: conversation.userMessageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // 6. Process with AI agent and get response
    const aiResponse = await processMessage(conversationId, content);

    // 7. Return response with AI message
    const response = {
      messageId: userMessage.id,
      conversationId,
      timestamp: userMessage.createdAt.toISOString(),
      assistantMessage: aiResponse,
    };

    // Set CORS headers
    const origin = request.headers.get("origin");
    const res = NextResponse.json(response);
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return res;
  } catch (error) {
    console.error("Widget message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
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

async function validateSession(sessionId: string): Promise<string | null> {
  // In a production app, you would:
  // 1. Look up the session in Redis or a sessions table
  // 2. Verify it hasn't expired
  // 3. Return the associated conversationId

  // For this implementation, we'll use the sessionId to look up
  // conversations that have this session in their metadata
  // This is a simplified approach - in production, use proper session management

  // For now, assume the sessionId is encoded with the conversationId
  // In a real implementation, you'd have a proper session store

  // Try to find a conversation with this session
  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .limit(1);

  if (result.length > 0 && result[0]) {
    return result[0].id;
  }

  return null;
}

interface AssistantMessageResponse {
  messageId: string;
  content: string;
  sourceChunkIds: string[];
}

async function processMessage(
  conversationId: string,
  content: string
): Promise<AssistantMessageResponse | null> {
  try {
    // Run AI agent
    const runner = getAgentRunner();
    const response = await runner.sendMessage({
      conversationId,
      message: content,
    });

    if (response) {
      // Extract metadata
      const metadata = response.metadata ?? {};
      const tokenCount = metadata.tokensUsed?.totalTokens;
      const processingTimeMs = metadata.processingTimeMs
        ? Math.round(metadata.processingTimeMs)
        : undefined;
      const sourceIds = metadata.sources?.map((s) => s.id) ?? [];

      // Save assistant message
      const [assistantMessage] = await db
        .insert(messages)
        .values({
          conversationId,
          role: "assistant",
          type: "text",
          content: response.content,
          tokenCount,
          processingTimeMs,
          sourceChunkIds: sourceIds,
          toolCalls: [],
          toolResults: [],
        })
        .returning();

      // Update conversation stats
      const conversation = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length > 0 && conversation[0]) {
        await db
          .update(conversations)
          .set({
            messageCount: conversation[0].messageCount + 1,
            assistantMessageCount: conversation[0].assistantMessageCount + 1,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
      }

      return {
        messageId: assistantMessage?.id ?? "",
        content: response.content,
        sourceChunkIds: sourceIds,
      };
    }

    return null;
  } catch (error) {
    console.error("Error processing message:", error);
    throw error;
  }
}
