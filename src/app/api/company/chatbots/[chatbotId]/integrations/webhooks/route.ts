import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots, webhooks } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ chatbotId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await context.params;

    // Verify chatbot exists and belongs to company
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, company.id),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, url, events, description, secret, headers } = body;

    if (!name || !url || !events || events.length === 0) {
      return NextResponse.json(
        { error: "Name, URL, and at least one event are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const [webhook] = await db
      .insert(webhooks)
      .values({
        chatbotId,
        name,
        url,
        events,
        description: description || null,
        secret: secret || null,
        headers: headers || {},
        isActive: true,
      })
      .returning();

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("Error creating webhook:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await context.params;

    // Verify chatbot exists
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, company.id),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body = await request.json();
    const { webhookId, ...updates } = body;

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    // Verify webhook belongs to this chatbot
    const [existingWebhook] = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, webhookId),
          eq(webhooks.chatbotId, chatbotId)
        )
      )
      .limit(1);

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.url !== undefined) updateData.url = updates.url;
    if (updates.events !== undefined) updateData.events = updates.events;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.secret !== undefined) updateData.secret = updates.secret;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.headers !== undefined) updateData.headers = updates.headers;

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, webhookId))
      .returning();

    return NextResponse.json({ webhook: updated });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await context.params;
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get("webhookId");

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    // Verify chatbot exists
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, company.id),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Verify webhook belongs to this chatbot
    const [existingWebhook] = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, webhookId),
          eq(webhooks.chatbotId, chatbotId)
        )
      )
      .limit(1);

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await db.delete(webhooks).where(eq(webhooks.id, webhookId));

    return NextResponse.json({ message: "Webhook deleted successfully" });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}
