"use client";

import { WidgetSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotWidgetPage() {
  const { companyId, chatbotId, chatbot, refresh } = useChatbotContext();

  // Determine if multi-agent by checking if agentsList has more than 1 agent
  const isMultiAgent = (chatbot?.agentsList?.length ?? 0) > 1;

  return (
    <WidgetSettings
      chatbotId={chatbotId}
      chatbotName={chatbot?.name}
      companyId={companyId}
      apiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/widget`}
      chatbotApiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`}
      isMultiAgent={isMultiAgent}
      chatbot={chatbot}
      onChatbotRefresh={refresh}
    />
  );
}
