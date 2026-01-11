import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { ChatbotListItem } from "@/app/api/company/chatbots/route";
import type { ChatbotAnalytics } from "@/app/api/company/chatbots/[chatbotId]/analytics/route";
import type { ChatbotPackageItem } from "@/app/api/company/chatbots/packages/route";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("An error occurred while fetching the data.");
    throw error;
  }
  return res.json();
};

// Chatbots List Hook
export function useChatbots(status?: string) {
  const url = status && status !== "all"
    ? `/api/company/chatbots?status=${status}`
    : "/api/company/chatbots";

  const { data, error, isLoading, mutate } = useSWR<{ chatbots: ChatbotListItem[] }>(
    url,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    chatbots: data?.chatbots ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Variable value with definition for display
export interface ChatbotVariableValue {
  name: string;
  displayName: string;
  description?: string;
  variableType: "variable" | "secured_variable";
  dataType: "string" | "number" | "boolean" | "json";
  required: boolean;
  placeholder?: string;
  value: string | null;
}

// Agent config stored in chatbots.agentsList JSONB (agent inside a chatbot)
export interface ChatbotAgentConfig {
  agent_identifier: string;
  name: string;
  designation?: string;
  routing_prompt?: string;
  agent_type: "worker" | "supervisor";
  avatar_url?: string;
  default_system_prompt: string;
  default_model_id: string;
  model_settings?: Record<string, unknown>;
  knowledge_base_enabled?: boolean;
  knowledge_categories?: string[];
  tools?: unknown[];
  managed_agent_ids?: string[];
  sort_order?: number;
}

// Chatbot Detail
export interface ChatbotDetail {
  id: string;
  companyId: string;
  packageId: string | null;
  packageType: "single_agent" | "multi_agent";
  chatbotType: "chat" | "call";
  isCustomPackage: boolean;
  name: string;
  description: string | null;
  type: string;
  status: string;
  // Backward-compatible fields from primary agent in agentsList
  avatarUrl: string | null;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  knowledgeCategories: string[];
  // Agents list (JSONB array of agent configs)
  agentsList?: ChatbotAgentConfig[];
  behavior: {
    greeting?: string;
    fallbackMessage?: string;
    maxTurnsBeforeEscalation?: number;
    autoEscalateOnSentiment?: boolean;
    sentimentThreshold?: number;
    collectEmail?: boolean;
    collectName?: boolean;
    workingHours?: unknown;
    offlineMessage?: string;
    enabledTools?: Record<string, boolean>;
  };
  escalationEnabled: boolean;
  escalationTriggers: unknown[];
  totalConversations: number;
  avgResolutionTime: number | null;
  satisfactionScore: number | null;
  createdAt: string;
  updatedAt: string;
  package: {
    id: string;
    name: string;
    slug: string;
    variables?: Array<{
      name: string;
      displayName: string;
      description?: string;
      variableType: "variable" | "secured_variable";
      dataType: "string" | "number" | "boolean" | "json";
      required: boolean;
      placeholder?: string;
    }>;
  } | null;
  // Variable values with their definitions for the UI
  variableValues?: ChatbotVariableValue[];
  // Raw variable values (key-value) for editing
  rawVariableValues?: Record<string, string>;
}

export function useChatbot(chatbotId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ chatbot: ChatbotDetail }>(
    chatbotId ? `/api/company/chatbots/${chatbotId}` : null,
    fetcher
  );

  return {
    chatbot: data?.chatbot ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Chatbot Analytics
export function useChatbotAnalytics(chatbotId: string | null, days: number = 7) {
  const { data, error, isLoading } = useSWR<ChatbotAnalytics>(
    chatbotId ? `/api/company/chatbots/${chatbotId}/analytics?days=${days}` : null,
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  );

  return {
    analytics: data ?? null,
    isLoading,
    isError: error,
  };
}

// Chatbot Packages
export function useChatbotPackages() {
  const { data, error, isLoading } = useSWR<{ packages: ChatbotPackageItem[] }>(
    "/api/company/chatbots/packages",
    fetcher
  );

  return {
    packages: data?.packages ?? [],
    isLoading,
    isError: error,
  };
}

// Create Chatbot Mutation
async function createChatbot(
  url: string,
  { arg }: { arg: {
    name: string;
    description?: string;
    type?: "support" | "sales" | "general" | "custom";
    packageId?: string;
    systemPrompt?: string;
    modelId?: string;
    temperature?: number;
    knowledgeCategories?: string[];
    behavior?: Record<string, unknown>;
    variableValues?: Record<string, string>;
  }}
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create chatbot");
  }

  return response.json();
}

export function useCreateChatbot() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/chatbots",
    createChatbot
  );

  return {
    createChatbot: trigger,
    isCreating: isMutating,
    error,
  };
}

// Update Chatbot Mutation
async function updateChatbot(
  url: string,
  { arg }: { arg: Partial<ChatbotDetail> }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update chatbot");
  }

  return response.json();
}

export function useUpdateChatbot(chatbotId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/chatbots/${chatbotId}`,
    updateChatbot
  );

  return {
    updateChatbot: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Delete Chatbot Mutation
async function deleteChatbot(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete chatbot");
  }

  return response.json();
}

export function useDeleteChatbot(chatbotId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/chatbots/${chatbotId}`,
    deleteChatbot
  );

  return {
    deleteChatbot: trigger,
    isDeleting: isMutating,
    error,
  };
}

// Duplicate Chatbot Mutation
async function duplicateChatbot(url: string) {
  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to duplicate chatbot");
  }

  return response.json();
}

export function useDuplicateChatbot(chatbotId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/chatbots/${chatbotId}/duplicate`,
    duplicateChatbot
  );

  return {
    duplicateChatbot: trigger,
    isDuplicating: isMutating,
    error,
  };
}

// Test Chatbot Mutation
async function testChatbot(
  url: string,
  { arg }: { arg: {
    message: string;
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
  }}
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to test chatbot");
  }

  return response.json();
}

export function useTestChatbot(chatbotId: string) {
  const { trigger, isMutating, error, data } = useSWRMutation(
    `/api/company/chatbots/${chatbotId}/test`,
    testChatbot
  );

  return {
    testChatbot: trigger,
    isTesting: isMutating,
    error,
    response: data,
  };
}
