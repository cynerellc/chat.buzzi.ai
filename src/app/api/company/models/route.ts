import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { aiModels, type ModelSettingsSchema } from "@/lib/db/schema";

// Response type for company models endpoint
export interface CompanyModelItem {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  displayName: string;
  description: string | null;
  modelType: "chat" | "call" | "both";
  settingsSchema: ModelSettingsSchema;
}

export interface CompanyModelsResponse {
  models: CompanyModelItem[];
}

/**
 * GET /api/company/models
 * List active models available to company admins (read-only)
 * Primarily used for call model selection in chatbot settings
 */
export async function GET(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const { searchParams } = new URL(request.url);
    const modelType = searchParams.get("type") as "chat" | "call" | "both" | null;

    // Build query conditions
    const conditions = [eq(aiModels.isActive, true)];

    // Filter by model type if specified
    if (modelType === "call") {
      // Return models that support calls (call or both)
      conditions.push(
        eq(aiModels.modelType, "call")
      );
    } else if (modelType === "chat") {
      conditions.push(eq(aiModels.modelType, "chat"));
    } else if (modelType === "both") {
      conditions.push(eq(aiModels.modelType, "both"));
    }

    // Fetch active models
    const models = await db
      .select({
        id: aiModels.id,
        provider: aiModels.provider,
        modelId: aiModels.modelId,
        displayName: aiModels.displayName,
        description: aiModels.description,
        modelType: aiModels.modelType,
        settingsSchema: aiModels.settingsSchema,
      })
      .from(aiModels)
      .where(and(...conditions))
      .orderBy(aiModels.sortOrder);

    // If filtering for call models, also include 'both' type
    let allModels = models;
    if (modelType === "call") {
      const bothModels = await db
        .select({
          id: aiModels.id,
          provider: aiModels.provider,
          modelId: aiModels.modelId,
          displayName: aiModels.displayName,
          description: aiModels.description,
          modelType: aiModels.modelType,
          settingsSchema: aiModels.settingsSchema,
        })
        .from(aiModels)
        .where(and(eq(aiModels.isActive, true), eq(aiModels.modelType, "both")))
        .orderBy(aiModels.sortOrder);

      allModels = [...models, ...bothModels];
    }

    return NextResponse.json({
      models: allModels.map((model) => ({
        ...model,
        settingsSchema: model.settingsSchema as ModelSettingsSchema,
      })),
    } satisfies CompanyModelsResponse);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
