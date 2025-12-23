"use client";

import useSWR from "swr";

import type { SystemHealth } from "@/app/api/master-admin/dashboard/health/route";

const fetcher = async (url: string): Promise<SystemHealth> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch system health");
  }
  return res.json();
};

export function useSystemHealth() {
  const { data, error, isLoading, mutate } = useSWR<SystemHealth>(
    "/api/master-admin/dashboard/health",
    fetcher,
    {
      refreshInterval: 60000, // Refresh every 60 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    health: data,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
