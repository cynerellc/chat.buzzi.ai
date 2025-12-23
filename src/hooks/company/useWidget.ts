import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { WidgetConfigResponse } from "@/app/api/company/widget/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Widget Config Hook
export function useWidgetConfig() {
  const { data, error, isLoading, mutate } = useSWR<{ config: WidgetConfigResponse }>(
    "/api/company/widget",
    fetcher
  );

  return {
    config: data?.config ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Update Widget Config Mutation
async function updateWidgetConfig(
  url: string,
  { arg }: { arg: Partial<WidgetConfigResponse> }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update widget configuration");
  }

  return response.json();
}

export function useUpdateWidgetConfig() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/widget",
    updateWidgetConfig
  );

  return {
    updateConfig: trigger,
    isUpdating: isMutating,
    error,
  };
}
