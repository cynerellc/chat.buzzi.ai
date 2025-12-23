import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { ConversationListItem } from "@/app/api/company/conversations/route";
import type { ConversationDetail } from "@/app/api/company/conversations/[conversationId]/route";
import type { MessageItem } from "@/app/api/company/conversations/[conversationId]/messages/route";

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
export function useConversations(filters: ConversationFilters = {}) {
  const url = buildConversationsUrl(filters);

  const { data, error, isLoading, mutate } = useSWR<ConversationsResponse>(
    url,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

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
  const { data, error, isLoading, mutate } = useSWR<{ conversation: ConversationDetail }>(
    conversationId ? `/api/company/conversations/${conversationId}` : null,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds for active conversations
  );

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

export function useConversationMessages(conversationId: string | null, page: number = 1) {
  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
    conversationId ? `/api/company/conversations/${conversationId}/messages?page=${page}` : null,
    fetcher,
    { refreshInterval: 5000 } // Refresh every 5 seconds for real-time messages
  );

  return {
    messages: data?.messages ?? [],
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
