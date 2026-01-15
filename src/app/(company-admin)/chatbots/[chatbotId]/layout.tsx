"use client";

import { use } from "react";
import {
  Settings,
  Users,
  AlertTriangle,
  Plug,
  Bot,
  Play,
  Code,
  Phone,
} from "lucide-react";

import { SecondaryNav, type SecondaryNavItem, type SecondaryNavSubItem } from "@/components/shared";
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

  // Build agent sub-items from chatbot's agentsList
  const agentSubItems: SecondaryNavSubItem[] = (chatbot?.agentsList ?? []).map((agent) => ({
    key: agent.agent_identifier,
    label: agent.name,
    href: `/chatbots/${chatbotId}/agents/${agent.agent_identifier}`,
    icon: Bot,
    badge: agent.agent_type === "supervisor" ? (
      <Badge variant="info" size="sm">sup</Badge>
    ) : undefined,
  }));

  const navItems: SecondaryNavItem[] = [
    { key: "general", label: "General", href: `/chatbots/${chatbotId}/general`, icon: Settings },
    {
      key: "agents",
      label: "Agents",
      href: `/chatbots/${chatbotId}/agents`,
      icon: Users,
      subItems: agentSubItems,
      defaultExpanded: true,
    },
    { key: "escalation", label: "Escalation Rules", href: `/chatbots/${chatbotId}/escalation`, icon: AlertTriangle },
    { key: "voice", label: "Voice", href: `/chatbots/${chatbotId}/voice`, icon: Phone },
    { key: "test", label: "Test", href: `/chatbots/${chatbotId}/test`, icon: Play },
    { key: "integration", label: "Integration", href: `/chatbots/${chatbotId}/integration`, icon: Plug },
    // Show Code tab only for custom packages
    ...(chatbot?.isCustomPackage ? [
      { key: "code", label: "View Code", href: `/chatbots/${chatbotId}/code`, icon: Code },
    ] : []),
  ];

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-60 border-r border-border/40 p-4 space-y-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
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
      <div className="flex h-full">
        <SecondaryNav
          items={navItems}
          backButton={{ label: "Chatbots", href: "/chatbots" }}
          header={{
            title: chatbot?.name ?? "Chatbot",
            subtitle: chatbot?.type ? `${chatbot.type.charAt(0).toUpperCase() + chatbot.type.slice(1)} Chatbot` : undefined,
            statusBadge: chatbot?.status ? (
              <Badge variant={statusBadgeVariants[chatbot.status] ?? "default"} size="sm">
                {chatbot.status}
              </Badge>
            ) : undefined,
          }}
        />
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </ChatbotContext.Provider>
  );
}
