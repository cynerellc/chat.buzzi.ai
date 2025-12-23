import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ImpersonationSession {
  originalUserId: string;
  originalUserEmail: string;
  impersonatedUserId: string;
  impersonatedUserEmail: string;
  targetUserName: string;
  targetUserRole?: string;
  targetCompanyId?: string;
  reason: string;
  startedAt: string;
}

interface ImpersonationStatusResponse {
  active: boolean;
  session: ImpersonationSession | null;
}

interface UseImpersonationReturn {
  isImpersonating: boolean;
  session: ImpersonationSession | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

/**
 * Hook to get current impersonation status
 */
export function useImpersonation(): UseImpersonationReturn {
  const { data, error, isLoading, mutate } = useSWR<ImpersonationStatusResponse>(
    "/api/master-admin/impersonation",
    fetcher,
    {
      refreshInterval: 60000, // Check every minute
      revalidateOnFocus: true,
    }
  );

  return {
    isImpersonating: data?.active ?? false,
    session: data?.session ?? null,
    isLoading,
    error,
    mutate,
  };
}

interface StartImpersonationParams {
  targetUserId: string;
  reason?: string;
}

interface StartImpersonationResult {
  success: boolean;
  session?: ImpersonationSession;
  error?: string;
}

/**
 * Start impersonating a user
 */
export async function startImpersonation(
  params: StartImpersonationParams
): Promise<StartImpersonationResult> {
  const response = await fetch("/api/master-admin/impersonation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to start impersonation");
  }

  return data;
}

/**
 * End current impersonation session
 */
export async function endImpersonation(): Promise<{ success: boolean }> {
  const response = await fetch("/api/master-admin/impersonation", {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to end impersonation");
  }

  return data;
}
