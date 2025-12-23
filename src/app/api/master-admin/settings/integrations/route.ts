import { NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { getIntegrationStatus } from "@/lib/settings";

export async function GET() {
  try {
    await requireMasterAdmin();

    const integrations = await getIntegrationStatus();

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error("Failed to fetch integration status:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration status" },
      { status: 500 }
    );
  }
}
