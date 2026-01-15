import { eq, and, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { invalidateModelsCache } from "@/lib/ai/models-cache";
import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { aiModels, type ModelSettingsSchema } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ modelId: string }>;
}

// GET /api/master-admin/models/[modelId] - Get a single model
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { modelId } = await params;

    const [model] = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, modelId))
      .limit(1);

    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    return NextResponse.json({
      model: {
        id: model.id,
        provider: model.provider as "openai" | "google" | "anthropic",
        modelId: model.modelId,
        displayName: model.displayName,
        description: model.description,
        modelType: model.modelType as "chat" | "call" | "both",
        supportsAudio: model.supportsAudio,
        inputLimit: model.inputLimit,
        outputLimit: model.outputLimit,
        inputPricePerMillion: model.inputPricePerMillion,
        outputPricePerMillion: model.outputPricePerMillion,
        cachedInputPrice: model.cachedInputPrice,
        settingsSchema: model.settingsSchema as ModelSettingsSchema,
        isActive: model.isActive,
        isDefault: model.isDefault,
        sortOrder: model.sortOrder,
        createdAt: model.createdAt.toISOString(),
        updatedAt: model.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching model:", error);
    return NextResponse.json({ error: "Failed to fetch model" }, { status: 500 });
  }
}

// Model setting definition schema for validation
const modelSettingDefinitionSchema = z.object({
  type: z.enum(["slider", "number", "select", "toggle"]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  default: z.union([z.number(), z.string(), z.boolean()]),
  options: z.array(z.string()).optional(),
  label: z.string(),
  description: z.string().optional(),
});

// Update model schema
const updateModelSchema = z.object({
  provider: z.enum(["openai", "google", "anthropic"]).optional(),
  modelId: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  modelType: z.enum(["chat", "call", "both"]).optional(),
  supportsAudio: z.boolean().optional(),
  inputLimit: z.number().int().positive().optional(),
  outputLimit: z.number().int().positive().optional(),
  inputPricePerMillion: z.string().nullable().optional(),
  outputPricePerMillion: z.string().nullable().optional(),
  cachedInputPrice: z.string().nullable().optional(),
  settingsSchema: z.record(z.string(), modelSettingDefinitionSchema).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// PATCH /api/master-admin/models/[modelId] - Update a model
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { modelId } = await params;
    const body = await request.json();
    const validatedData = updateModelSchema.parse(body);

    // Check if model exists
    const [existingModel] = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, modelId))
      .limit(1);

    if (!existingModel) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // If updating modelId, check for uniqueness
    if (validatedData.modelId && validatedData.modelId !== existingModel.modelId) {
      const [duplicate] = await db
        .select({ id: aiModels.id })
        .from(aiModels)
        .where(
          and(eq(aiModels.modelId, validatedData.modelId), ne(aiModels.id, modelId))
        )
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          { error: "Model ID already exists" },
          { status: 409 }
        );
      }
    }

    // If setting as default, unset other defaults
    if (validatedData.isDefault === true && !existingModel.isDefault) {
      await db
        .update(aiModels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(aiModels.isDefault, true));
    }

    // Update the model
    const [updatedModel] = await db
      .update(aiModels)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(aiModels.id, modelId))
      .returning();

    if (!updatedModel) {
      return NextResponse.json({ error: "Failed to update model" }, { status: 500 });
    }

    // Invalidate in-memory models cache
    invalidateModelsCache();

    return NextResponse.json({
      model: {
        id: updatedModel.id,
        provider: updatedModel.provider as "openai" | "google" | "anthropic",
        modelId: updatedModel.modelId,
        displayName: updatedModel.displayName,
        description: updatedModel.description,
        modelType: updatedModel.modelType as "chat" | "call" | "both",
        supportsAudio: updatedModel.supportsAudio,
        inputLimit: updatedModel.inputLimit,
        outputLimit: updatedModel.outputLimit,
        inputPricePerMillion: updatedModel.inputPricePerMillion,
        outputPricePerMillion: updatedModel.outputPricePerMillion,
        cachedInputPrice: updatedModel.cachedInputPrice,
        settingsSchema: updatedModel.settingsSchema as ModelSettingsSchema,
        isActive: updatedModel.isActive,
        isDefault: updatedModel.isDefault,
        sortOrder: updatedModel.sortOrder,
        createdAt: updatedModel.createdAt.toISOString(),
        updatedAt: updatedModel.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating model:", error);
    return NextResponse.json({ error: "Failed to update model" }, { status: 500 });
  }
}

// DELETE /api/master-admin/models/[modelId] - Delete a model
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { modelId } = await params;

    // Check if model exists
    const [existingModel] = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, modelId))
      .limit(1);

    if (!existingModel) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Don't allow deleting the default model
    if (existingModel.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default model. Set another model as default first." },
        { status: 400 }
      );
    }

    // Delete the model
    await db.delete(aiModels).where(eq(aiModels.id, modelId));

    // Invalidate in-memory models cache
    invalidateModelsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting model:", error);
    return NextResponse.json({ error: "Failed to delete model" }, { status: 500 });
  }
}
