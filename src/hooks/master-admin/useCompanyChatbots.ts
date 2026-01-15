import useSWR from "swr";

import type { CompanyChatbotItem } from "@/app/api/master-admin/companies/[companyId]/chatbots/route";
import type { AgentListItem, ChatbotSettings, VoiceConfig, WidgetConfig } from "@/lib/db/schema/chatbots";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Not found");
    }
    throw new Error("Failed to fetch data");
  }
  return res.json();
};

// Chatbot details with agents list
export interface ChatbotDetails {
  id: string;
  name: string;
  description: string | null;
  packageId: string | null;
  packageName: string;
  systemPrompt: string;
  modelId: string;
  modelSettings: Record<string, unknown>;
  behavior: Record<string, unknown>;
  status: string;
  escalationEnabled: boolean;
  enabledChat: boolean;
  enabledCall: boolean;
  // Call settings
  callModelId: string | null;
  callAiProvider: "OPENAI" | "GEMINI" | null;
  voiceConfig: VoiceConfig;
  widgetConfig?: WidgetConfig;
  // Package-level feature flags (null if no package = show all options)
  packageEnabledChat: boolean | null;
  packageEnabledCall: boolean | null;
  conversationCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  agentsList: AgentListItem[];
  settings?: ChatbotSettings;
}

// Hook for listing company chatbots
export interface UseCompanyChatbotsReturn {
  chatbots: CompanyChatbotItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompanyChatbots(companyId: string | null): UseCompanyChatbotsReturn {
  const { data, error, isLoading, mutate } = useSWR<{ chatbots: CompanyChatbotItem[] }>(
    companyId ? `/api/master-admin/companies/${companyId}/chatbots` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    chatbots: data?.chatbots ?? [],
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Hook for getting a single chatbot details
export interface UseCompanyChatbotReturn {
  chatbot: ChatbotDetails | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompanyChatbot(
  companyId: string | null,
  chatbotId: string | null
): UseCompanyChatbotReturn {
  const { data, error, isLoading, mutate } = useSWR<{ chatbot: ChatbotDetails }>(
    companyId && chatbotId
      ? `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    chatbot: data?.chatbot ?? null,
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// Update chatbot mutation
export async function updateCompanyChatbot(
  companyId: string,
  chatbotId: string,
  data: Partial<{
    name: string;
    description: string | null;
    status: string;
    agentsList: AgentListItem[];
    behavior: Record<string, unknown>;
  }>
) {
  const res = await fetch(`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to update chatbot");
  }

  return res.json();
}

// Delete chatbot mutation
export async function deleteCompanyChatbot(companyId: string, chatbotId: string) {
  const res = await fetch(`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to delete chatbot");
  }

  return res.json();
}
