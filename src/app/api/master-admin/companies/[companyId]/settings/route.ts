import { and, eq, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, deviceSessions, users, companyPermissions } from "@/lib/db/schema";

// Settings interfaces
export interface NotificationSettings {
  emailNotifications: boolean;
  escalationAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
}

export interface SecuritySettings {
  requireTwoFactor: boolean;
  sessionTimeout: number;
  ipWhitelist: string[];
  allowPublicApi: boolean;
}

export interface FeatureSettings {
  callEnabled: boolean;
}

export interface CompanySettingsResponse {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  locale: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  customDomainVerified: boolean;
  hasApiKey: boolean;
  apiKeyPrefix: string | null;
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
  features: FeatureSettings;
}

// Update settings schema
const updateSettingsSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().optional().nullable(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customDomain: z.string().optional().nullable(),
  notificationSettings: z.object({
    emailNotifications: z.boolean(),
    escalationAlerts: z.boolean(),
    dailyDigest: z.boolean(),
    weeklyReport: z.boolean(),
  }).optional(),
  securitySettings: z.object({
    requireTwoFactor: z.boolean(),
    sessionTimeout: z.number().min(5).max(480),
    ipWhitelist: z.array(z.string()),
    allowPublicApi: z.boolean(),
  }).optional(),
  features: z.object({
    callEnabled: z.boolean(),
  }).optional(),
});

// Default settings
const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  escalationAlerts: true,
  dailyDigest: false,
  weeklyReport: true,
};

const defaultSecuritySettings: SecuritySettings = {
  requireTwoFactor: false,
  sessionTimeout: 60,
  ipWhitelist: [],
  allowPublicApi: false,
};

const defaultFeatureSettings: FeatureSettings = {
  callEnabled: false,
};

interface CompanySettings {
  notificationSettings?: NotificationSettings;
  securitySettings?: SecuritySettings;
  features?: FeatureSettings;
  [key: string]: unknown;
}

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// GET /api/master-admin/companies/[companyId]/settings - Get company settings
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;

    // Get company
    const [company] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const settings = (company.settings as CompanySettings) || {};

    const response: CompanySettingsResponse = {
      id: company.id,
      name: company.name,
      description: company.description,
      timezone: company.timezone || "UTC",
      locale: company.locale || "en",
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor || "#6437F3",
      secondaryColor: company.secondaryColor || "#2b3dd8",
      customDomain: company.customDomain,
      customDomainVerified: company.customDomainVerified ?? false,
      hasApiKey: !!company.apiKeyHash,
      apiKeyPrefix: company.apiKeyPrefix,
      notificationSettings: settings.notificationSettings || defaultNotificationSettings,
      securitySettings: settings.securitySettings || defaultSecuritySettings,
      features: settings.features || defaultFeatureSettings,
    };

    return NextResponse.json({ settings: response });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch company settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/master-admin/companies/[companyId]/settings - Update company settings
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    // Get existing company
    const [company] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Build update object for direct columns
    const updateData: Partial<typeof companies.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;
    if (data.customDomain !== undefined) {
      updateData.customDomain = data.customDomain;
      // Reset verification if domain changed
      if (data.customDomain !== company.customDomain) {
        updateData.customDomainVerified = false;
      }
    }

    // Merge settings into JSONB
    if (data.notificationSettings || data.securitySettings || data.features) {
      const existingSettings = (company.settings as CompanySettings) || {};
      const newSettings: CompanySettings = { ...existingSettings };

      if (data.notificationSettings) {
        newSettings.notificationSettings = data.notificationSettings;
      }
      if (data.securitySettings) {
        newSettings.securitySettings = data.securitySettings;
      }
      if (data.features) {
        newSettings.features = data.features;
      }

      updateData.settings = newSettings;
    }

    // Update company
    const [updated] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, companyId))
      .returning();

    return NextResponse.json({
      message: "Settings updated successfully",
      company: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating company settings:", error);
    return NextResponse.json(
      { error: "Failed to update company settings" },
      { status: 500 }
    );
  }
}

// POST /api/master-admin/companies/[companyId]/settings - API key and session actions
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Get company
    const [company] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "generate-api-key": {
        // Generate new API key
        const apiKey = `bz_${crypto.randomBytes(32).toString("hex")}`;
        const apiKeyHash = crypto
          .createHash("sha256")
          .update(apiKey)
          .digest("hex");
        const apiKeyPrefix = apiKey.substring(0, 10);

        await db
          .update(companies)
          .set({
            apiKeyHash,
            apiKeyPrefix,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        return NextResponse.json({
          apiKey,
          message: "API key generated successfully. Save this key - it won't be shown again.",
        });
      }

      case "revoke-api-key": {
        await db
          .update(companies)
          .set({
            apiKeyHash: null,
            apiKeyPrefix: null,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        return NextResponse.json({
          message: "API key revoked successfully",
        });
      }

      case "get-sessions": {
        // Get all users in this company and their sessions
        const companyUsers = await db
          .select({ userId: companyPermissions.userId })
          .from(companyPermissions)
          .where(eq(companyPermissions.companyId, companyId));

        if (companyUsers.length === 0) {
          return NextResponse.json({ sessions: [] });
        }

        const userIds = companyUsers.map((u) => u.userId);

        const activeSessions = await db
          .select({
            id: deviceSessions.id,
            userId: deviceSessions.userId,
            userName: users.name,
            userEmail: users.email,
            ipAddress: deviceSessions.ipAddress,
            deviceType: deviceSessions.deviceType,
            deviceName: deviceSessions.deviceName,
            browser: deviceSessions.browser,
            os: deviceSessions.os,
            lastActivity: deviceSessions.lastActivity,
            createdAt: deviceSessions.createdAt,
          })
          .from(deviceSessions)
          .innerJoin(users, eq(deviceSessions.userId, users.id))
          .where(
            and(
              inArray(deviceSessions.userId, userIds),
              sql`${deviceSessions.expiresAt} > NOW()`
            )
          )
          .orderBy(sql`${deviceSessions.lastActivity} DESC`);

        return NextResponse.json({ sessions: activeSessions });
      }

      case "revoke-session": {
        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
          return NextResponse.json(
            { error: "Session ID is required" },
            { status: 400 }
          );
        }

        // Verify session belongs to a user in this company
        const [session] = await db
          .select({ userId: deviceSessions.userId })
          .from(deviceSessions)
          .where(eq(deviceSessions.id, sessionId))
          .limit(1);

        if (!session) {
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          );
        }

        const [userPermission] = await db
          .select()
          .from(companyPermissions)
          .where(
            and(
              eq(companyPermissions.companyId, companyId),
              eq(companyPermissions.userId, session.userId)
            )
          )
          .limit(1);

        if (!userPermission) {
          return NextResponse.json(
            { error: "Session does not belong to a user in this company" },
            { status: 403 }
          );
        }

        // Delete the session
        await db
          .delete(deviceSessions)
          .where(eq(deviceSessions.id, sessionId));

        return NextResponse.json({
          message: "Session revoked successfully",
        });
      }

      case "revoke-all-sessions": {
        // Get all users in this company
        const companyUsers = await db
          .select({ userId: companyPermissions.userId })
          .from(companyPermissions)
          .where(eq(companyPermissions.companyId, companyId));

        if (companyUsers.length === 0) {
          return NextResponse.json({ message: "No sessions to revoke" });
        }

        const userIds = companyUsers.map((u) => u.userId);

        // Delete all sessions for these users
        await db
          .delete(deviceSessions)
          .where(inArray(deviceSessions.userId, userIds));

        return NextResponse.json({
          message: "All company sessions revoked successfully",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error performing settings action:", error);
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    );
  }
}
