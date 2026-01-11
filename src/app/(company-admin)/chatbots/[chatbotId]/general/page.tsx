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
        modelSettings: { temperature: chatbot.temperature / 100 },
        conversationCount: chatbot.totalConversations,
      }
    : null;

  return (
    <GeneralSettings
      chatbot={chatbotData}
      apiUrl={`/api/company/chatbots/${chatbotId}`}
      onRefresh={refresh}
    />
  );
}
