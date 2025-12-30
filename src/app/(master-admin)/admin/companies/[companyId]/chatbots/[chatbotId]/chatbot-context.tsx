"use client";

import { createContext, useContext } from "react";

import type { UseCompanyChatbotReturn } from "@/hooks/master-admin";

// Context to share chatbot data with child pages
export interface ChatbotContextType extends UseCompanyChatbotReturn {
  companyId: string;
  chatbotId: string;
}

export const ChatbotContext = createContext<ChatbotContextType | null>(null);

export function useChatbotContext() {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error("useChatbotContext must be used within ChatbotDetailsLayout");
  }
  return context;
}
