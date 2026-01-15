"use client";

import { useRouter } from "next/navigation";

import { GeneralSettings } from "@/components/shared/chatbot";
import { useModels } from "@/hooks/master-admin/useModels";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotGeneralPage() {
  const router = useRouter();
  const { chatbot, companyId, chatbotId, refresh } = useChatbotContext();

  // Fetch all active models and filter for call models
  const { models: allModels } = useModels({ isActive: true });
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
        packageEnabledChat: chatbot.packageEnabledChat,
        packageEnabledCall: chatbot.packageEnabledCall,
        settings: chatbot.settings,
      }
    : null;

  const handleDelete = async () => {
    const response = await fetch(
      `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`,
      { method: "DELETE" }
    );
    if (!response.ok) throw new Error("Failed to delete chatbot");
    router.push(`/admin/companies/${companyId}/chatbots`);
  };

  return (
    <GeneralSettings
      chatbot={chatbotData}
      apiUrl={`/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`}
      onRefresh={refresh}
      onDelete={handleDelete}
      isMasterAdmin
      callModels={callModels}
      categoriesApiBase={`/api/master-admin/companies/${companyId}`}
    />
  );
}
