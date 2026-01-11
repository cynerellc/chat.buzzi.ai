"use client";

import { EscalationSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotEscalationPage() {
  const { chatbot, chatbotId, refresh } = useChatbotContext();

  return (
    <EscalationSettings
      chatbot={chatbot}
      apiUrl={`/api/company/chatbots/${chatbotId}`}
      onRefresh={refresh}
    />
  );
}
