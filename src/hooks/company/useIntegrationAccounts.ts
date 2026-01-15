/**
 * Integration Accounts Hooks
 *
 * React hooks for managing integration accounts (WhatsApp, Twilio, Vonage)
 * used for voice call integrations.
 */

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

// ============================================================================
// Types
// ============================================================================

export interface IntegrationAccount {
  id: string;
  provider: "whatsapp" | "twilio" | "vonage" | "bandwidth";
  displayName: string;
  phoneNumber: string | null;
  isVerified: boolean;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  webhookUrl?: string;
  hasWebhookSecret?: boolean;
}

interface IntegrationAccountsResponse {
  accounts: IntegrationAccount[];
}

interface CreateIntegrationAccountParams {
  provider: "whatsapp" | "twilio" | "vonage" | "bandwidth";
  displayName: string;
  phoneNumber?: string;
  credentials?: Record<string, string>;
  settings?: Record<string, unknown>;
}

interface UpdateIntegrationAccountParams {
  displayName?: string;
  phoneNumber?: string;
  credentials?: Record<string, string>;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch");
  }
  return res.json();
};

// ============================================================================
// List Integration Accounts Hook
// ============================================================================

export function useIntegrationAccounts() {
  const { data, error, isLoading, mutate } = useSWR<IntegrationAccountsResponse>(
    "/api/company/integration-accounts",
    fetcher
  );

  return {
    accounts: data?.accounts ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// ============================================================================
// Single Integration Account Hook
// ============================================================================

export function useIntegrationAccount(accountId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ account: IntegrationAccount }>(
    accountId ? `/api/company/integration-accounts/${accountId}` : null,
    fetcher
  );

  return {
    account: data?.account ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// ============================================================================
// Create Integration Account Mutation
// ============================================================================

async function createAccountFetcher(
  url: string,
  { arg }: { arg: CreateIntegrationAccountParams }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create integration account");
  }

  return response.json();
}

export function useCreateIntegrationAccount() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/integration-accounts",
    createAccountFetcher
  );

  return {
    createAccount: trigger,
    isCreating: isMutating,
    error,
  };
}

// ============================================================================
// Update Integration Account Mutation
// ============================================================================

async function updateAccountFetcher(
  url: string,
  { arg }: { arg: { accountId: string; data: UpdateIntegrationAccountParams } }
) {
  const response = await fetch(`${url}/${arg.accountId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg.data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update integration account");
  }

  return response.json();
}

export function useUpdateIntegrationAccount() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/integration-accounts",
    updateAccountFetcher
  );

  return {
    updateAccount: trigger,
    isUpdating: isMutating,
    error,
  };
}

// ============================================================================
// Delete Integration Account Mutation
// ============================================================================

async function deleteAccountFetcher(
  url: string,
  { arg }: { arg: { accountId: string } }
) {
  const response = await fetch(`${url}/${arg.accountId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete integration account");
  }

  return response.json();
}

export function useDeleteIntegrationAccount() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/integration-accounts",
    deleteAccountFetcher
  );

  return {
    deleteAccount: trigger,
    isDeleting: isMutating,
    error,
  };
}

// ============================================================================
// Test Connection Mutation
// ============================================================================

async function testConnectionFetcher(
  url: string,
  { arg }: { arg: { accountId: string } }
) {
  const response = await fetch(`${url}/${arg.accountId}/test`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Connection test failed");
  }

  return response.json();
}

export function useTestIntegrationConnection() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/integration-accounts",
    testConnectionFetcher
  );

  return {
    testConnection: trigger,
    isTesting: isMutating,
    error,
  };
}
