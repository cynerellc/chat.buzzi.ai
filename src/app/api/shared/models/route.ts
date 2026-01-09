import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/guards";
import { getActiveModels, type ActiveModelInfo } from "@/lib/ai/models-cache";

export interface ActiveModelsResponse {
  models: ActiveModelInfo[];
}

// GET /api/shared/models - Get active models for agent configuration
export async function GET() {
  try {
    await requireAuth();

    // Get models from in-memory cache (loads from DB on first call)
    const models = await getActiveModels();

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching active models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
