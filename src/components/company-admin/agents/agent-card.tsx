"use client";

import { useState, useMemo, type Key } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Pause,
  Play,
  BarChart3,
  Trash2,
  Bot,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Badge,
  Dropdown,
  type DropdownMenuItemData,
  ConfirmationDialog,
} from "@/components/ui";

import type { AgentListItem } from "@/app/api/company/agents/route";

interface AgentCardProps {
  agent: AgentListItem;
  onDuplicate: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onStatusChange: (agentId: string, status: "active" | "paused") => void;
}

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default"; dot: string; bg: string }> = {
  active: { label: "Active", variant: "success", dot: "bg-success", bg: "bg-success/10" },
  paused: { label: "Paused", variant: "warning", dot: "bg-warning", bg: "bg-warning/10" },
  draft: { label: "Draft", variant: "default", dot: "bg-muted-foreground", bg: "bg-muted" },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  support: { label: "Support", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  sales: { label: "Sales", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  general: { label: "General", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  custom: { label: "Custom", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

export function AgentCard({
  agent,
  onDuplicate,
  onDelete,
  onStatusChange,
}: AgentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const defaultStatus = { label: "Draft", variant: "default" as const, dot: "bg-muted-foreground", bg: "bg-muted" };
  const status = statusConfig[agent.status] ?? defaultStatus;
  const typeInfo = typeConfig[agent.type] ?? { label: agent.type, color: "bg-muted text-muted-foreground" };

  const dropdownItems: DropdownMenuItemData[] = useMemo(() => {
    const items: DropdownMenuItemData[] = [
      { key: "edit", label: "Edit", icon: Pencil, href: `/agents/${agent.id}` },
      { key: "duplicate", label: "Duplicate", icon: Copy },
    ];

    if (agent.status === "active") {
      items.push({ key: "pause", label: "Pause", icon: Pause });
    }
    if (agent.status === "paused") {
      items.push({ key: "resume", label: "Resume", icon: Play });
    }

    items.push({ key: "analytics", label: "View Analytics", icon: BarChart3, href: `/agents/${agent.id}?tab=analytics` });
    items.push({ key: "delete", label: "Delete", icon: Trash2, isDanger: true });

    return items;
  }, [agent.id, agent.status]);

  const handleDropdownAction = (key: Key) => {
    switch (key) {
      case "duplicate":
        onDuplicate(agent.id);
        break;
      case "pause":
        onStatusChange(agent.id, "paused");
        break;
      case "resume":
        onStatusChange(agent.id, "active");
        break;
      case "delete":
        setShowDeleteDialog(true);
        break;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="group flex flex-col h-full hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between w-full">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300",
                  "bg-gradient-to-br from-primary/15 to-primary/5",
                  "group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:scale-105"
                )}>
                  {agent.avatarUrl ? (
                    <img
                      src={agent.avatarUrl}
                      alt={agent.name}
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <Bot className="h-7 w-7 text-primary" />
                  )}
                  {agent.status === "active" && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-success border-2 border-card" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
                    {agent.name}
                  </h3>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                    typeInfo.color
                  )}>
                    {typeInfo.label}
                  </span>
                </div>
              </div>
              <Dropdown
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Actions" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal size={16} />
                  </Button>
                }
                items={dropdownItems}
                onAction={handleDropdownAction}
              />
            </div>
          </CardHeader>

          <CardBody className="flex-1 pt-0 pb-4">
            <div className={cn(
              "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium mb-4",
              status.bg
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", status.dot)} />
              <span className="text-foreground/80">{status.label}</span>
            </div>

            {agent.status === "active" || agent.status === "paused" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <MessageSquare size={12} />
                    <span className="text-xs">This week</span>
                  </div>
                  <p className="text-lg font-semibold">{agent.weeklyConversations.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Sparkles size={12} />
                    <span className="text-xs">AI Resolved</span>
                  </div>
                  <p className="text-lg font-semibold">{agent.aiResolutionRate}%</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 text-muted-foreground">
                <TrendingUp size={14} />
                <span className="text-sm">Deploy to start tracking</span>
              </div>
            )}
          </CardBody>

          <CardFooter className="pt-0 pb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
              asChild
            >
              <Link href={`/agents/${agent.id}`}>
                <Pencil size={14} />
                Configure Agent
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          onDelete(agent.id);
          setShowDeleteDialog(false);
        }}
        title="Delete Agent"
        message={`Are you sure you want to delete "${agent.name}"? This action cannot be undone. All conversation history associated with this agent will be preserved but the agent will no longer be available.`}
        confirmLabel="Delete"
        isDanger
      />
    </>
  );
}
