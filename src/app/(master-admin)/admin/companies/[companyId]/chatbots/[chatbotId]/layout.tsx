"use client";

import { use, type ReactNode } from "react";

import { Card, Skeleton } from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import { useCompanyChatbot } from "@/hooks/master-admin";

import { useCompanyContext } from "../../company-context";
import { ChatbotContext } from "./chatbot-context";

interface ChatbotDetailsLayoutProps {
  children: ReactNode;
  params: Promise<{ companyId: string; chatbotId: string }>;
}

export default function ChatbotDetailsLayout({ children, params }: ChatbotDetailsLayoutProps) {
  const { companyId, chatbotId } = use(params);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { company } = useCompanyContext();
  const chatbotData = useCompanyChatbot(companyId, chatbotId);
  const { chatbot, isLoading } = chatbotData;

  useSetPageTitle(chatbot?.name ?? "Chatbot Details");

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <Card className="m-6 p-12 text-center">
        <h2 className="text-xl font-semibold mb-2">Chatbot Not Found</h2>
        <p className="text-muted-foreground">
          The chatbot you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
      </Card>
    );
  }

  // Navigation is now handled by the parent company layout
  // This layout only provides context for chatbot data
  return (
    <ChatbotContext.Provider value={{ ...chatbotData, companyId, chatbotId }}>
      {children}
    </ChatbotContext.Provider>
  );
}
