"use client";

import useSWR from "swr";

import type {
  ChartDataPoint,
  PlanDistributionItem,
} from "@/app/api/master-admin/dashboard/charts/route";

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch chart data");
  }
  return res.json();
};

export function useActivityChartData(days: number = 30) {
  const { data, error, isLoading, mutate } = useSWR<ChartDataPoint[]>(
    `/api/master-admin/dashboard/charts?type=activity&days=${days}`,
    fetcher<ChartDataPoint[]>,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false,
    }
  );

  return {
    chartData: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}

export function usePlanDistribution() {
  const { data, error, isLoading, mutate } = useSWR<PlanDistributionItem[]>(
    `/api/master-admin/dashboard/charts?type=distribution`,
    fetcher<PlanDistributionItem[]>,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false,
    }
  );

  return {
    distribution: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
