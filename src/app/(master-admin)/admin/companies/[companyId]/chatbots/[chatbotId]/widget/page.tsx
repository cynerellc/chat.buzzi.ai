"use client";

import { WidgetSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotWidgetPage() {
  const { companyId, chatbotId, chatbot } = useChatbotContext();

  return (
    <WidgetSettings
      chatbotId={chatbotId}
      chatbotName={chatbot?.name}
      companyId={companyId}
      apiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/widget`}
    />
  );
}
