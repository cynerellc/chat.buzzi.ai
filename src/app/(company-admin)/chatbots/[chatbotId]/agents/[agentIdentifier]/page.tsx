"use client";

import { use } from "react";

import { AgentDetailForm } from "@/components/shared/chatbot";

import { useChatbotContext } from "../../chatbot-context";

interface AgentPageProps {
  params: Promise<{ agentIdentifier: string }>;
}

export default function AgentDetailPage({ params }: AgentPageProps) {
  const { agentIdentifier } = use(params);
  const { chatbot, chatbotId, refresh } = useChatbotContext();

  const agentsList = chatbot?.agentsList ?? [];
  const agent = agentsList.find((a) => a.agent_identifier === agentIdentifier) ?? null;

  return (
    <AgentDetailForm
      agent={agent}
      agentsList={agentsList}
      apiUrl={`/api/company/agents/${chatbotId}`}
      categoriesApiUrl="/api/company/knowledge/categories"
      onRefresh={refresh}
      showAISettings={false}
      showKnowledgeToggle={false}
      showRoutingPrompt={false}
    />
  );
}
