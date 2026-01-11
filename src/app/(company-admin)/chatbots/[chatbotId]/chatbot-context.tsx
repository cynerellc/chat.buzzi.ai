"use client";

import { createContext, useContext } from "react";

import type { ChatbotDetail } from "@/hooks/company";

export interface ChatbotContextType {
  chatbot: ChatbotDetail | null;
  chatbotId: string;
  isLoading: boolean;
  refresh: () => void;
}

export const ChatbotContext = createContext<ChatbotContextType | null>(null);

export function useChatbotContext() {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error("useChatbotContext must be used within ChatbotDetailsLayout");
  }
  return context;
}
