/**
 * Integration Accounts API
 *
 * Endpoints for managing integration accounts (WhatsApp, Twilio, Vonage).
 * Used for voice call integrations.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationAccounts } from "@/lib/db/schema/calls";
import { eq, and, isNull } from "drizzle-orm";
import { requireCompanyAdmin } from "@/lib/auth/guards";

// ============================================================================
// Validation Schemas
// ============================================================================

const createIntegrationSchema = z.object({
  provider: z.enum(["whatsapp", "twilio", "vonage", "bandwidth"]),
  displayName: z.string().min(1).max(255),
  phoneNumber: z.string().optional(),
  credentials: z.record(z.string(), z.string()).default({}),
  settings: z.record(z.string(), z.unknown()).default({}),
});

// ============================================================================
// GET - List Integration Accounts
// ============================================================================

export async function GET() {
  try {
    // Auth check
    const { company } = await requireCompanyAdmin();

    // Fetch integration accounts
    const accountsRaw = await db
      .select({
        id: integrationAccounts.id,
        provider: integrationAccounts.provider,
        displayName: integrationAccounts.displayName,
        isVerified: integrationAccounts.isVerified,
        isActive: integrationAccounts.isActive,
        settings: integrationAccounts.settings,
        createdAt: integrationAccounts.createdAt,
        updatedAt: integrationAccounts.updatedAt,
      })
      .from(integrationAccounts)
      .where(
        and(
          eq(integrationAccounts.companyId, company.id),
          isNull(integrationAccounts.deletedAt)
        )
      )
      .orderBy(integrationAccounts.createdAt);

    // Map to include phoneNumber from settings for backward compatibility
    const accounts = accountsRaw.map((account) => ({
      ...account,
      phoneNumber: account.settings?.phone_number || null,
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[IntegrationAccountsAPI] Error listing accounts:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to list integration accounts" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Integration Account
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { company } = await requireCompanyAdmin();

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createIntegrationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Generate webhook secret for this integration
    const webhookSecret = crypto.randomUUID().replace(/-/g, "");

    // Merge settings with phone_number and webhook_secret
    const mergedSettings = {
      ...data.settings,
      phone_number: data.phoneNumber,
      webhook_secret: webhookSecret,
    };

    // Create integration account
    const [account] = await db
      .insert(integrationAccounts)
      .values({
        companyId: company.id,
        provider: data.provider,
        displayName: data.displayName,
        credentials: data.credentials,
        settings: mergedSettings,
        isVerified: false,
        isActive: true,
      })
      .returning({
        id: integrationAccounts.id,
        provider: integrationAccounts.provider,
        displayName: integrationAccounts.displayName,
        isVerified: integrationAccounts.isVerified,
        isActive: integrationAccounts.isActive,
        settings: integrationAccounts.settings,
        createdAt: integrationAccounts.createdAt,
      });

    if (!account) {
      return NextResponse.json(
        { error: "Failed to create integration account" },
        { status: 500 }
      );
    }

    // Generate webhook URL based on provider
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.buzzi.ai";
    const webhookUrl = `${baseUrl}/api/webhook/whatsapp/calls`;

    return NextResponse.json({
      account: {
        ...account,
        // Expose phoneNumber and webhookSecret at top level for backward compatibility
        phoneNumber: account.settings?.phone_number || null,
        webhookSecret: account.settings?.webhook_secret || null,
        webhookUrl,
      },
    });
  } catch (error) {
    console.error("[IntegrationAccountsAPI] Error creating account:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create integration account" },
      { status: 500 }
    );
  }
}
