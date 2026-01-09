import { eq, asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiModels, type ModelSettingsSchema } from "@/lib/db/schema";

/**
 * Active model info for agent configuration (no pricing info)
 */
export interface ActiveModelInfo {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  displayName: string;
  description: string | null;
  inputLimit: number;
  outputLimit: number;
  settingsSchema: ModelSettingsSchema;
  isDefault: boolean;
}

/**
 * In-memory cache for active AI models
 * Models are loaded on first access and cached indefinitely
 * Cache is invalidated when master admin modifies models
 */
let cachedModels: ActiveModelInfo[] | null = null;
let isLoading: Promise<ActiveModelInfo[]> | null = null;

/**
 * Load active models from database
 */
async function loadModelsFromDb(): Promise<ActiveModelInfo[]> {
  const dbModels = await db
    .select({
      id: aiModels.id,
      provider: aiModels.provider,
      modelId: aiModels.modelId,
      displayName: aiModels.displayName,
      description: aiModels.description,
      inputLimit: aiModels.inputLimit,
      outputLimit: aiModels.outputLimit,
      settingsSchema: aiModels.settingsSchema,
      isDefault: aiModels.isDefault,
    })
    .from(aiModels)
    .where(eq(aiModels.isActive, true))
    .orderBy(asc(aiModels.sortOrder));

  return dbModels.map((model) => ({
    id: model.id,
    provider: model.provider as "openai" | "google" | "anthropic",
    modelId: model.modelId,
    displayName: model.displayName,
    description: model.description,
    inputLimit: model.inputLimit,
    outputLimit: model.outputLimit,
    settingsSchema: model.settingsSchema as ModelSettingsSchema,
    isDefault: model.isDefault,
  }));
}

/**
 * Get active AI models from cache (loads from DB on first call)
 * Thread-safe: concurrent calls will share the same loading promise
 */
export async function getActiveModels(): Promise<ActiveModelInfo[]> {
  // Return cached models if available
  if (cachedModels !== null) {
    return cachedModels;
  }

  // If already loading, wait for that promise
  if (isLoading !== null) {
    return isLoading;
  }

  // Start loading
  isLoading = loadModelsFromDb();

  try {
    cachedModels = await isLoading;
    return cachedModels;
  } finally {
    isLoading = null;
  }
}

/**
 * Invalidate the models cache
 * Call this when master admin creates, updates, or deletes a model
 */
export function invalidateModelsCache(): void {
  cachedModels = null;
}

/**
 * Reload models cache (invalidate + load)
 * Useful for immediate cache refresh after modifications
 */
export async function reloadModelsCache(): Promise<ActiveModelInfo[]> {
  invalidateModelsCache();
  return getActiveModels();
}
