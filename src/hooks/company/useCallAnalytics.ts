/**
 * Call Analytics Hook
 *
 * React hook for fetching call analytics data.
 */

import useSWR from "swr";

import type { CallAnalyticsResponse } from "@/app/api/company/analytics/calls/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Call Analytics Hook
export function useCallAnalytics(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR<CallAnalyticsResponse>(
    `/api/company/analytics/calls?days=${days}`,
    fetcher
  );

  return {
    summary: data?.summary ?? null,
    dailyMetrics: data?.dailyMetrics ?? [],
    sourceBreakdown: data?.sourceBreakdown ?? {},
    aiProviderBreakdown: data?.aiProviderBreakdown ?? {},
    statusBreakdown: data?.statusBreakdown ?? {},
    topChatbots: data?.topChatbots ?? [],
    recentCalls: data?.recentCalls ?? [],
    dateRange: data?.dateRange ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}
