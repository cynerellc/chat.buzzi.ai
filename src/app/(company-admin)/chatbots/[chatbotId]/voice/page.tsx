"use client";

import { toast } from "sonner";

import { VoiceSettings } from "@/components/shared/chatbot";
import { useUpdateChatbot, type VoiceConfig, type CallWidgetConfig } from "@/hooks/company";

import { useChatbotContext } from "../chatbot-context";

export default function ChatbotVoicePage() {
  const { chatbotId, chatbot, refresh } = useChatbotContext();
  const { updateChatbot } = useUpdateChatbot(chatbotId);

  const handleSave = async (data: {
    enabledCall: boolean;
    callAiProvider: "OPENAI" | "GEMINI" | null;
    voiceConfig: VoiceConfig;
    callWidgetConfig: CallWidgetConfig;
  }) => {
    try {
      // Save to the unified widgetConfig structure
      await updateChatbot({
        enabledCall: data.enabledCall,
        callAiProvider: data.callAiProvider,
        voiceConfig: data.voiceConfig,
        widgetConfig: {
          chat: chatbot?.widgetConfig?.chat ?? {},
          call: data.callWidgetConfig,
        },
      });
      await refresh();
      toast.success("Voice settings saved successfully");
    } catch (error) {
      console.error("Failed to save voice settings:", error);
      toast.error("Failed to save voice settings");
      throw error;
    }
  };

  if (!chatbot) {
    return null;
  }

  return (
    <VoiceSettings
      chatbotId={chatbotId}
      enabledCall={chatbot.enabledCall ?? false}
      callAiProvider={chatbot.callAiProvider ?? null}
      voiceConfig={chatbot.voiceConfig ?? {}}
      callWidgetConfig={chatbot.widgetConfig?.call ?? {}}
      onSave={handleSave}
    />
  );
}
