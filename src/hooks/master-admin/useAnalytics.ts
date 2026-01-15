import useSWR from "swr";

import type { AnalyticsOverview } from "@/app/api/master-admin/analytics/overview/route";
import type {
  ConversationsAnalyticsResponse,
  ConversationDataPoint,
} from "@/app/api/master-admin/analytics/conversations/route";
import type {
  UsageAnalyticsResponse,
  CompanyUsage,
  ChannelBreakdown,
} from "@/app/api/master-admin/analytics/usage/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch");
  }
  return res.json();
};

// Re-export types for convenience
export type {
  AnalyticsOverview,
  ConversationsAnalyticsResponse,
  ConversationDataPoint,
  UsageAnalyticsResponse,
  CompanyUsage,
  ChannelBreakdown,
};

export interface UseAnalyticsOverviewReturn {
  overview: AnalyticsOverview | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useAnalyticsOverview(): UseAnalyticsOverviewReturn {
  const { data, error, isLoading, mutate } = useSWR<AnalyticsOverview>(
    "/api/master-admin/analytics/overview",
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false,
    }
  );

  return {
    overview: data,
    isLoading,
    error,
    mutate,
  };
}

export interface UseConversationsAnalyticsParams {
  startDate?: string;
  endDate?: string;
  days?: number;
}

export interface UseConversationsAnalyticsReturn {
  data: ConversationsAnalyticsResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useConversationsAnalytics(
  params: UseConversationsAnalyticsParams = {}
): UseConversationsAnalyticsReturn {
  const searchParams = new URLSearchParams();
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);
  if (params.days) searchParams.set("days", params.days.toString());

  const queryString = searchParams.toString();
  const url = `/api/master-admin/analytics/conversations${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<ConversationsAnalyticsResponse>(
    url,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    isLoading,
    error,
    mutate,
  };
}

export interface UseUsageAnalyticsParams {
  startDate?: string;
  endDate?: string;
  days?: number;
  limit?: number;
}

export interface UseUsageAnalyticsReturn {
  data: UsageAnalyticsResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useUsageAnalytics(
  params: UseUsageAnalyticsParams = {}
): UseUsageAnalyticsReturn {
  const searchParams = new URLSearchParams();
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);
  if (params.days) searchParams.set("days", params.days.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const queryString = searchParams.toString();
  const url = `/api/master-admin/analytics/usage${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<UsageAnalyticsResponse>(
    url,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    isLoading,
    error,
    mutate,
  };
}

// ============================================================================
// Call Analytics Hook
// ============================================================================

import type {
  CallAnalyticsResponse,
  CallAnalyticsOverview,
  CallsByProvider,
  CallsBySource,
  CallsByStatus,
  CallsByCompany,
  CallDataPoint,
} from "@/app/api/master-admin/analytics/calls/route";

export type {
  CallAnalyticsResponse,
  CallAnalyticsOverview,
  CallsByProvider,
  CallsBySource,
  CallsByStatus,
  CallsByCompany,
  CallDataPoint,
};

export interface UseCallAnalyticsParams {
  days?: number;
  limit?: number;
}

export interface UseCallAnalyticsReturn {
  data: CallAnalyticsResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useCallAnalytics(
  params: UseCallAnalyticsParams = {}
): UseCallAnalyticsReturn {
  const searchParams = new URLSearchParams();
  if (params.days) searchParams.set("days", params.days.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const queryString = searchParams.toString();
  const url = `/api/master-admin/analytics/calls${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<CallAnalyticsResponse>(
    url,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    isLoading,
    error,
    mutate,
  };
}
