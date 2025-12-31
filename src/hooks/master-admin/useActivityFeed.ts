"use client";

import useSWR from "swr";

import type { ActivityItem } from "@/app/api/master-admin/dashboard/activity/route";

interface ActivityResponse {
  items: ActivityItem[];
  limit: number;
  offset: number;
}

const fetcher = async (url: string): Promise<ActivityResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch activity feed");
  }
  return res.json();
};

export function useActivityFeed(limit: number = 10, offset: number = 0) {
  const { data, error, isLoading, mutate } = useSWR<ActivityResponse>(
    `/api/master-admin/dashboard/activity?limit=${limit}&offset=${offset}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false, // M8: Prevent extra fetches on tab focus
    }
  );

  return {
    activities: data?.items ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
