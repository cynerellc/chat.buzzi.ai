import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { AgentListItem } from "@/app/api/company/agents/route";
import type { AgentAnalytics } from "@/app/api/company/agents/[agentId]/analytics/route";
import type { AgentPackageItem } from "@/app/api/company/agents/packages/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Agents List Hook
export function useAgents(status?: string) {
  const url = status && status !== "all"
    ? `/api/company/agents?status=${status}`
    : "/api/company/agents";

  const { data, error, isLoading, mutate } = useSWR<{ agents: AgentListItem[] }>(
    url,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    agents: data?.agents ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Variable value with definition for display
export interface AgentVariableValue {
  name: string;
  displayName: string;
  description?: string;
  variableType: "variable" | "secured_variable";
  dataType: "string" | "number" | "boolean" | "json";
  required: boolean;
  placeholder?: string;
  value: string | null;
}

// Agent list item stored in agents.agentsList JSONB (matches schema)
export interface AgentListItemConfig {
  agent_identifier: string;
  name: string;
  designation?: string;
  routing_prompt?: string;
  agent_type: "worker" | "supervisor";
  avatar_url?: string;
  default_system_prompt: string;
  default_model_id: string;
  default_temperature: number;
  knowledge_base_enabled?: boolean;
  knowledge_categories?: string[];
  tools?: unknown[];
  managed_agent_ids?: string[];
  sort_order?: number;
}

// Agent Detail
export interface AgentDetail {
  id: string;
  companyId: string;
  packageId: string | null;
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
  agentsList?: AgentListItemConfig[];
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
  variableValues?: AgentVariableValue[];
  // Raw variable values (key-value) for editing
  rawVariableValues?: Record<string, string>;
}

export function useAgent(agentId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ agent: AgentDetail }>(
    agentId ? `/api/company/agents/${agentId}` : null,
    fetcher
  );

  return {
    agent: data?.agent ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Agent Analytics
export function useAgentAnalytics(agentId: string | null, days: number = 7) {
  const { data, error, isLoading } = useSWR<AgentAnalytics>(
    agentId ? `/api/company/agents/${agentId}/analytics?days=${days}` : null,
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  );

  return {
    analytics: data ?? null,
    isLoading,
    isError: error,
  };
}

// Agent Packages
export function useAgentPackages() {
  const { data, error, isLoading } = useSWR<{ packages: AgentPackageItem[] }>(
    "/api/company/agents/packages",
    fetcher
  );

  return {
    packages: data?.packages ?? [],
    isLoading,
    isError: error,
  };
}

// Create Agent Mutation
async function createAgent(
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
    throw new Error(error.error || "Failed to create agent");
  }

  return response.json();
}

export function useCreateAgent() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/agents",
    createAgent
  );

  return {
    createAgent: trigger,
    isCreating: isMutating,
    error,
  };
}

// Update Agent Mutation
async function updateAgent(
  url: string,
  { arg }: { arg: Partial<AgentDetail> }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update agent");
  }

  return response.json();
}

export function useUpdateAgent(agentId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/agents/${agentId}`,
    updateAgent
  );

  return {
    updateAgent: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Delete Agent Mutation
async function deleteAgent(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete agent");
  }

  return response.json();
}

export function useDeleteAgent(agentId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/agents/${agentId}`,
    deleteAgent
  );

  return {
    deleteAgent: trigger,
    isDeleting: isMutating,
    error,
  };
}

// Duplicate Agent Mutation
async function duplicateAgent(url: string) {
  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to duplicate agent");
  }

  return response.json();
}

export function useDuplicateAgent(agentId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/agents/${agentId}/duplicate`,
    duplicateAgent
  );

  return {
    duplicateAgent: trigger,
    isDuplicating: isMutating,
    error,
  };
}

// Test Agent Mutation
async function testAgent(
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
    throw new Error(error.error || "Failed to test agent");
  }

  return response.json();
}

export function useTestAgent(agentId: string) {
  const { trigger, isMutating, error, data } = useSWRMutation(
    `/api/company/agents/${agentId}/test`,
    testAgent
  );

  return {
    testAgent: trigger,
    isTesting: isMutating,
    error,
    response: data,
  };
}
