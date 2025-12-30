import useSWR from "swr";
import useSWRMutation from "swr/mutation";

export interface Session {
  id: string;
  deviceType: string | null;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastActivity: string;
  isCurrent: boolean;
  isTrusted: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Get all sessions
export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<{ sessions: Session[] }>(
    "/api/auth/sessions",
    fetcher
  );

  return {
    sessions: data?.sessions ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Revoke a single session
async function revokeSessionFn(url: string, { arg }: { arg: string }) {
  const response = await fetch(`${url}/${arg}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke session");
  }

  return response.json();
}

export function useRevokeSession() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/auth/sessions",
    revokeSessionFn
  );

  return {
    revokeSession: trigger,
    isRevoking: isMutating,
    error,
  };
}

// Revoke all other sessions
async function revokeAllSessionsFn(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke sessions");
  }

  return response.json();
}

export function useRevokeAllSessions() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/auth/sessions",
    revokeAllSessionsFn
  );

  return {
    revokeAllSessions: trigger,
    isRevoking: isMutating,
    error,
  };
}
