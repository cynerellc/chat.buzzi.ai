import useSWR from "swr";

import type { CompanyModelItem, CompanyModelsResponse } from "@/app/api/company/models/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type { CompanyModelItem };

export interface UseModelsParams {
  type?: "chat" | "call" | "both";
  isActive?: boolean;
}

export interface UseModelsReturn {
  models: CompanyModelItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for company admins to fetch available models
 * Primarily used for call model selection in chatbot settings
 */
export function useModels(params: UseModelsParams = {}): UseModelsReturn {
  const searchParams = new URLSearchParams();

  if (params.type) {
    searchParams.set("type", params.type);
  }

  const queryString = searchParams.toString();
  const url = `/api/company/models${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<CompanyModelsResponse>(
    url,
    fetcher
  );

  return {
    models: data?.models ?? [],
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}
