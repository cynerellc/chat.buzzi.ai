"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button, Tabs, type TabItem, addToast } from "@/components/ui";
import { AgentsGrid } from "@/components/company-admin/agents/agents-grid";
import { useAgents } from "@/hooks/company";

const STATUS_TABS: TabItem[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "draft", label: "Draft" },
];

export default function AgentsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { agents, isLoading, mutate } = useAgents(statusFilter);

  const handleDuplicate = async (agentId: string) => {
    try {
      const response = await fetch(`/api/company/agents/${agentId}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to duplicate agent");
      addToast({ title: "Agent duplicated successfully", color: "success" });
      mutate();
    } catch {
      addToast({ title: "Failed to duplicate agent", color: "danger" });
    }
  };

  const handleDelete = async (agentId: string) => {
    try {
      const response = await fetch(`/api/company/agents/${agentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete agent");
      addToast({ title: "Agent deleted successfully", color: "success" });
      mutate();
    } catch {
      addToast({ title: "Failed to delete agent", color: "danger" });
    }
  };

  const handleStatusChange = async (
    agentId: string,
    status: "active" | "paused"
  ) => {
    try {
      const response = await fetch(`/api/company/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update agent status");
      addToast({
        title: `Agent ${status === "active" ? "resumed" : "paused"}`,
        color: "success",
      });
      mutate();
    } catch {
      addToast({ title: "Failed to update agent status", color: "danger" });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button asChild leftIcon={Plus}>
          <Link href="/agents/new">Create Agent</Link>
        </Button>
      </div>

      {/* Filters */}
      <Tabs
        items={STATUS_TABS}
        selectedKey={statusFilter}
        onSelectionChange={(key) => setStatusFilter(String(key))}
        variant="underlined"
      />

      {/* Agents Grid */}
      <AgentsGrid
        agents={agents}
        isLoading={isLoading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
