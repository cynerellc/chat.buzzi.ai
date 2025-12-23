/**
 * Webhook Route Handler
 *
 * Handles incoming webhooks from external messaging channels.
 * URL Pattern: /api/webhooks/{companyId}/{agentId}/{channel}/{webhookId}
 *
 * Supports:
 * - WhatsApp Business API
 * - Telegram Bot API
 * - Other channels via adapters
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema/integrations";
import { companies } from "@/lib/db/schema/companies";
import { conversations, messages, endUsers } from "@/lib/db/schema/conversations";
import { eq, and } from "drizzle-orm";
import { getChannelAdapter, hasChannelAdapter } from "@/lib/realtime/channels";
import { getAgentRunner } from "@/lib/ai";
import type { ChannelType } from "@/lib/realtime/types";

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  companyId: string;
  agentId: string;
  channel: string;
  webhookId: string;
}

// ============================================================================
// GET - Webhook Verification
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { companyId, agentId, channel, webhookId } = await params;

  // Validate channel
  if (!hasChannelAdapter(channel as ChannelType)) {
    return NextResponse.json(
      { error: "Unsupported channel" },
      { status: 400 }
    );
  }

  // Load integration config
  const integration = await loadIntegration(companyId, agentId, webhookId);
  if (!integration) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404 }
    );
  }

  // Get adapter
  const adapter = getChannelAdapter(channel as ChannelType);

  // Handle verification
  const verifyToken = (integration.config as { verifyToken?: string })?.verifyToken;
  if (verifyToken && adapter.handleVerification) {
    const searchParams = new URL(request.url).searchParams;
    const response = adapter.handleVerification(searchParams, verifyToken);
    if (response) {
      return response;
    }
  }

  return NextResponse.json({ status: "ok" });
}

// ============================================================================
// POST - Incoming Messages
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { companyId, agentId, channel, webhookId } = await params;

  try {
    // 1. Validate channel
    if (!hasChannelAdapter(channel as ChannelType)) {
      return NextResponse.json(
        { error: "Unsupported channel" },
        { status: 400 }
      );
    }

    // 2. Load integration config
    const integration = await loadIntegration(companyId, agentId, webhookId);
    if (!integration) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    // 3. Validate signature
    const body = await request.text();
    const adapter = getChannelAdapter(channel as ChannelType);

    // Get signature from appropriate header
    const signature = getSignatureHeader(request, channel);
    const secret = (integration.config as { webhookSecret?: string })?.webhookSecret ?? "";

    if (!adapter.validateSignature(body, signature, secret)) {
      console.error(`Invalid signature for webhook ${webhookId}`);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 4. Check company subscription
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company.length === 0 || company[0]?.status !== "active") {
      // Return success to prevent retries, but don't process
      return NextResponse.json({ status: "subscription_inactive" });
    }

    // 5. Parse message
    const payload = JSON.parse(body);
    const message = await adapter.parseMessage(payload);

    if (!message) {
      // Not a message event (e.g., status update)
      return NextResponse.json({ status: "ok" });
    }

    // 6. Find or create conversation
    const conversation = await findOrCreateConversation(
      companyId,
      agentId,
      channel as ChannelType,
      message.senderId,
      message.senderName
    );

    // 7. Save incoming message
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      type: "text",
      content: message.content,
      attachments: message.attachments ?? [],
    });

    // 8. Update conversation stats
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 1,
        userMessageCount: conversation.userMessageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    // 9. Process with AI agent (async)
    processMessageAsync(
      conversation.id,
      companyId,
      agentId,
      channel as ChannelType,
      message.senderId,
      message.content,
      integration.config as Record<string, unknown>
    );

    // 10. Return immediate acknowledgment
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function loadIntegration(
  companyId: string,
  agentId: string,
  webhookId: string
) {
  const result = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.companyId, companyId),
        eq(integrations.id, webhookId),
        eq(integrations.status, "active")
      )
    )
    .limit(1);

  return result[0];
}

function getSignatureHeader(request: NextRequest, channel: string): string | null {
  switch (channel) {
    case "whatsapp":
    case "messenger":
      return request.headers.get("x-hub-signature-256");
    case "telegram":
      return request.headers.get("x-telegram-bot-api-secret-token");
    case "slack":
      return request.headers.get("x-slack-signature");
    default:
      return request.headers.get("x-webhook-signature");
  }
}

async function findOrCreateEndUser(
  companyId: string,
  channel: ChannelType,
  channelUserId: string,
  name?: string
) {
  // Look for existing end user by channel and channelUserId
  const existing = await db
    .select()
    .from(endUsers)
    .where(
      and(
        eq(endUsers.companyId, companyId),
        eq(endUsers.channel, channel),
        eq(endUsers.channelUserId, channelUserId)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    // Update last seen
    await db
      .update(endUsers)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(endUsers.id, existing[0].id));
    return existing[0];
  }

  // Create new end user
  const [newEndUser] = await db
    .insert(endUsers)
    .values({
      companyId,
      channel,
      channelUserId,
      name,
      lastSeenAt: new Date(),
    })
    .returning();

  if (!newEndUser) {
    throw new Error("Failed to create end user");
  }

  return newEndUser;
}

async function findOrCreateConversation(
  companyId: string,
  agentId: string,
  channel: ChannelType,
  senderId: string,
  senderName?: string
) {
  // 1. Find or create end user
  const endUser = await findOrCreateEndUser(
    companyId,
    channel,
    senderId,
    senderName
  );

  // 2. Look for existing active conversation for this end user
  const existing = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.companyId, companyId),
        eq(conversations.agentId, agentId),
        eq(conversations.endUserId, endUser.id),
        eq(conversations.status, "active")
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    return existing[0];
  }

  // 3. Create new conversation
  const [newConversation] = await db
    .insert(conversations)
    .values({
      companyId,
      agentId,
      endUserId: endUser.id,
      channel,
      status: "active",
      lastMessageAt: new Date(),
    })
    .returning();

  if (!newConversation) {
    throw new Error("Failed to create conversation");
  }

  // 4. Increment end user's conversation count
  await db
    .update(endUsers)
    .set({
      totalConversations: endUser.totalConversations + 1,
      updatedAt: new Date(),
    })
    .where(eq(endUsers.id, endUser.id));

  return newConversation;
}

async function processMessageAsync(
  conversationId: string,
  _companyId: string,
  _agentId: string,
  channel: ChannelType,
  recipientId: string,
  content: string,
  integrationConfig: Record<string, unknown>
) {
  try {
    const runner = getAgentRunner();
    const response = await runner.sendMessage({
      conversationId,
      message: content,
    });

    if (response) {
      // Send response back through channel
      const adapter = getChannelAdapter(channel);
      await adapter.sendMessage(
        {
          id: "",
          companyId: "",
          agentId: "",
          channel,
          webhookUrl: "",
          webhookSecret: "",
          credentials: integrationConfig.credentials as Record<string, string> ?? {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        recipientId,
        response.content
      );
    }
  } catch (error) {
    console.error("Error processing message:", error);
  }
}
