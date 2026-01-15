import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";

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

export interface IntegrationsResponse {
  integrations: IntegrationItem[];
}

export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    // Get integrations
    const companyIntegrations = await db
      .select()
      .from(integrations)
      .where(eq(integrations.chatbotId, company.id))
      .orderBy(desc(integrations.createdAt));

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

    const response: IntegrationsResponse = {
      integrations: integrationsList,
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

