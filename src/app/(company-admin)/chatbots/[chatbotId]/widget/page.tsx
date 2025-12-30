"use client";

import { WidgetSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotWidgetPage() {
  const { chatbotId, chatbot } = useChatbotContext();

  return (
    <WidgetSettings
      chatbotId={chatbotId}
      chatbotName={chatbot?.name}
      companyId={chatbot?.companyId ?? ""}
      apiUrl={`/api/company/chatbots/${chatbotId}/widget`}
    />
  );
}
