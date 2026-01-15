import useSWR from "swr";

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
    isLoading,
    isError: error,
    mutate,
  };
}
