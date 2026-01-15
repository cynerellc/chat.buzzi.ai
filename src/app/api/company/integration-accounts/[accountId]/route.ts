/**
 * Integration Account API - Individual Account
 *
 * Endpoints for managing a specific integration account.
 * GET, PUT, DELETE operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { integrationAccounts } from "@/lib/db/schema/calls";
import { eq, and, isNull } from "drizzle-orm";
import { requireCompanyAdmin } from "@/lib/auth/guards";

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  accountId: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const updateIntegrationSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  phoneNumber: z.string().optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// GET - Get Single Integration Account
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { accountId } = await params;

    // Auth check
    const { company } = await requireCompanyAdmin();

    // Fetch integration account
    const [account] = await db
      .select()
      .from(integrationAccounts)
      .where(
        and(
          eq(integrationAccounts.id, accountId),
          eq(integrationAccounts.companyId, company.id),
          isNull(integrationAccounts.deletedAt)
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json(
        { error: "Integration account not found" },
        { status: 404 }
      );
    }

    // Don't return sensitive credentials
    const { credentials, ...safeAccount } = account;
    const maskedCredentials = Object.keys(credentials as object || {}).reduce(
      (acc, key) => ({ ...acc, [key]: "********" }),
      {}
    );
    const webhookSecret = account.settings?.webhook_secret;

    return NextResponse.json({
      account: {
        ...safeAccount,
        credentials: maskedCredentials,
        hasWebhookSecret: !!webhookSecret,
        // Backward compatibility: expose phoneNumber at top level
        phoneNumber: account.settings?.phone_number || null,
      },
    });
  } catch (error) {
    console.error("[IntegrationAccountAPI] Error fetching account:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch integration account" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Integration Account
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { accountId } = await params;

    // Auth check
    const { company } = await requireCompanyAdmin();

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateIntegrationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check account exists and belongs to company
    const [existing] = await db
      .select({ id: integrationAccounts.id })
      .from(integrationAccounts)
      .where(
        and(
          eq(integrationAccounts.id, accountId),
          eq(integrationAccounts.companyId, company.id),
          isNull(integrationAccounts.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Integration account not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName;
    }
    if (data.credentials !== undefined) {
      updateData.credentials = data.credentials;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    // Merge settings (phoneNumber goes into settings.phone_number)
    if (data.settings !== undefined || data.phoneNumber !== undefined) {
      // First get existing settings
      const [existingAccount] = await db
        .select({ settings: integrationAccounts.settings })
        .from(integrationAccounts)
        .where(eq(integrationAccounts.id, accountId))
        .limit(1);

      const existingSettings = existingAccount?.settings || {};
      updateData.settings = {
        ...existingSettings,
        ...(data.settings || {}),
        ...(data.phoneNumber !== undefined ? { phone_number: data.phoneNumber } : {}),
      };
    }

    // Update account
    const [updated] = await db
      .update(integrationAccounts)
      .set(updateData)
      .where(eq(integrationAccounts.id, accountId))
      .returning({
        id: integrationAccounts.id,
        provider: integrationAccounts.provider,
        displayName: integrationAccounts.displayName,
        isVerified: integrationAccounts.isVerified,
        isActive: integrationAccounts.isActive,
        settings: integrationAccounts.settings,
        updatedAt: integrationAccounts.updatedAt,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update integration account" },
        { status: 500 }
      );
    }

    // Include phoneNumber at top level for backward compatibility
    return NextResponse.json({
      account: {
        ...updated,
        phoneNumber: updated.settings?.phone_number || null,
      },
    });
  } catch (error) {
    console.error("[IntegrationAccountAPI] Error updating account:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update integration account" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Soft Delete Integration Account
// ============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { accountId } = await params;

    // Auth check
    const { company } = await requireCompanyAdmin();

    // Check account exists and belongs to company
    const [existing] = await db
      .select({ id: integrationAccounts.id })
      .from(integrationAccounts)
      .where(
        and(
          eq(integrationAccounts.id, accountId),
          eq(integrationAccounts.companyId, company.id),
          isNull(integrationAccounts.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Integration account not found" },
        { status: 404 }
      );
    }

    // Soft delete
    await db
      .update(integrationAccounts)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(integrationAccounts.id, accountId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[IntegrationAccountAPI] Error deleting account:", error);
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete integration account" },
      { status: 500 }
    );
  }
}
