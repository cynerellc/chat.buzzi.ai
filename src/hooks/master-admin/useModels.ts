import useSWR from "swr";

import type { ModelsListResponse, ModelListItem } from "@/app/api/master-admin/models/route";
import type { ModelSettingsSchema } from "@/lib/db/schema";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type { ModelListItem, ModelSettingsSchema };

export interface UseModelsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  provider?: "openai" | "google" | "anthropic" | "all";
  isActive?: boolean | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UseModelsReturn {
  models: ModelListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useModels(params: UseModelsParams = {}): UseModelsReturn {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.search) searchParams.set("search", params.search);
  if (params.provider && params.provider !== "all") {
    searchParams.set("provider", params.provider);
  }
  if (params.isActive !== undefined && params.isActive !== null) {
    searchParams.set("isActive", String(params.isActive));
  }
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const queryString = searchParams.toString();
  const url = `/api/master-admin/models${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<ModelsListResponse>(
    url,
    fetcher
  );

  return {
    models: data?.models ?? [],
    pagination: data?.pagination ?? {
      page: 1,
      pageSize: 50,
      totalItems: 0,
      totalPages: 0,
    },
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Hook for single model details
export interface UseModelReturn {
  model: ModelListItem | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useModel(modelId: string | null): UseModelReturn {
  const { data, error, isLoading, mutate } = useSWR<{ model: ModelListItem }>(
    modelId ? `/api/master-admin/models/${modelId}` : null,
    fetcher
  );

  return {
    model: data?.model ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Create model function
export interface CreateModelData {
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  displayName: string;
  description?: string;
  modelType?: "chat" | "call" | "both";
  supportsAudio?: boolean;
  inputLimit: number;
  outputLimit: number;
  inputPricePerMillion?: string;
  outputPricePerMillion?: string;
  cachedInputPrice?: string;
  settingsSchema?: ModelSettingsSchema;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export async function createModel(data: CreateModelData): Promise<ModelListItem> {
  const res = await fetch("/api/master-admin/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to create model");
  }

  const result = await res.json();
  return result.model;
}

// Update model function
export interface UpdateModelData {
  provider?: "openai" | "google" | "anthropic";
  modelId?: string;
  displayName?: string;
  description?: string | null;
  modelType?: "chat" | "call" | "both";
  supportsAudio?: boolean;
  inputLimit?: number;
  outputLimit?: number;
  inputPricePerMillion?: string | null;
  outputPricePerMillion?: string | null;
  cachedInputPrice?: string | null;
  settingsSchema?: ModelSettingsSchema;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export async function updateModel(modelId: string, data: UpdateModelData): Promise<ModelListItem> {
  const res = await fetch(`/api/master-admin/models/${modelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to update model");
  }

  const result = await res.json();
  return result.model;
}

// Delete model function
export async function deleteModel(modelId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/master-admin/models/${modelId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to delete model");
  }

  return res.json();
}
