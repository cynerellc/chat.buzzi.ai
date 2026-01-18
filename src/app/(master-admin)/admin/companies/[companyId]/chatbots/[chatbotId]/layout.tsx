"use client";

import { use, useMemo, type ReactNode } from "react";

import { Card, Skeleton } from "@/components/ui";
import { useSetBreadcrumbs } from "@/contexts/page-context";
import { useCompanyChatbot } from "@/hooks/master-admin";

import { useCompanyContext } from "../../company-context";
import { ChatbotContext } from "./chatbot-context";

interface ChatbotDetailsLayoutProps {
  children: ReactNode;
  params: Promise<{ companyId: string; chatbotId: string }>;
}

export default function ChatbotDetailsLayout({ children, params }: ChatbotDetailsLayoutProps) {
  const { companyId, chatbotId } = use(params);
  const { company } = useCompanyContext();
  const chatbotData = useCompanyChatbot(companyId, chatbotId);
  const { chatbot, isLoading } = chatbotData;

  const breadcrumbs = useMemo(() => [
    { label: "Companies", href: "/admin/companies" },
    { label: company?.name ?? "...", href: `/admin/companies/${companyId}/overview` },
    { label: "Chatbots", href: `/admin/companies/${companyId}/chatbots` },
    { label: chatbot?.name ?? "..." },
  ], [company?.name, companyId, chatbot?.name]);

  useSetBreadcrumbs(breadcrumbs);

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
