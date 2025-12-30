import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { BillingResponse } from "@/app/api/master-admin/companies/[companyId]/billing/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Company Billing Hook
export function useCompanyBilling(companyId: string) {
  const { data, error, isLoading, mutate } = useSWR<BillingResponse>(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    fetcher
  );

  return {
    subscription: data?.subscription ?? null,
    currentPlan: data?.currentPlan ?? null,
    availablePlans: data?.availablePlans ?? [],
    paymentHistory: data?.paymentHistory ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Update Subscription Mutation
interface UpdateSubscriptionData {
  planId?: string;
  status?: "trial" | "active" | "past_due" | "grace_period" | "expired" | "cancelled";
  billingCycle?: "monthly" | "quarterly" | "semi_annual" | "annual";
  currentPrice?: string;
  cancelAtPeriodEnd?: boolean;
  conversationsUsed?: number;
  storageUsedMb?: number;
  trialEndDate?: string | null;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

async function updateSubscription(
  url: string,
  { arg }: { arg: UpdateSubscriptionData }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update subscription");
  }

  return response.json();
}

export function useUpdateCompanySubscription(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    updateSubscription
  );

  return {
    updateSubscription: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Add Payment Mutation
interface AddPaymentData {
  amount: string;
  currency?: string;
  status: "succeeded" | "failed" | "pending" | "refunded";
  invoiceNumber?: string;
  invoiceUrl?: string;
  periodStart: string;
  periodEnd: string;
}

async function addPayment(
  url: string,
  { arg }: { arg: AddPaymentData }
) {
  const response = await fetch(`${url}?action=add-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add payment");
  }

  return response.json();
}

export function useAddCompanyPayment(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    addPayment
  );

  return {
    addPayment: trigger,
    isAdding: isMutating,
    error,
  };
}

// Reset Usage Mutation
async function resetUsage(url: string) {
  const response = await fetch(`${url}?action=reset-usage`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reset usage");
  }

  return response.json();
}

export function useResetCompanyUsage(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    resetUsage
  );

  return {
    resetUsage: trigger,
    isResetting: isMutating,
    error,
  };
}

// Extend Trial Mutation
async function extendTrial(
  url: string,
  { arg }: { arg: { days: number } }
) {
  const response = await fetch(`${url}?action=extend-trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to extend trial");
  }

  return response.json();
}

export function useExtendCompanyTrial(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    extendTrial
  );

  return {
    extendTrial: (days: number) => trigger({ days }),
    isExtending: isMutating,
    error,
  };
}

// Cancel Subscription Mutation
async function cancelSubscription(
  url: string,
  { arg }: { arg: { immediate: boolean } }
) {
  const response = await fetch(`${url}?action=cancel-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to cancel subscription");
  }

  return response.json();
}

export function useCancelCompanySubscription(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    cancelSubscription
  );

  return {
    cancelSubscription: (immediate: boolean = false) => trigger({ immediate }),
    isCancelling: isMutating,
    error,
  };
}

// Reactivate Subscription Mutation
async function reactivateSubscription(url: string) {
  const response = await fetch(`${url}?action=reactivate`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reactivate subscription");
  }

  return response.json();
}

export function useReactivateCompanySubscription(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/billing` : null,
    reactivateSubscription
  );

  return {
    reactivateSubscription: trigger,
    isReactivating: isMutating,
    error,
  };
}
