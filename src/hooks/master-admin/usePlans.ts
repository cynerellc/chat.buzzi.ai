import useSWR from "swr";

import type { PlansListResponse, PlanListItem } from "@/app/api/master-admin/plans/route";
import type { PlanDetails } from "@/app/api/master-admin/plans/[planId]/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type { PlanListItem, PlanDetails };

export interface UsePlansParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean | null;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UsePlansReturn {
  plans: PlanListItem[];
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

export function usePlans(params: UsePlansParams = {}): UsePlansReturn {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.search) searchParams.set("search", params.search);
  if (params.isActive !== undefined && params.isActive !== null) {
    searchParams.set("isActive", String(params.isActive));
  }
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const queryString = searchParams.toString();
  const url = `/api/master-admin/plans${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<PlansListResponse>(
    url,
    fetcher
  );

  return {
    plans: data?.plans ?? [],
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

// Hook for single plan details
export interface UsePlanReturn {
  plan: PlanDetails | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function usePlan(planId: string | null): UsePlanReturn {
  const { data, error, isLoading, mutate } = useSWR<{ plan: PlanDetails }>(
    planId ? `/api/master-admin/plans/${planId}` : null,
    fetcher
  );

  return {
    plan: data?.plan ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Create plan function
export interface CreatePlanData {
  name: string;
  description?: string;
  basePrice: string | number;
  currency?: string;
  maxAgents: number;
  maxConversationsPerMonth: number;
  maxKnowledgeSources: number;
  maxStorageGb: number;
  maxTeamMembers: number;
  features?: string[];
  customBranding?: boolean;
  prioritySupport?: boolean;
  apiAccess?: boolean;
  advancedAnalytics?: boolean;
  customIntegrations?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  trialDays?: number;
}

export async function createPlan(data: CreatePlanData): Promise<PlanListItem> {
  const res = await fetch("/api/master-admin/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to create plan");
  }

  const result = await res.json();
  return result.plan;
}

// Update plan function
export interface UpdatePlanData {
  name?: string;
  description?: string | null;
  basePrice?: string | number;
  currency?: string;
  maxAgents?: number;
  maxConversationsPerMonth?: number;
  maxKnowledgeSources?: number;
  maxStorageGb?: number;
  maxTeamMembers?: number;
  features?: string[];
  customBranding?: boolean;
  prioritySupport?: boolean;
  apiAccess?: boolean;
  advancedAnalytics?: boolean;
  customIntegrations?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  trialDays?: number;
}

export async function updatePlan(planId: string, data: UpdatePlanData): Promise<PlanListItem> {
  const res = await fetch(`/api/master-admin/plans/${planId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to update plan");
  }

  const result = await res.json();
  return result.plan;
}

// Delete plan function
export async function deletePlan(planId: string): Promise<void> {
  const res = await fetch(`/api/master-admin/plans/${planId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to delete plan");
  }
}
