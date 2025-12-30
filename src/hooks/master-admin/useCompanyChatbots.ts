import useSWR from "swr";

import type { CompanyAgentItem } from "@/app/api/master-admin/companies/[companyId]/agents/route";
import type { AgentDetails } from "@/app/api/master-admin/companies/[companyId]/agents/[agentId]/route";
import type { AgentListItem } from "@/lib/db/schema/chatbots";

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

// Extended chatbot details that includes agentsList
export interface ChatbotDetails extends AgentDetails {
  agentsList: AgentListItem[];
  escalationEnabled: boolean;
}

// Hook for listing company chatbots
export interface UseCompanyChatbotsReturn {
  chatbots: CompanyAgentItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useCompanyChatbots(companyId: string | null): UseCompanyChatbotsReturn {
  const { data, error, isLoading, mutate } = useSWR<{ agents: CompanyAgentItem[] }>(
    companyId ? `/api/master-admin/companies/${companyId}/agents` : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    chatbots: data?.agents ?? [],
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
  const { data, error, isLoading, mutate } = useSWR<ChatbotDetails>(
    companyId && chatbotId
      ? `/api/master-admin/companies/${companyId}/agents/${chatbotId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    chatbot: data ?? null,
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
  const res = await fetch(`/api/master-admin/companies/${companyId}/agents/${chatbotId}`, {
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
  const res = await fetch(`/api/master-admin/companies/${companyId}/agents/${chatbotId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? "Failed to delete chatbot");
  }

  return res.json();
}
