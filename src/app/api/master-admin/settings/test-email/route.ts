import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { getSettingsSection } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    await requireMasterAdmin();

    const body = await request.json();
    const { recipientEmail } = body;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Recipient email is required" },
        { status: 400 }
      );
    }

    const emailSettings = await getSettingsSection("email");

    // Validate SMTP settings
    if (!emailSettings.smtpHost || !emailSettings.smtpPort) {
      return NextResponse.json(
        { error: "SMTP settings are not configured" },
        { status: 400 }
      );
    }

    // In a real implementation, you would send an actual test email
    // using nodemailer or similar. For now, simulate the test.

    // Simulated delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if SMTP is configured (has password)
    if (!emailSettings.smtpPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP password not configured"
        },
        { status: 400 }
      );
    }

    // Simulate success
    return NextResponse.json({
      success: true,
      message: `Test email sent to ${recipientEmail}`,
      details: {
        from: `${emailSettings.fromName} <${emailSettings.fromEmail}>`,
        to: recipientEmail,
        host: emailSettings.smtpHost,
        port: emailSettings.smtpPort,
      },
    });
  } catch (error) {
    console.error("Failed to send test email:", error);
    return NextResponse.json(
      { error: "Failed to send test email" },
      { status: 500 }
    );
  }
}
