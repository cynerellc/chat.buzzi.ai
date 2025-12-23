import useSWR from "swr";

import type { AnalyticsResponse } from "@/app/api/company/analytics/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Analytics Hook
export function useAnalytics(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsResponse>(
    `/api/company/analytics?days=${days}`,
    fetcher
  );

  return {
    summary: data?.summary ?? null,
    dailyMetrics: data?.dailyMetrics ?? [],
    hourlyMetrics: data?.hourlyMetrics ?? [],
    topTopics: data?.topTopics ?? [],
    channelBreakdown: data?.channelBreakdown ?? {},
    dateRange: data?.dateRange ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}
