import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_RESOURCES } from "@/lib/audit";
import {
  getSystemSettings,
  updateSystemSettings,
  maskSensitiveSettings,
  type SystemSettings,
} from "@/lib/settings";

export async function GET() {
  try {
    await requireMasterAdmin();

    const settings = await getSystemSettings();
    const maskedSettings = maskSensitiveSettings(settings);

    return NextResponse.json(maskedSettings);
  } catch (error) {
    console.error("Failed to fetch system settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch system settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireMasterAdmin();

    const body = await request.json();
    const updates = body as Partial<SystemSettings>;

    // Get current settings for audit log
    const oldSettings = await getSystemSettings();

    // Update settings
    const newSettings = await updateSystemSettings(updates);

    // Create audit log
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      resource: AUDIT_RESOURCES.SETTINGS,
      resourceId: "system",
      details: {
        sections: Object.keys(updates),
      },
      oldValues: oldSettings as unknown as Record<string, unknown>,
      newValues: newSettings as unknown as Record<string, unknown>,
    });

    const maskedSettings = maskSensitiveSettings(newSettings);
    return NextResponse.json(maskedSettings);
  } catch (error) {
    console.error("Failed to update system settings:", error);
    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 }
    );
  }
}
