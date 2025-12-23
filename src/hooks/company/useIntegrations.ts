import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { IntegrationsResponse } from "@/app/api/company/integrations/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Integrations Hook
export function useIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<IntegrationsResponse>(
    "/api/company/integrations",
    fetcher
  );

  return {
    integrations: data?.integrations ?? [],
    webhooks: data?.webhooks ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Create Webhook Mutation
async function createWebhook(
  url: string,
  { arg }: { arg: { name: string; url: string; events: string[]; description?: string; secret?: string } }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create webhook");
  }

  return response.json();
}

export function useCreateWebhook() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/integrations",
    createWebhook
  );

  return {
    createWebhook: trigger,
    isCreating: isMutating,
    error,
  };
}
