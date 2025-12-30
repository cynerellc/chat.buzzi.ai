"use client";

import { GeneralSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotGeneralPage() {
  const { chatbot, chatbotId, refresh } = useChatbotContext();

  const chatbotData = chatbot
    ? {
        name: chatbot.name,
        description: chatbot.description,
        status: chatbot.status,
        packageName: chatbot.package?.name ?? "Custom",
        modelId: chatbot.modelId,
        temperature: chatbot.temperature,
        conversationCount: chatbot.totalConversations,
      }
    : null;

  return (
    <GeneralSettings
      chatbot={chatbotData}
      apiUrl={`/api/company/agents/${chatbotId}`}
      onRefresh={refresh}
    />
  );
}
