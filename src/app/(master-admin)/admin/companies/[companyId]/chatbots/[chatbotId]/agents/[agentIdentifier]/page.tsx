"use client";

import { use } from "react";

import { AgentDetailForm } from "@/components/shared/chatbot";

import { useChatbotContext } from "../../chatbot-context";

interface AgentPageProps {
  params: Promise<{ agentIdentifier: string }>;
}

export default function AgentDetailPage({ params }: AgentPageProps) {
  const { agentIdentifier } = use(params);
  const { chatbot, companyId, chatbotId, refresh } = useChatbotContext();

  const agentsList = chatbot?.agentsList ?? [];
  const agent = agentsList.find((a) => a.agent_identifier === agentIdentifier) ?? null;

  return (
    <AgentDetailForm
      agent={agent}
      agentsList={agentsList}
      apiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`}
      categoriesApiUrl={`/api/master-admin/companies/${companyId}/knowledge/categories`}
      onRefresh={refresh}
      showAISettings={true}
      showKnowledgeToggle={true}
      showRoutingPrompt={true}
    />
  );
}
