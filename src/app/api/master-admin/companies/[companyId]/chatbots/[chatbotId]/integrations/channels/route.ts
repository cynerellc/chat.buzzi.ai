import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots, channelConfigs } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

// Channel-specific credential schemas
const channelCredentialFields: Record<string, { field: string; label: string; type: string; required: boolean; placeholder?: string }[]> = {
  web: [], // Web widget doesn't need credentials
  whatsapp: [
    { field: "businessAccountId", label: "Business Account ID", type: "text", required: true, placeholder: "123456789012345" },
    { field: "accessToken", label: "Access Token", type: "password", required: true, placeholder: "EAAxxxxxxx..." },
    { field: "phoneNumberId", label: "Phone Number ID", type: "text", required: true, placeholder: "123456789012345" },
    { field: "verifyToken", label: "Verify Token", type: "text", required: false, placeholder: "Custom verify token" },
  ],
  messenger: [
    { field: "appId", label: "App ID", type: "text", required: true, placeholder: "123456789012345" },
    { field: "pageAccessToken", label: "Page Access Token", type: "password", required: true, placeholder: "EAAxxxxxxx..." },
    { field: "verifyToken", label: "Verify Token", type: "text", required: false, placeholder: "Custom verify token" },
    { field: "pageId", label: "Page ID", type: "text", required: true, placeholder: "123456789012345" },
  ],
  instagram: [
    { field: "appId", label: "App ID", type: "text", required: true, placeholder: "123456789012345" },
    { field: "accessToken", label: "Access Token", type: "password", required: true, placeholder: "IGQxxxxxxx..." },
    { field: "instagramAccountId", label: "Instagram Account ID", type: "text", required: true, placeholder: "123456789012345" },
  ],
};

// Generate webhook URL for a channel
function generateWebhookUrl(companyId: string, chatbotId: string, channel: string, webhookId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chat.buzzi.ai";
  return `${baseUrl}/api/webhooks/${companyId}/${chatbotId}/${channel}/${webhookId}`;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await params;

    // Verify chatbot exists and belongs to company
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body = await request.json();
    const { channel, isActive, credentials, settings } = body;

    if (!channel) {
      return NextResponse.json({ error: "Channel type is required" }, { status: 400 });
    }

    // Check if channel config already exists
    const [existingConfig] = await db
      .select()
      .from(channelConfigs)
      .where(
        and(
          eq(channelConfigs.chatbotId, chatbotId),
          eq(channelConfigs.companyId, companyId),
          eq(channelConfigs.channel, channel)
        )
      )
      .limit(1);

    if (existingConfig) {
      // Update existing config
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (typeof isActive === "boolean") {
        updateData.isActive = isActive;
        if (isActive) {
          updateData.lastConnectedAt = new Date();
        }
      }

      if (credentials) {
        // Merge with existing credentials
        const existingCreds = (existingConfig.credentials ?? {}) as Record<string, unknown>;
        updateData.credentials = { ...existingCreds, ...credentials };
      }

      if (settings) {
        // Merge with existing settings
        const existingSettings = (existingConfig.settings ?? {}) as Record<string, unknown>;
        updateData.settings = { ...existingSettings, ...settings };
      }

      const [updated] = await db
        .update(channelConfigs)
        .set(updateData)
        .where(eq(channelConfigs.id, existingConfig.id))
        .returning();

      return NextResponse.json({
        channel: updated,
        credentialFields: channelCredentialFields[channel] || [],
      });
    } else {
      // Create new channel config
      const webhookId = crypto.randomUUID();
      const webhookSecret = crypto.randomBytes(32).toString("hex");
      const webhookUrl = generateWebhookUrl(companyId, chatbotId, channel, webhookId);

      const [newConfig] = await db
        .insert(channelConfigs)
        .values({
          companyId,
          chatbotId,
          channel,
          isActive: isActive ?? true,
          webhookUrl,
          webhookSecret,
          credentials: credentials || {},
          settings: settings || {},
          lastConnectedAt: isActive ? new Date() : null,
        })
        .returning();

      return NextResponse.json({
        channel: newConfig,
        credentialFields: channelCredentialFields[channel] || [],
      });
    }
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve channel config schema
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await params;
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    if (!channel) {
      // Return all channel schemas
      return NextResponse.json({ credentialFields: channelCredentialFields });
    }

    // Verify chatbot exists
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Get existing config for this channel
    type ChannelType = "web" | "whatsapp" | "telegram" | "messenger" | "instagram" | "slack" | "teams" | "custom";
    const [config] = await db
      .select()
      .from(channelConfigs)
      .where(
        and(
          eq(channelConfigs.chatbotId, chatbotId),
          eq(channelConfigs.companyId, companyId),
          eq(channelConfigs.channel, channel as ChannelType)
        )
      )
      .limit(1);

    return NextResponse.json({
      channel: config || null,
      credentialFields: channelCredentialFields[channel] || [],
    });
  } catch (error) {
    console.error("Error fetching channel config:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel config" },
      { status: 500 }
    );
  }
}
