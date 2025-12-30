"use client";

import { ChatbotTestPage } from "@/components/shared/chatbot";
import type { AgentListItem } from "@/lib/db/schema/chatbots";

import { useChatbotContext } from "../chatbot-context";

export default function TestPage() {
  const { chatbotId, chatbot, isLoading } = useChatbotContext();

  const chatbotData = chatbot
    ? {
        name: chatbot.name,
        status: chatbot.status,
        agentsList: (chatbot.agentsList as AgentListItem[]) ?? [],
      }
    : null;

  return (
    <ChatbotTestPage
      chatbot={chatbotData}
      testApiUrl={`/api/company/chatbots/${chatbotId}/test`}
      isLoading={isLoading}
    />
  );
}
