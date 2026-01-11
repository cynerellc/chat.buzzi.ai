import { useEffect, useRef } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { ConversationListItem } from "@/app/api/company/conversations/route";
import type { ConversationDetail } from "@/app/api/company/conversations/[conversationId]/route";
import type { MessageItem } from "@/app/api/company/conversations/[conversationId]/messages/route";
import {
  isRealtimeConfigured,
  getSupabaseBrowserClient,
  getActiveCompanyIdFromCookie,
  subscribeToConversationMessages,
  unsubscribe,
  type BroadcastMessage,
} from "@/lib/supabase/realtime";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Filter types
export interface ConversationFilters {
  status?: string;
  agentId?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ConversationsResponse {
  conversations: ConversationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<string, number>;
}

// Build URL with filters
function buildConversationsUrl(filters: ConversationFilters): string {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.append("status", filters.status);
  }
  if (filters.agentId) {
    params.append("agentId", filters.agentId);
  }
  if (filters.channel && filters.channel !== "all") {
    params.append("channel", filters.channel);
  }
  if (filters.startDate) {
    params.append("startDate", filters.startDate);
  }
  if (filters.endDate) {
    params.append("endDate", filters.endDate);
  }
  if (filters.search) {
    params.append("search", filters.search);
  }
  if (filters.page) {
    params.append("page", filters.page.toString());
  }
  if (filters.limit) {
    params.append("limit", filters.limit.toString());
  }

  const queryString = params.toString();
  return queryString ? `/api/company/conversations?${queryString}` : "/api/company/conversations";
}

// Conversations List Hook
export function useConversations(filters: ConversationFilters = {}, companyId?: string) {
  const url = buildConversationsUrl(filters);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data, error, isLoading, mutate } = useSWR<ConversationsResponse>(
    url,
    fetcher
  );

  // Set up Supabase Realtime subscription for conversations list
  useEffect(() => {
    // Use provided companyId or get from cookie for company-admin context
    const activeCompanyId = companyId || getActiveCompanyIdFromCookie();

    if (!activeCompanyId || !isRealtimeConfigured()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`company-conversations:${activeCompanyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "chatapp",
          table: "conversations",
          filter: `company_id=eq.${activeCompanyId}`,
        },
        () => {
          // Revalidate the conversations list when any conversation changes
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
  }, [companyId, mutate]);

  return {
    conversations: data?.conversations ?? [],
    pagination: data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    statusCounts: data?.statusCounts ?? {},
    isLoading,
    isError: error,
    mutate,
  };
}

// Single Conversation Detail Hook
export function useConversation(conversationId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ conversation: ConversationDetail }>(
    conversationId ? `/api/company/conversations/${conversationId}` : null,
    fetcher
  );

  // Set up Supabase Realtime subscription for single conversation updates
  useEffect(() => {
    if (!conversationId || !isRealtimeConfigured()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "chatapp",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        () => {
          // Revalidate when conversation is updated (status change, etc.)
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
  }, [conversationId, mutate]);

  return {
    conversation: data?.conversation ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Conversation Messages Hook
interface MessagesResponse {
  messages: MessageItem[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/**
 * Hook to fetch and subscribe to conversation messages
 * Uses Supabase Realtime broadcast for secure real-time updates
 *
 * @param conversationId - The conversation to fetch messages for
 * @param page - Page number for pagination
 */
export function useConversationMessages(
  conversationId: string | null,
  page: number = 1
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
    conversationId ? `/api/company/conversations/${conversationId}/messages?page=${page}` : null,
    fetcher
  );

  // Set up Supabase Realtime subscription when available
  useEffect(() => {
    if (!conversationId || !isRealtimeConfigured()) {
      return;
    }

    // Subscribe to real-time message updates via broadcast
    const channel = subscribeToConversationMessages(
      conversationId,
      (message: BroadcastMessage) => {
        // Add new message (only if it doesn't already exist)
        mutate(
          (current) => {
            if (!current) return current;
            // Check if message already exists to prevent duplicates
            const messageExists = current.messages.some(
              (msg) => msg.id === message.id
            );
            if (messageExists) return current;

            const newMessage: MessageItem = {
              id: message.id,
              role: message.role,
              type: "text",
              content: message.content,
              createdAt: message.createdAt,
              tokenCount: null,
              attachments: [],
              modelId: null,
              processingTimeMs: null,
              toolCalls: [],
              toolResults: [],
              sourceChunkIds: [],
              isRead: false,
              readAt: null,
              user: message.userName
                ? { id: message.userId ?? "", name: message.userName, email: "" }
                : null,
            };
            return {
              ...current,
              messages: [...current.messages, newMessage],
            };
          },
          { revalidate: false }
        );
      }
    );

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        unsubscribe(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, mutate]);

  // Deduplicate messages by ID (handles race conditions between realtime and API fetch)
  const deduplicatedMessages = data?.messages
    ? Array.from(new Map(data.messages.map((m) => [m.id, m])).values())
    : [];

  return {
    messages: deduplicatedMessages,
    pagination: data?.pagination ?? { page: 1, limit: 50, hasMore: false },
    isLoading,
    isError: error,
    mutate,
  };
}

// Update Conversation Mutation
interface UpdateConversationArgs {
  status?: "active" | "waiting_human" | "with_human" | "resolved" | "abandoned";
  subject?: string;
  assignedUserId?: string | null;
  tags?: string[];
  resolutionType?: "ai" | "human" | "abandoned" | null;
}

async function updateConversation(
  url: string,
  { arg }: { arg: UpdateConversationArgs }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update conversation");
  }

  return response.json();
}

export function useUpdateConversation(conversationId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/conversations/${conversationId}`,
    updateConversation
  );

  return {
    updateConversation: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Send Message Mutation
interface SendMessageArgs {
  content: string;
  role?: "human_agent" | "system";
}

async function sendMessage(
  url: string,
  { arg }: { arg: SendMessageArgs }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send message");
  }

  return response.json();
}

export function useSendMessage(conversationId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/conversations/${conversationId}/messages`,
    sendMessage
  );

  return {
    sendMessage: trigger,
    isSending: isMutating,
    error,
  };
}

// Resolve Conversation Helper
export function useResolveConversation(conversationId: string) {
  const { updateConversation, isUpdating } = useUpdateConversation(conversationId);

  const resolve = async (resolutionType: "ai" | "human" | "abandoned") => {
    return updateConversation({
      status: "resolved",
      resolutionType,
    });
  };

  return {
    resolve,
    isResolving: isUpdating,
  };
}

// Assign Conversation Helper
export function useAssignConversation(conversationId: string) {
  const { updateConversation, isUpdating } = useUpdateConversation(conversationId);

  const assign = async (userId: string | null) => {
    return updateConversation({
      assignedUserId: userId,
      status: userId ? "with_human" : "active",
    });
  };

  return {
    assign,
    isAssigning: isUpdating,
  };
}
