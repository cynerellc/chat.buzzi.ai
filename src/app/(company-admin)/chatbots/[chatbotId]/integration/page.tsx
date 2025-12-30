"use client";

import { IntegrationSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotIntegrationPage() {
  const { chatbotId, chatbot } = useChatbotContext();

  return (
    <IntegrationSettings
      chatbotName={chatbot?.name}
      apiUrl={`/api/company/chatbots/${chatbotId}/integrations`}
      channelsApiUrl={`/api/company/chatbots/${chatbotId}/integrations/channels`}
      webhooksApiUrl={`/api/company/chatbots/${chatbotId}/integrations/webhooks`}
      widgetUrl={`/chatbots/${chatbotId}/widget`}
    />
  );
}
