"use client";

import { WidgetSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotWidgetPage() {
  const { chatbotId, chatbot } = useChatbotContext();

  // Determine if multi-agent by checking if agentsList has more than 1 agent
  const isMultiAgent = (chatbot?.agentsList?.length ?? 0) > 1;

  return (
    <WidgetSettings
      chatbotId={chatbotId}
      chatbotName={chatbot?.name}
      companyId={chatbot?.companyId ?? ""}
      apiUrl={`/api/company/chatbots/${chatbotId}/widget`}
      isMultiAgent={isMultiAgent}
    />
  );
}
