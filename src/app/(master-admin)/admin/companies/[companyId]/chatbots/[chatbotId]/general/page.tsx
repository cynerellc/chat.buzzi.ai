"use client";

import { GeneralSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotGeneralPage() {
  const { chatbot, companyId, chatbotId, refresh } = useChatbotContext();

  const chatbotData = chatbot
    ? {
        name: chatbot.name,
        description: chatbot.description,
        status: chatbot.status,
        packageName: chatbot.packageName,
        modelId: chatbot.modelId,
        modelSettings: chatbot.modelSettings,
        conversationCount: chatbot.conversationCount,
      }
    : null;

  return (
    <GeneralSettings
      chatbot={chatbotData}
      apiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`}
      onRefresh={refresh}
    />
  );
}
