/**
 * Widget Session Resume API
 *
 * POST /api/widget/session/resume - Resume an existing widget chat session
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema/conversations";
import { eq, asc } from "drizzle-orm";
import { withRateLimit } from "@/lib/redis/rate-limit";
import { getConversationFileUrl } from "@/lib/supabase/client";

interface ResumeSessionRequest {
  sessionId: string;
  agentId: string;
  companyId: string;
}

interface ResumeSessionResponse {
  valid: boolean;
  sessionId?: string;
  conversationId?: string;
  endUserId?: string;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
    agentId?: string;
    // Voice message fields
    type?: "text" | "audio";
    audioUrl?: string;
    transcript?: string;
    duration?: number;
  }>;
  reason?: string;
}

// Attachment structure for voice messages
interface AudioAttachment {
  type: "audio";
  mimeType?: string;
  storagePath: string;
  duration?: number;
  transcript?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await withRateLimit(request, "widget");
    if (rateLimitResult) return rateLimitResult;

    const body = (await request.json()) as ResumeSessionRequest;
    const { sessionId, agentId, companyId } = body;

    // Validate required fields
    if (!sessionId || !agentId || !companyId) {
      return NextResponse.json<ResumeSessionResponse>(
        { valid: false, reason: "Missing required fields" },
        { status: 400 }
      );
    }

    // Look up conversation by sessionId
    const conversationResult = await db
      .select({
        id: conversations.id,
        companyId: conversations.companyId,
        chatbotId: conversations.chatbotId,
        endUserId: conversations.endUserId,
        status: conversations.status,
        sessionId: conversations.sessionId,
      })
      .from(conversations)
      .where(eq(conversations.sessionId, sessionId))
      .limit(1);

    const conversation = conversationResult[0];

    if (!conversation) {
      return NextResponse.json<ResumeSessionResponse>({
        valid: false,
        reason: "Session not found",
      });
    }

    // Validate conversation belongs to the correct agent and company
    if (conversation.companyId !== companyId || conversation.chatbotId !== agentId) {
      return NextResponse.json<ResumeSessionResponse>({
        valid: false,
        reason: "Session mismatch",
      });
    }

    // Check if conversation is still active
    if (conversation.status !== "active") {
      return NextResponse.json<ResumeSessionResponse>({
        valid: false,
        reason: `Conversation is ${conversation.status}`,
      });
    }

    // Load messages for this conversation
    const messagesResult = await db
      .select({
        id: messages.id,
        role: messages.role,
        type: messages.type,
        content: messages.content,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
        attachments: messages.attachments,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt));

    // Transform messages to widget format, regenerating voice URLs
    const widgetMessages = await Promise.all(
      messagesResult.map(async (msg) => {
        const metadata = msg.metadata as { agentId?: string } | null;
        const baseMessage = {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt.toISOString(),
          agentId: metadata?.agentId,
        };

        // Handle voice messages - regenerate signed URL
        if (msg.type === "audio") {
          const attachments = msg.attachments as Array<AudioAttachment> | null;
          const audioAttachment = attachments?.find((a) => a.type === "audio");

          if (audioAttachment?.storagePath) {
            // Regenerate signed URL for audio playback
            const audioUrl = await getConversationFileUrl(audioAttachment.storagePath);

            return {
              ...baseMessage,
              type: "audio" as const,
              audioUrl: audioUrl || undefined,
              transcript: audioAttachment.transcript,
              duration: audioAttachment.duration,
            };
          }

          // Voice message without storage path (shouldn't happen, but handle gracefully)
          return {
            ...baseMessage,
            type: "audio" as const,
          };
        }

        return baseMessage;
      })
    );

    // Update lastMessageAt to track activity
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id));

    const response: ResumeSessionResponse = {
      valid: true,
      sessionId,
      conversationId: conversation.id,
      endUserId: conversation.endUserId,
      messages: widgetMessages,
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
    console.error("Widget session resume error:", error);
    return NextResponse.json<ResumeSessionResponse>(
      { valid: false, reason: "Failed to resume session" },
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
