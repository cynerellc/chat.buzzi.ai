import useSWR from "swr";

import type { BillingResponse } from "@/app/api/company/billing/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Billing Hook
export function useBilling() {
  const { data, error, isLoading, mutate } = useSWR<BillingResponse>(
    "/api/company/billing",
    fetcher
  );

  return {
    subscription: data?.subscription ?? null,
    currentPlan: data?.currentPlan ?? null,
    availablePlans: data?.availablePlans ?? [],
    paymentHistory: data?.paymentHistory ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}
