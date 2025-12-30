"use client";

import { EscalationSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotEscalationPage() {
  const { chatbot, companyId, chatbotId, refresh } = useChatbotContext();

  return (
    <EscalationSettings
      chatbot={chatbot}
      apiUrl={`/api/master-admin/companies/${companyId}/agents/${chatbotId}`}
      onRefresh={refresh}
    />
  );
}
