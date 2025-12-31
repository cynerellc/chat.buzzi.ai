"use client";

import useSWR from "swr";

import type { DashboardStats } from "@/app/api/master-admin/dashboard/stats/route";

const fetcher = async (url: string): Promise<DashboardStats> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch dashboard stats");
  }
  return res.json();
};

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/api/master-admin/dashboard/stats",
    fetcher,
    {
      refreshInterval: 60000, // Refresh every 60 seconds
      revalidateOnFocus: false, // M8: Prevent extra fetches on tab focus
    }
  );

  return {
    stats: data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
