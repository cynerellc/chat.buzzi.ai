import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { CompanySettings } from "@/app/api/company/settings/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Settings Hook
export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<{ settings: CompanySettings }>(
    "/api/company/settings",
    fetcher
  );

  return {
    settings: data?.settings ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Update Settings Mutation
async function updateSettings(
  url: string,
  { arg }: { arg: Partial<CompanySettings> }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update settings");
  }

  return response.json();
}

export function useUpdateSettings() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/settings",
    updateSettings
  );

  return {
    updateSettings: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Generate API Key Mutation
async function generateApiKey(url: string) {
  const response = await fetch(`${url}?action=generate-api-key`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to generate API key");
  }

  return response.json();
}

export function useGenerateApiKey() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/settings",
    generateApiKey
  );

  return {
    generateKey: trigger,
    isGenerating: isMutating,
    error,
  };
}

// Revoke API Key Mutation
async function revokeApiKey(url: string) {
  const response = await fetch(`${url}?action=revoke-api-key`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke API key");
  }

  return response.json();
}

export function useRevokeApiKey() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/settings",
    revokeApiKey
  );

  return {
    revokeKey: trigger,
    isRevoking: isMutating,
    error,
  };
}
