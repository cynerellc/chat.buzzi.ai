import useSWR from "swr";

import type { ActiveModelsResponse } from "@/app/api/shared/models/route";
import type { ActiveModelInfo } from "@/lib/ai/models-cache";
import type { ModelSettingsSchema, ModelSettingDefinition } from "@/lib/db/schema";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type { ActiveModelInfo, ModelSettingsSchema };

export interface UseActiveModelsReturn {
  models: ActiveModelInfo[];
  defaultModel: ActiveModelInfo | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
  getModelById: (modelId: string) => ActiveModelInfo | undefined;
  getDefaultSettings: (modelId: string) => Record<string, unknown>;
}

/**
 * Hook for fetching active models for agent configuration.
 * Returns models without pricing info (suitable for company admins).
 */
export function useActiveModels(): UseActiveModelsReturn {
  const { data, error, isLoading, mutate } = useSWR<ActiveModelsResponse>(
    "/api/shared/models",
    fetcher
  );

  const models = data?.models ?? [];
  const defaultModel = models.find((m) => m.isDefault) ?? null;

  // Get model by modelId (the string ID like "gpt-5-mini-2025-08-07")
  const getModelById = (modelId: string): ActiveModelInfo | undefined => {
    return models.find((m) => m.modelId === modelId);
  };

  // Get default settings for a model based on its settings schema
  const getDefaultSettings = (modelId: string): Record<string, unknown> => {
    const model = getModelById(modelId);
    if (!model || !model.settingsSchema) return {};

    const defaults: Record<string, unknown> = {};
    for (const [key, setting] of Object.entries(model.settingsSchema)) {
      defaults[key] = (setting as ModelSettingDefinition).default;
    }
    return defaults;
  };

  return {
    models,
    defaultModel,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
    getModelById,
    getDefaultSettings,
  };
}
