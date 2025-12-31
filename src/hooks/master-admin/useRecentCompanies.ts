"use client";

import useSWR from "swr";

import type { RecentCompany } from "@/app/api/master-admin/dashboard/companies/route";

const fetcher = async (url: string): Promise<RecentCompany[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch recent companies");
  }
  return res.json();
};

export function useRecentCompanies(limit: number = 5) {
  const { data, error, isLoading, mutate } = useSWR<RecentCompany[]>(
    `/api/master-admin/dashboard/companies?limit=${limit}`,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false, // H12: Prevent duplicate fetches on tab focus
    }
  );

  return {
    companies: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
