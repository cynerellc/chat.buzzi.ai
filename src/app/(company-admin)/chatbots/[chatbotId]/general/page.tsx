"use client";

import { GeneralSettings } from "@/components/shared/chatbot";
import { useModels } from "@/hooks/company/useModels";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotGeneralPage() {
  const { chatbot, chatbotId, refresh } = useChatbotContext();

  // Fetch call models for the voice configuration dropdown
  const { models: allModels } = useModels();
  const callModels = allModels.filter(
    (m) => m.modelType === "call" || m.modelType === "both"
  );

  const chatbotData = chatbot
    ? {
        name: chatbot.name,
        description: chatbot.description,
        status: chatbot.status,
        enabledChat: chatbot.enabledChat,
        enabledCall: chatbot.enabledCall,
        callModelId: chatbot.callModelId,
        callAiProvider: chatbot.callAiProvider,
        voiceConfig: chatbot.voiceConfig,
        packageEnabledChat: null, // Company admin doesn't see package restrictions
        packageEnabledCall: null,
      }
    : null;

  return (
    <GeneralSettings
      chatbot={chatbotData}
      apiUrl={`/api/company/chatbots/${chatbotId}`}
      onRefresh={refresh}
      isMasterAdmin={false}
      callModels={callModels}
    />
  );
}
