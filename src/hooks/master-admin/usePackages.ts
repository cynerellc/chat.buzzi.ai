import useSWR from "swr";

import type { PackagesListResponse, PackageListItem } from "@/app/api/master-admin/packages/route";
import type { PackageDetails } from "@/app/api/master-admin/packages/[packageId]/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type { PackageListItem, PackageDetails };

export interface UsePackagesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  isActive?: boolean | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UsePackagesReturn {
  packages: PackageListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function usePackages(params: UsePackagesParams = {}): UsePackagesReturn {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.search) searchParams.set("search", params.search);
  if (params.category) searchParams.set("category", params.category);
  if (params.isActive !== undefined && params.isActive !== null) {
    searchParams.set("isActive", String(params.isActive));
  }
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const queryString = searchParams.toString();
  const url = `/api/master-admin/packages${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<PackagesListResponse>(
    url,
    fetcher
  );

  return {
    packages: data?.packages ?? [],
    pagination: data?.pagination ?? {
      page: 1,
      pageSize: 50,
      totalItems: 0,
      totalPages: 0,
    },
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Hook for single package details
export interface UsePackageReturn {
  package: PackageDetails | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function usePackage(packageId: string | null): UsePackageReturn {
  const { data, error, isLoading, mutate } = useSWR<{ package: PackageDetails }>(
    packageId ? `/api/master-admin/packages/${packageId}` : null,
    fetcher
  );

  return {
    package: data?.package ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Create package function
export interface CreatePackageData {
  name: string;
  description?: string;
  category?: string;
  defaultSystemPrompt: string;
  defaultModelId?: string;
  defaultTemperature?: number;
  defaultBehavior?: Record<string, unknown>;
  features?: string[];
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export async function createPackage(data: CreatePackageData): Promise<PackageListItem> {
  const res = await fetch("/api/master-admin/packages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to create package");
  }

  const result = await res.json();
  return result.package;
}

// Update package function
export interface UpdatePackageData {
  name?: string;
  description?: string | null;
  category?: string | null;
  defaultSystemPrompt?: string;
  defaultModelId?: string;
  defaultTemperature?: number;
  defaultBehavior?: Record<string, unknown>;
  features?: string[];
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export async function updatePackage(packageId: string, data: UpdatePackageData): Promise<PackageListItem> {
  const res = await fetch(`/api/master-admin/packages/${packageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to update package");
  }

  const result = await res.json();
  return result.package;
}

// Delete package function
export async function deletePackage(packageId: string): Promise<{ deactivated?: boolean }> {
  const res = await fetch(`/api/master-admin/packages/${packageId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to delete package");
  }

  return res.json();
}
