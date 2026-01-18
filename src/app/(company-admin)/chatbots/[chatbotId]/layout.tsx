"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ChatbotMenuBar } from "@/components/company/chatbot-menu-bar";
import { Skeleton, Badge } from "@/components/ui";
import { useChatbot } from "@/hooks/company";

import { ChatbotContext } from "./chatbot-context";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ chatbotId: string }>;
}

const statusBadgeVariants: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  paused: "warning",
  draft: "default",
  archived: "default",
};

export default function ChatbotDetailsLayout({ children, params }: LayoutProps) {
  const { chatbotId } = use(params);
  const { chatbot, isLoading, mutate } = useChatbot(chatbotId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-6">
        <Skeleton className="h-12 w-full mb-4" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <ChatbotContext.Provider
      value={{
        chatbot,
        chatbotId,
        isLoading,
        refresh: mutate,
      }}
    >
      <div className="flex flex-col h-full p-6">
        {/* Back link and header */}
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/chatbots"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Chatbots</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{chatbot?.name ?? "Chatbot"}</span>
            {chatbot?.type && (
              <span className="text-sm text-muted-foreground">
                ({chatbot.type.charAt(0).toUpperCase() + chatbot.type.slice(1)})
              </span>
            )}
            {chatbot?.status && (
              <Badge variant={statusBadgeVariants[chatbot.status] ?? "default"} size="sm">
                {chatbot.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Top Menu Bar */}
        <ChatbotMenuBar
          chatbotId={chatbotId}
          chatbotName={chatbot?.name ?? "Chatbot"}
          agents={chatbot?.agentsList ?? []}
        />

        {/* Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </ChatbotContext.Provider>
  );
}
