import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { integrations, webhooks } from "@/lib/db/schema";

export interface IntegrationItem {
  id: string;
  type: string;
  name: string;
  description: string | null;
  status: string;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookItem {
  id: string;
  name: string;
  description: string | null;
  url: string;
  events: string[];
  isActive: boolean;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
}

export interface IntegrationsResponse {
  integrations: IntegrationItem[];
  webhooks: WebhookItem[];
}

// Available integration types (for reference, not exported from route)
const availableIntegrationTypes = [
  {
    type: "slack",
    name: "Slack",
    description: "Send notifications to Slack channels",
    icon: "slack",
    category: "communication",
  },
  {
    type: "zapier",
    name: "Zapier",
    description: "Connect to thousands of apps via Zapier",
    icon: "zapier",
    category: "automation",
  },
  {
    type: "salesforce",
    name: "Salesforce",
    description: "Sync customer data with Salesforce CRM",
    icon: "salesforce",
    category: "crm",
  },
  {
    type: "hubspot",
    name: "HubSpot",
    description: "Integrate with HubSpot CRM and Marketing",
    icon: "hubspot",
    category: "crm",
  },
  {
    type: "webhook",
    name: "Custom Webhook",
    description: "Send data to any HTTP endpoint",
    icon: "webhook",
    category: "custom",
  },
];

export async function GET() {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get integrations
    const companyIntegrations = await db
      .select()
      .from(integrations)
      .where(eq(integrations.companyId, company.id))
      .orderBy(desc(integrations.createdAt));

    // Get webhooks
    const companyWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.companyId, company.id))
      .orderBy(desc(webhooks.createdAt));

    const integrationsList: IntegrationItem[] = companyIntegrations.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      description: i.description,
      status: i.status,
      lastError: i.lastError,
      lastErrorAt: i.lastErrorAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }));

    const webhooksList: WebhookItem[] = companyWebhooks.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      url: w.url,
      events: (w.events as string[]) || [],
      isActive: w.isActive,
      totalDeliveries: (w.totalDeliveries as number) || 0,
      successfulDeliveries: (w.successfulDeliveries as number) || 0,
      failedDeliveries: (w.failedDeliveries as number) || 0,
      lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
      lastDeliveryStatus: w.lastDeliveryStatus,
      createdAt: w.createdAt.toISOString(),
    }));

    const response: IntegrationsResponse = {
      integrations: integrationsList,
      webhooks: webhooksList,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

interface CreateWebhookRequest {
  name: string;
  description?: string;
  url: string;
  events: string[];
  secret?: string;
}

export async function POST(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: CreateWebhookRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.url || !body.events?.length) {
      return NextResponse.json(
        { error: "Name, URL, and at least one event are required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
    }

    const [webhook] = await db
      .insert(webhooks)
      .values({
        companyId: company.id,
        name: body.name,
        description: body.description || null,
        url: body.url,
        events: body.events,
        secret: body.secret || null,
      })
      .returning();

    if (!webhook) {
      return NextResponse.json(
        { error: "Failed to create webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        description: webhook.description,
        url: webhook.url,
        events: webhook.events as string[],
        isActive: webhook.isActive,
        createdAt: webhook.createdAt.toISOString(),
      },
      message: "Webhook created successfully",
    });
  } catch (error) {
    console.error("Error creating webhook:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}
