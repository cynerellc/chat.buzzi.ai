import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots, channelConfigs, webhooks } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Fetch channel configs
    const channels = await db
      .select({
        id: channelConfigs.id,
        channel: channelConfigs.channel,
        isActive: channelConfigs.isActive,
        webhookUrl: channelConfigs.webhookUrl,
        credentials: channelConfigs.credentials,
        settings: channelConfigs.settings,
        lastConnectedAt: channelConfigs.lastConnectedAt,
        lastError: channelConfigs.lastError,
        lastErrorAt: channelConfigs.lastErrorAt,
        createdAt: channelConfigs.createdAt,
        updatedAt: channelConfigs.updatedAt,
      })
      .from(channelConfigs)
      .where(
        and(
          eq(channelConfigs.chatbotId, chatbotId),
          eq(channelConfigs.companyId, companyId)
        )
      );

    // Fetch webhooks
    const webhookList = await db
      .select({
        id: webhooks.id,
        name: webhooks.name,
        description: webhooks.description,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        successfulDeliveries: webhooks.successfulDeliveries,
        failedDeliveries: webhooks.failedDeliveries,
        lastDeliveryAt: webhooks.lastDeliveryAt,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(eq(webhooks.chatbotId, chatbotId));

    return NextResponse.json({
      channels,
      webhooks: webhookList,
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}
