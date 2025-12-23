import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.companyId, company.id))
      .orderBy(desc(webhooks.createdAt));

    const response: WebhookConfig[] = companyWebhooks.map((webhook) => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || "",
      events: webhook.events as string[],
      isActive: webhook.isActive,
      lastTriggeredAt: webhook.lastDeliveryAt?.toISOString() || null,
      failureCount: Number(webhook.failedDeliveries) || 0,
      createdAt: webhook.createdAt.toISOString(),
      updatedAt: webhook.updatedAt.toISOString(),
    }));

    return NextResponse.json({ webhooks: response });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 }
    );
  }
}

interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
}

export async function POST(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: CreateWebhookRequest = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "Webhook name is required" }, { status: 400 });
    }

    if (!body.url) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
    }

    if (!body.events || body.events.length === 0) {
      return NextResponse.json(
        { error: "At least one event must be selected" },
        { status: 400 }
      );
    }

    // Generate webhook secret
    const secret = randomBytes(32).toString("hex");

    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        companyId: company.id,
        name: body.name,
        url: body.url,
        secret,
        events: body.events,
        isActive: true,
      })
      .returning();

    if (!newWebhook) {
      return NextResponse.json(
        { error: "Failed to create webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        webhook: {
          id: newWebhook.id,
          name: newWebhook.name,
          url: newWebhook.url,
          secret: newWebhook.secret,
          events: newWebhook.events,
          isActive: newWebhook.isActive,
          createdAt: newWebhook.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating webhook:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

interface UpdateWebhookRequest {
  id: string;
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export async function PATCH(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: UpdateWebhookRequest = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    // Verify webhook belongs to company
    const [existingWebhook] = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, body.id), eq(webhooks.companyId, company.id)))
      .limit(1);

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Validate URL if provided
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.url !== undefined) updateData.url = body.url;
    if (body.events !== undefined) updateData.events = body.events;
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
      // Reset failure count when re-enabling
      if (body.isActive) {
        updateData.failedDeliveries = 0;
      }
    }

    const [updatedWebhook] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, body.id))
      .returning();

    if (!updatedWebhook) {
      return NextResponse.json(
        { error: "Failed to update webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      webhook: {
        id: updatedWebhook.id,
        name: updatedWebhook.name,
        url: updatedWebhook.url,
        events: updatedWebhook.events,
        isActive: updatedWebhook.isActive,
        updatedAt: updatedWebhook.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get("id");

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    // Verify webhook belongs to company
    const [existingWebhook] = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.companyId, company.id)))
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
