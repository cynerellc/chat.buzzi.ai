import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { CompanySettingsResponse } from "@/app/api/master-admin/companies/[companyId]/settings/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Company Settings Hook
export function useCompanySettings(companyId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ settings: CompanySettingsResponse }>(
    companyId ? `/api/master-admin/companies/${companyId}/settings` : null,
    fetcher
  );

  return {
    settings: data?.settings ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Update Company Settings Mutation
async function updateSettings(
  url: string,
  { arg }: { arg: Partial<CompanySettingsResponse> }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update settings");
  }

  return response.json();
}

export function useUpdateCompanySettings(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/settings` : null,
    updateSettings
  );

  return {
    updateSettings: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Generate API Key Mutation
async function generateApiKey(url: string) {
  const response = await fetch(`${url}?action=generate-api-key`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to generate API key");
  }

  return response.json();
}

export function useGenerateCompanyApiKey(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/settings` : null,
    generateApiKey
  );

  return {
    generateKey: trigger,
    isGenerating: isMutating,
    error,
  };
}

// Revoke API Key Mutation
async function revokeApiKey(url: string) {
  const response = await fetch(`${url}?action=revoke-api-key`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke API key");
  }

  return response.json();
}

export function useRevokeCompanyApiKey(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/settings` : null,
    revokeApiKey
  );

  return {
    revokeKey: trigger,
    isRevoking: isMutating,
    error,
  };
}

// Company Sessions
interface CompanySession {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  lastActivity: string;
  createdAt: string;
}

export function useCompanySessions(companyId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ sessions: CompanySession[] }>(
    companyId ? `/api/master-admin/companies/${companyId}/settings?action=get-sessions` : null,
    async (url: string) => {
      const response = await fetch(url, { method: "POST" });
      if (!response.ok) throw new Error("Failed to fetch sessions");
      return response.json();
    }
  );

  return {
    sessions: data?.sessions ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Revoke Session Mutation
async function revokeSession(
  url: string,
  { arg }: { arg: { sessionId: string } }
) {
  const response = await fetch(`${url}?action=revoke-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke session");
  }

  return response.json();
}

export function useRevokeCompanySession(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/settings` : null,
    revokeSession
  );

  return {
    revokeSession: (sessionId: string) => trigger({ sessionId }),
    isRevoking: isMutating,
    error,
  };
}

// Revoke All Sessions Mutation
async function revokeAllSessions(url: string) {
  const response = await fetch(`${url}?action=revoke-all-sessions`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke sessions");
  }

  return response.json();
}

export function useRevokeAllCompanySessions(companyId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    companyId ? `/api/master-admin/companies/${companyId}/settings` : null,
    revokeAllSessions
  );

  return {
    revokeAllSessions: trigger,
    isRevoking: isMutating,
    error,
  };
}
