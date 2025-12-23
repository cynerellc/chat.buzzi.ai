import useSWR from "swr";

import type { AuditLogsListResponse, AuditLogListItem } from "@/app/api/master-admin/audit-logs/route";
import type { AuditLogDetails } from "@/app/api/master-admin/audit-logs/[logId]/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type { AuditLogsListResponse, AuditLogListItem, AuditLogDetails };

export interface UseAuditLogsParams {
  page?: number;
  pageSize?: number;
  action?: string;
  resource?: string;
  userId?: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface UseAuditLogsReturn {
  logs: AuditLogListItem[];
  pagination: AuditLogsListResponse["pagination"] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useAuditLogs(params: UseAuditLogsParams = {}): UseAuditLogsReturn {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
  if (params.action) searchParams.set("action", params.action);
  if (params.resource) searchParams.set("resource", params.resource);
  if (params.userId) searchParams.set("userId", params.userId);
  if (params.companyId) searchParams.set("companyId", params.companyId);
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);
  if (params.search) searchParams.set("search", params.search);

  const queryString = searchParams.toString();
  const url = `/api/master-admin/audit-logs${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<AuditLogsListResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    logs: data?.logs ?? [],
    pagination: data?.pagination,
    isLoading,
    error,
    mutate,
  };
}

export interface UseAuditLogReturn {
  log: AuditLogDetails | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useAuditLog(logId: string | null): UseAuditLogReturn {
  const { data, error, isLoading, mutate } = useSWR<AuditLogDetails>(
    logId ? `/api/master-admin/audit-logs/${logId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    log: data,
    isLoading,
    error,
    mutate,
  };
}
