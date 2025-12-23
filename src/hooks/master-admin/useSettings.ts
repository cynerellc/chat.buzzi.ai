import useSWR from "swr";

import type {
  SystemSettings,
  IntegrationStatus,
} from "@/lib/settings";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch");
  }
  return res.json();
};

// Re-export types
export type { SystemSettings, IntegrationStatus };

export interface UseSystemSettingsReturn {
  settings: SystemSettings | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useSystemSettings(): UseSystemSettingsReturn {
  const { data, error, isLoading, mutate } = useSWR<SystemSettings>(
    "/api/master-admin/settings",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    settings: data,
    isLoading,
    error,
    mutate,
  };
}

export async function updateSettings(
  updates: Partial<SystemSettings>
): Promise<SystemSettings> {
  const res = await fetch("/api/master-admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update settings");
  }

  return res.json();
}

export interface UseIntegrationsReturn {
  integrations: IntegrationStatus[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useIntegrations(): UseIntegrationsReturn {
  const { data, error, isLoading, mutate } = useSWR<{
    integrations: IntegrationStatus[];
  }>("/api/master-admin/settings/integrations", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // Refresh every minute
  });

  return {
    integrations: data?.integrations ?? [],
    isLoading,
    error,
    mutate,
  };
}

export interface TestEmailResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    from: string;
    to: string;
    host: string;
    port: number;
  };
}

export async function testEmailConnection(
  recipientEmail: string
): Promise<TestEmailResult> {
  const res = await fetch("/api/master-admin/settings/test-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientEmail }),
  });

  const data = await res.json();
  return data;
}

export interface TestAIResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    provider: string;
    model?: string;
    embeddingModel?: string;
  };
}

export async function testAIConnection(): Promise<TestAIResult> {
  const res = await fetch("/api/master-admin/settings/test-ai", {
    method: "POST",
  });

  const data = await res.json();
  return data;
}
