import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  isRealtimeConfigured,
  getSupabaseBrowserClient,
  getActiveCompanyIdFromCookie,
} from "@/lib/supabase/realtime";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Types
export interface DashboardStats {
  activeConversations: number;
  activeConversationsChange: number;
  aiResolutionRate: number;
  aiResolutionChange: number;
  humanEscalations: number;
  humanEscalationsChange: number;
  avgResponseTime: number;
  avgResponseTimeChange: number;
}

export interface AgentOverview {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "paused" | "draft";
  type: string;
  todayConversations: number;
  aiResolutionRate: number;
}

export interface RecentConversation {
  id: string;
  endUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  agent: {
    id: string;
    name: string;
  };
  status: string;
  lastMessage: string | null;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  userName: string | null;
  createdAt: string;
}

export interface UsageItem {
  name: string;
  current: number;
  limit: number;
  percentage: number;
}

export interface UsageOverview {
  planName: string;
  usage: UsageItem[];
}

// Hooks

/**
 * Hook to fetch dashboard stats
 */
export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/api/company/dashboard/stats",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false, // H12: Prevent duplicate fetches on tab focus
    }
  );

  return {
    stats: data,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch agents overview
 */
export function useAgentsOverview() {
  const { data, error, isLoading, mutate } = useSWR<{ agents: AgentOverview[] }>(
    "/api/company/dashboard/agents",
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false, // H12: Prevent duplicate fetches on tab focus
    }
  );

  return {
    agents: data?.agents ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch recent conversations - uses Supabase realtime instead of polling
 */
export function useRecentConversations(limit: number = 5) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{
    conversations: RecentConversation[];
  }>(`/api/company/dashboard/conversations?limit=${limit}`, fetcher, {
    revalidateOnFocus: false,
  });

  // Set up Supabase Realtime subscription for conversations
  useEffect(() => {
    const companyId = getActiveCompanyIdFromCookie();

    if (!companyId || !isRealtimeConfigured()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`dashboard-conversations:${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "chatapp",
          table: "conversations",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          // Revalidate when conversations change
          mutate();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [mutate]);

  return {
    conversations: data?.conversations ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch activity feed
 */
export function useActivityFeed(limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR<{
    activities: ActivityItem[];
  }>(`/api/company/dashboard/activity?limit=${limit}`, fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false, // H12: Prevent duplicate fetches on tab focus
  });

  return {
    activities: data?.activities ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Hook to fetch usage overview
 */
export function useUsageOverview() {
  const { data, error, isLoading, mutate } = useSWR<UsageOverview>(
    "/api/company/dashboard/usage",
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: false, // H12: Prevent duplicate fetches on tab focus
    }
  );

  return {
    planName: data?.planName ?? "Free",
    usage: data?.usage ?? [],
    isLoading,
    error,
    mutate,
  };
}
