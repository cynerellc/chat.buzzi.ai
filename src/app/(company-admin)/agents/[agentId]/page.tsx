"use client";

import { useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  MessageSquareText,
  Wrench,
  AlertTriangle,
  Layout,
  BarChart3,
  Play,
} from "lucide-react";
import { addToast } from "@heroui/react";

import { Button, Badge, Skeleton, Tabs, type TabItem } from "@/components/ui";
import { GeneralTab } from "@/components/company-admin/agents/general-tab";
import { PromptTab } from "@/components/company-admin/agents/prompt-tab";
import { ToolsTab } from "@/components/company-admin/agents/tools-tab";
import { EscalationTab } from "@/components/company-admin/agents/escalation-tab";
import { WidgetTab } from "@/components/company-admin/agents/widget-tab";
import { AnalyticsTab } from "@/components/company-admin/agents/analytics-tab";
import { TestChatModal } from "@/components/company-admin/agents/test-chat-modal";
import { useAgent, type AgentDetail } from "@/hooks/company";

interface PageProps {
  params: Promise<{ agentId: string }>;
}

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  draft: { label: "Draft", variant: "default" },
};

export default function AgentEditorPage({ params }: PageProps) {
  const { agentId } = use(params);
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "general";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isSaving, setIsSaving] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);

  const { agent, isLoading, mutate } = useAgent(agentId);

  const handleSave = async (data: Partial<AgentDetail>) => {
    if (!agent) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/company/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save agent");
      }

      addToast({ title: "Agent saved successfully", color: "success" });
      mutate();
    } catch {
      addToast({ title: "Failed to save agent", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const tabItems: TabItem[] = [
    {
      key: "general",
      label: "General",
      icon: Settings,
      content: agent ? (
        <GeneralTab agent={agent} onSave={handleSave} isSaving={isSaving} />
      ) : null,
    },
    {
      key: "prompt",
      label: "Prompt",
      icon: MessageSquareText,
      content: agent ? (
        <PromptTab agent={agent} onSave={handleSave} isSaving={isSaving} />
      ) : null,
    },
    {
      key: "tools",
      label: "Tools",
      icon: Wrench,
      content: agent ? (
        <ToolsTab agent={agent} onSave={handleSave} isSaving={isSaving} />
      ) : null,
    },
    {
      key: "escalation",
      label: "Escalation",
      icon: AlertTriangle,
      content: agent ? (
        <EscalationTab agent={agent} onSave={handleSave} isSaving={isSaving} />
      ) : null,
    },
    {
      key: "widget",
      label: "Widget",
      icon: Layout,
      content: agent ? (
        <WidgetTab agent={agent} onSave={handleSave} isSaving={isSaving} />
      ) : null,
    },
    {
      key: "analytics",
      label: "Analytics",
      icon: BarChart3,
      content: <AnalyticsTab agentId={agentId} />,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-default-500">Agent not found</p>
        <Button as={Link} href="/agents" variant="bordered">
          Back to Agents
        </Button>
      </div>
    );
  }

  const defaultStatus = { label: "Draft", variant: "default" as const };
  const status = statusConfig[agent.status] ?? defaultStatus;

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button as={Link} href="/agents" variant="light" isIconOnly aria-label="Back">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="text-default-500">
                {agent.type.charAt(0).toUpperCase() + agent.type.slice(1)} Agent
                {agent.package && ` • ${agent.package.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="bordered" onPress={() => setShowTestChat(true)} leftIcon={Play}>
              Test Agent
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          items={tabItems}
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(String(key))}
          variant="underlined"
          classNames={{
            tabList: "gap-6",
          }}
        />
      </div>

      {/* Test Chat Modal */}
      <TestChatModal
        isOpen={showTestChat}
        onClose={() => setShowTestChat(false)}
        agentId={agentId}
        agentName={agent.name}
      />
    </>
  );
}
