import useSWR from "swr";

import type {
  CompaniesListResponse,
  CompanyListItem,
} from "@/app/api/master-admin/companies/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch companies");
  }
  return res.json();
};

export interface UseCompaniesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UseCompaniesReturn {
  companies: CompanyListItem[];
  pagination: CompaniesListResponse["pagination"] | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompanies(options: UseCompaniesOptions = {}): UseCompaniesReturn {
  const {
    page = 1,
    pageSize = 10,
    search = "",
    status,
    planId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  // Build query string
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("pageSize", pageSize.toString());
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrder);
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (planId) params.set("planId", planId);

  const url = `/api/master-admin/companies?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<CompaniesListResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
    }
  );

  return {
    companies: data?.companies ?? [],
    pagination: data?.pagination ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Create company mutation
export async function createCompany(data: {
  name: string;
  domain?: string;
  planId?: string;
  adminName: string;
  adminEmail: string;
  sendWelcomeEmail?: boolean;
}) {
  const res = await fetch("/api/master-admin/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to create company");
  }

  return res.json();
}

// Bulk delete companies
export async function deleteCompanies(companyIds: string[]) {
  const results = await Promise.all(
    companyIds.map(async (id) => {
      const res = await fetch(`/api/master-admin/companies/${id}`, {
        method: "DELETE",
      });
      return { id, success: res.ok };
    })
  );

  return results;
}

// Bulk update company status
export async function updateCompaniesStatus(
  companyIds: string[],
  status: "active" | "trial" | "cancelled"
) {
  const results = await Promise.all(
    companyIds.map(async (id) => {
      const res = await fetch(`/api/master-admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return { id, success: res.ok };
    })
  );

  return results;
}
