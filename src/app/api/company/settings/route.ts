import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

export interface CompanySettings {
  // General
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  locale: string;

  // Branding
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;

  // Custom Domain
  customDomain: string | null;
  customDomainVerified: boolean;

  // API Access
  hasApiKey: boolean;
  apiKeyPrefix: string | null;

  // Notification settings (from jsonb)
  notificationSettings: {
    emailNotifications: boolean;
    escalationAlerts: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
  };

  // Security settings (from jsonb)
  securitySettings: {
    requireTwoFactor: boolean;
    sessionTimeout: number; // in minutes
    ipWhitelist: string[];
    allowPublicApi: boolean;
  };

  createdAt: string;
  updatedAt: string;
}

const defaultNotificationSettings = {
  emailNotifications: true,
  escalationAlerts: true,
  dailyDigest: false,
  weeklyReport: true,
};

const defaultSecuritySettings = {
  requireTwoFactor: false,
  sessionTimeout: 60,
  ipWhitelist: [],
  allowPublicApi: false,
};

export async function GET() {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const settings = company.settings as Record<string, unknown> | null;

    const response: CompanySettings = {
      id: company.id,
      name: company.name,
      slug: company.slug,
      description: company.description,
      timezone: company.timezone ?? "UTC",
      locale: company.locale ?? "en",
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor ?? "#6437F3",
      secondaryColor: company.secondaryColor ?? "#2b3dd8",
      customDomain: company.customDomain,
      customDomainVerified: company.customDomainVerified ?? false,
      hasApiKey: !!company.apiKeyHash,
      apiKeyPrefix: company.apiKeyPrefix,
      notificationSettings: {
        ...defaultNotificationSettings,
        ...(settings?.notifications as Record<string, unknown> | undefined),
      },
      securitySettings: {
        ...defaultSecuritySettings,
        ...(settings?.security as Record<string, unknown> | undefined),
      },
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };

    return NextResponse.json({ settings: response });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

interface UpdateSettingsRequest {
  // General
  name?: string;
  description?: string | null;
  timezone?: string;
  locale?: string;

  // Branding
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;

  // Custom Domain
  customDomain?: string | null;

  // Notification settings
  notificationSettings?: {
    emailNotifications?: boolean;
    escalationAlerts?: boolean;
    dailyDigest?: boolean;
    weeklyReport?: boolean;
  };

  // Security settings
  securitySettings?: {
    requireTwoFactor?: boolean;
    sessionTimeout?: number;
    ipWhitelist?: string[];
    allowPublicApi?: boolean;
  };
}

export async function PATCH(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: UpdateSettingsRequest = await request.json();
    const currentSettings = (company.settings as Record<string, unknown>) || {};

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // General settings
    if (body.name !== undefined) {
      if (!body.name || body.name.length < 2) {
        return NextResponse.json(
          { error: "Company name must be at least 2 characters" },
          { status: 400 }
        );
      }
      updateData.name = body.name;
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.locale !== undefined) updateData.locale = body.locale;

    // Branding
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.primaryColor !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(body.primaryColor)) {
        return NextResponse.json(
          { error: "Invalid primary color format" },
          { status: 400 }
        );
      }
      updateData.primaryColor = body.primaryColor;
    }
    if (body.secondaryColor !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(body.secondaryColor)) {
        return NextResponse.json(
          { error: "Invalid secondary color format" },
          { status: 400 }
        );
      }
      updateData.secondaryColor = body.secondaryColor;
    }

    // Custom Domain
    if (body.customDomain !== undefined) {
      updateData.customDomain = body.customDomain || null;
      updateData.customDomainVerified = false; // Reset verification on change
    }

    // Merge notification and security settings into jsonb
    const newSettings = { ...currentSettings };

    if (body.notificationSettings) {
      newSettings.notifications = {
        ...(currentSettings.notifications as Record<string, unknown> | undefined),
        ...body.notificationSettings,
      };
    }

    if (body.securitySettings) {
      newSettings.security = {
        ...(currentSettings.security as Record<string, unknown> | undefined),
        ...body.securitySettings,
      };
    }

    if (body.notificationSettings || body.securitySettings) {
      updateData.settings = newSettings;
    }

    const [updatedCompany] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, company.id))
      .returning();

    if (!updatedCompany) {
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    const updatedSettings = updatedCompany.settings as Record<string, unknown> | null;

    const response: CompanySettings = {
      id: updatedCompany.id,
      name: updatedCompany.name,
      slug: updatedCompany.slug,
      description: updatedCompany.description,
      timezone: updatedCompany.timezone ?? "UTC",
      locale: updatedCompany.locale ?? "en",
      logoUrl: updatedCompany.logoUrl,
      primaryColor: updatedCompany.primaryColor ?? "#6437F3",
      secondaryColor: updatedCompany.secondaryColor ?? "#2b3dd8",
      customDomain: updatedCompany.customDomain,
      customDomainVerified: updatedCompany.customDomainVerified ?? false,
      hasApiKey: !!updatedCompany.apiKeyHash,
      apiKeyPrefix: updatedCompany.apiKeyPrefix,
      notificationSettings: {
        ...defaultNotificationSettings,
        ...(updatedSettings?.notifications as Record<string, unknown> | undefined),
      },
      securitySettings: {
        ...defaultSecuritySettings,
        ...(updatedSettings?.security as Record<string, unknown> | undefined),
      },
      createdAt: updatedCompany.createdAt.toISOString(),
      updatedAt: updatedCompany.updatedAt.toISOString(),
    };

    return NextResponse.json({ settings: response });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

// Generate new API key
export async function POST(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "generate-api-key") {
      // Generate a new API key
      const apiKey = `bz_${randomBytes(32).toString("hex")}`;
      const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
      const apiKeyPrefix = apiKey.substring(0, 10);

      await db
        .update(companies)
        .set({
          apiKeyHash,
          apiKeyPrefix,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, company.id));

      // Return the full key only once - it won't be retrievable later
      return NextResponse.json({
        apiKey,
        apiKeyPrefix,
        message: "API key generated. Save it now - it won't be shown again.",
      });
    }

    if (action === "revoke-api-key") {
      await db
        .update(companies)
        .set({
          apiKeyHash: null,
          apiKeyPrefix: null,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, company.id));

      return NextResponse.json({ message: "API key revoked successfully" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error with API key action:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
