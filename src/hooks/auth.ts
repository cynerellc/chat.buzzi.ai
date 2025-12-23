/**
 * Authentication Hooks
 *
 * Hooks for session management, magic link authentication, and device tracking
 */

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

// Types
export interface DeviceSession {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  isTrusted: boolean;
  lastActivity: string;
  createdAt: string;
  isCurrent?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Sessions Hook - Get all active sessions for the current user
export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<{ sessions: DeviceSession[] }>(
    "/api/auth/sessions",
    fetcher
  );

  return {
    sessions: data?.sessions ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Revoke Session Mutation
async function revokeSessionMutation(
  _url: string,
  { arg }: { arg: string }
) {
  const response = await fetch(`/api/auth/sessions/${arg}`, {
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
    revokeSessionMutation
  );

  return {
    revokeSession: trigger,
    isRevoking: isMutating,
    error,
  };
}

// Revoke All Sessions Mutation
async function revokeAllSessionsMutation(url: string) {
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
    revokeAllSessionsMutation
  );

  return {
    revokeAllSessions: trigger,
    isRevoking: isMutating,
    error,
  };
}

// Trust Device Mutation
async function trustDeviceMutation(
  _url: string,
  { arg }: { arg: string }
) {
  const response = await fetch(`/api/auth/sessions/${arg}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trusted: true }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to trust device");
  }

  return response.json();
}

export function useTrustDevice() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/auth/sessions",
    trustDeviceMutation
  );

  return {
    trustDevice: trigger,
    isTrusting: isMutating,
    error,
  };
}

// Magic Link Mutation
async function sendMagicLinkMutation(
  url: string,
  { arg }: { arg: { email: string } }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send magic link");
  }

  return response.json();
}

export function useSendMagicLink() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/auth/magic-link",
    sendMagicLinkMutation
  );

  return {
    sendMagicLink: trigger,
    isSending: isMutating,
    error,
  };
}
