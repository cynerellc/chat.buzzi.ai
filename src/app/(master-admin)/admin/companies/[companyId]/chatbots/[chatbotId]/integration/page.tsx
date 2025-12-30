"use client";

import { IntegrationSettings } from "@/components/shared/chatbot";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotIntegrationPage() {
  const { companyId, chatbotId, chatbot } = useChatbotContext();

  return (
    <IntegrationSettings
      chatbotName={chatbot?.name}
      apiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/integrations`}
      channelsApiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/integrations/channels`}
      webhooksApiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}/integrations/webhooks`}
      widgetUrl={`/admin/companies/${companyId}/chatbots/${chatbotId}/widget`}
    />
  );
}
