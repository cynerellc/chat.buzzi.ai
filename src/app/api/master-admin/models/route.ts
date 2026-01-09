import { eq, count, and, asc, desc, or, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { invalidateModelsCache } from "@/lib/ai/models-cache";
import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { aiModels, type ModelSettingsSchema } from "@/lib/db/schema";

// Response type for list endpoint
export interface ModelListItem {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  displayName: string;
  description: string | null;
  inputLimit: number;
  outputLimit: number;
  inputPricePerMillion: string | null;
  outputPricePerMillion: string | null;
  cachedInputPrice: string | null;
  settingsSchema: ModelSettingsSchema;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelsListResponse {
  models: ModelListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// GET /api/master-admin/models - List all models
export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50");
    const search = searchParams.get("search") ?? "";
    const provider = searchParams.get("provider");
    const isActive = searchParams.get("isActive");
    const sortBy = searchParams.get("sortBy") ?? "sortOrder";
    const sortOrder = searchParams.get("sortOrder") ?? "asc";

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(aiModels.modelId, `%${search}%`),
          ilike(aiModels.displayName, `%${search}%`),
          ilike(aiModels.description, `%${search}%`)
        )
      );
    }

    if (provider && provider !== "all") {
      conditions.push(eq(aiModels.provider, provider as "openai" | "google" | "anthropic"));
    }

    if (isActive !== null && isActive !== "") {
      conditions.push(eq(aiModels.isActive, isActive === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(aiModels)
      .where(whereClause);

    const totalItems = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get models
    const orderColumn =
      sortBy === "displayName"
        ? aiModels.displayName
        : sortBy === "provider"
          ? aiModels.provider
          : sortBy === "createdAt"
            ? aiModels.createdAt
            : aiModels.sortOrder;

    const orderDir = sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn);

    const models = await db
      .select()
      .from(aiModels)
      .where(whereClause)
      .orderBy(orderDir)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const modelsWithTypes: ModelListItem[] = models.map((model) => ({
      id: model.id,
      provider: model.provider as "openai" | "google" | "anthropic",
      modelId: model.modelId,
      displayName: model.displayName,
      description: model.description,
      inputLimit: model.inputLimit,
      outputLimit: model.outputLimit,
      inputPricePerMillion: model.inputPricePerMillion,
      outputPricePerMillion: model.outputPricePerMillion,
      cachedInputPrice: model.cachedInputPrice,
      settingsSchema: model.settingsSchema,
      isActive: model.isActive,
      isDefault: model.isDefault,
      sortOrder: model.sortOrder,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    }));

    const response: ModelsListResponse = {
      models: modelsWithTypes,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
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

// Create model schema
const createModelSchema = z.object({
  provider: z.enum(["openai", "google", "anthropic"]),
  modelId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  inputLimit: z.number().int().positive(),
  outputLimit: z.number().int().positive(),
  inputPricePerMillion: z.string().optional(),
  outputPricePerMillion: z.string().optional(),
  cachedInputPrice: z.string().optional(),
  settingsSchema: z.record(z.string(), modelSettingDefinitionSchema).default({}),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

// POST /api/master-admin/models - Create a new model
export async function POST(request: NextRequest) {
  try {
    await requireMasterAdmin();
    const body = await request.json();
    const validatedData = createModelSchema.parse(body);

    // Check for modelId uniqueness
    const existingModel = await db
      .select({ id: aiModels.id })
      .from(aiModels)
      .where(eq(aiModels.modelId, validatedData.modelId))
      .limit(1);

    if (existingModel.length > 0) {
      return NextResponse.json(
        { error: "Model ID already exists" },
        { status: 409 }
      );
    }

    // If this is the default model, unset other defaults
    if (validatedData.isDefault) {
      await db
        .update(aiModels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(aiModels.isDefault, true));
    }

    // Create the model
    const [newModel] = await db
      .insert(aiModels)
      .values({
        provider: validatedData.provider,
        modelId: validatedData.modelId,
        displayName: validatedData.displayName,
        description: validatedData.description ?? null,
        inputLimit: validatedData.inputLimit,
        outputLimit: validatedData.outputLimit,
        inputPricePerMillion: validatedData.inputPricePerMillion ?? null,
        outputPricePerMillion: validatedData.outputPricePerMillion ?? null,
        cachedInputPrice: validatedData.cachedInputPrice ?? null,
        settingsSchema: validatedData.settingsSchema,
        isActive: validatedData.isActive,
        isDefault: validatedData.isDefault,
        sortOrder: validatedData.sortOrder,
      })
      .returning();

    if (!newModel) {
      return NextResponse.json({ error: "Failed to create model" }, { status: 500 });
    }

    // Invalidate in-memory models cache
    invalidateModelsCache();

    return NextResponse.json(
      {
        model: {
          id: newModel.id,
          provider: newModel.provider as "openai" | "google" | "anthropic",
          modelId: newModel.modelId,
          displayName: newModel.displayName,
          description: newModel.description,
          inputLimit: newModel.inputLimit,
          outputLimit: newModel.outputLimit,
          inputPricePerMillion: newModel.inputPricePerMillion,
          outputPricePerMillion: newModel.outputPricePerMillion,
          cachedInputPrice: newModel.cachedInputPrice,
          settingsSchema: newModel.settingsSchema,
          isActive: newModel.isActive,
          isDefault: newModel.isDefault,
          sortOrder: newModel.sortOrder,
          createdAt: newModel.createdAt.toISOString(),
          updatedAt: newModel.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating model:", error);
    return NextResponse.json({ error: "Failed to create model" }, { status: 500 });
  }
}
