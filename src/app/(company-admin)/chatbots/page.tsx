"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button, Tabs, type TabItem, addToast } from "@/components/ui";
import { AgentsGrid } from "@/components/company-admin/agents/agents-grid";
import { useSetPageTitle } from "@/contexts/page-context";
import { useChatbots } from "@/hooks/company";
import { useAuth } from "@/hooks/useAuth";

const STATUS_TABS: TabItem[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "draft", label: "Draft" },
];

export default function ChatbotsPage() {
  useSetPageTitle("Chatbots");
  const { isMasterAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { chatbots, isLoading, mutate } = useChatbots(statusFilter);

  // H8: Wrap handlers with useCallback to prevent recreation on every render
  const handleDuplicate = useCallback(async (chatbotId: string) => {
    try {
      const response = await fetch(`/api/company/chatbots/${chatbotId}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to duplicate chatbot");
      addToast({ title: "Chatbot duplicated successfully", color: "success" });
      mutate();
    } catch {
      addToast({ title: "Failed to duplicate chatbot", color: "danger" });
    }
  }, [mutate]);

  const handleDelete = useCallback(async (chatbotId: string) => {
    try {
      const response = await fetch(`/api/company/chatbots/${chatbotId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete chatbot");
      addToast({ title: "Chatbot deleted successfully", color: "success" });
      mutate();
    } catch {
      addToast({ title: "Failed to delete chatbot", color: "danger" });
    }
  }, [mutate]);

  const handleStatusChange = useCallback(async (
    chatbotId: string,
    status: "active" | "paused"
  ) => {
    try {
      const response = await fetch(`/api/company/chatbots/${chatbotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update chatbot status");
      addToast({
        title: `Chatbot ${status === "active" ? "resumed" : "paused"}`,
        color: "success",
      });
      mutate();
    } catch {
      addToast({ title: "Failed to update chatbot status", color: "danger" });
    }
  }, [mutate]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chatbots</h1>
          <p className="text-muted-foreground">
            Manage your AI chatbots and their configurations
          </p>
        </div>
        {isMasterAdmin && (
          <Button asChild leftIcon={Plus}>
            <Link href="/chatbots/new">Create Chatbot</Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Tabs
        items={STATUS_TABS}
        selectedKey={statusFilter}
        onSelectionChange={(key) => setStatusFilter(String(key))}
        variant="underlined"
      />

      {/* Chatbots Grid */}
      <AgentsGrid
        agents={chatbots}
        isLoading={isLoading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        basePath="/chatbots"
        showCreateCard={isMasterAdmin}
      />
    </div>
  );
}
