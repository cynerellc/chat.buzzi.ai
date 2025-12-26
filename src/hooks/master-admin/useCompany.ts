import useSWR from "swr";

import type { CompanyDetails } from "@/app/api/master-admin/companies/[companyId]/route";
import type { SubscriptionDetails } from "@/app/api/master-admin/companies/[companyId]/subscription/route";
import type { CompanyUserItem } from "@/app/api/master-admin/companies/[companyId]/users/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Company not found");
    }
    throw new Error("Failed to fetch data");
  }
  return res.json();
};

// Hook for company details
export interface UseCompanyReturn {
  company: CompanyDetails | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompany(companyId: string | null): UseCompanyReturn {
  const { data, error, isLoading, mutate } = useSWR<CompanyDetails>(
    companyId ? `/api/master-admin/companies/${companyId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    company: data ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Hook for company users
export interface UseCompanyUsersReturn {
  users: CompanyUserItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompanyUsers(companyId: string | null): UseCompanyUsersReturn {
  const { data, error, isLoading, mutate } = useSWR<{ users: CompanyUserItem[] }>(
    companyId ? `/api/master-admin/companies/${companyId}/users` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    users: data?.users ?? [],
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Hook for company subscription
export interface UseCompanySubscriptionReturn {
  subscription: SubscriptionDetails | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompanySubscription(
  companyId: string | null
): UseCompanySubscriptionReturn {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionDetails>(
    companyId ? `/api/master-admin/companies/${companyId}/subscription` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    subscription: data ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Update company mutation
export async function updateCompany(
  companyId: string,
  data: Partial<{
    name: string;
    description: string;
    domain: string | null;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    timezone: string;
    locale: string;
    status: string;
    settings: Record<string, unknown>;
  }>
) {
  const res = await fetch(`/api/master-admin/companies/${companyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to update company");
  }

  return res.json();
}

// Delete company mutation
export async function deleteCompany(companyId: string) {
  const res = await fetch(`/api/master-admin/companies/${companyId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to delete company");
  }

  return res.json();
}

// Add user to company mutation
export async function addCompanyUser(
  companyId: string,
  data: {
    email: string;
    name: string;
    role: "chatapp.company_admin" | "chatapp.support_agent";
    sendInvite?: boolean;
  }
) {
  const res = await fetch(`/api/master-admin/companies/${companyId}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to add user");
  }

  return res.json();
}

// Update subscription mutation
export async function updateCompanySubscription(
  companyId: string,
  data: Partial<{
    planId: string;
    status: string;
    billingCycle: string;
    currentPrice: string;
    cancelAtPeriodEnd: boolean;
  }>
) {
  const res = await fetch(`/api/master-admin/companies/${companyId}/subscription`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to update subscription");
  }

  return res.json();
}
