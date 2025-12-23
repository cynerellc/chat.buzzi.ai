"use client";

import { useState, useMemo, type Key } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Pause,
  Play,
  BarChart3,
  Trash2,
  Bot,
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
  type DropdownMenuItem,
  ConfirmationDialog,
} from "@/components/ui";

import type { AgentListItem } from "@/app/api/company/agents/route";

interface AgentCardProps {
  agent: AgentListItem;
  onDuplicate: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onStatusChange: (agentId: string, status: "active" | "paused") => void;
}

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default"; dot: string }> = {
  active: { label: "Active", variant: "success", dot: "bg-success" },
  paused: { label: "Paused", variant: "warning", dot: "bg-warning" },
  draft: { label: "Draft", variant: "default", dot: "bg-default-400" },
};

const typeLabels: Record<string, string> = {
  support: "Support",
  sales: "Sales",
  general: "General",
  custom: "Custom",
};

export function AgentCard({
  agent,
  onDuplicate,
  onDelete,
  onStatusChange,
}: AgentCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const defaultStatus = { label: "Draft", variant: "default" as const, dot: "bg-default-400" };
  const status = statusConfig[agent.status] ?? defaultStatus;

  const dropdownItems: DropdownMenuItem[] = useMemo(() => {
    const items: DropdownMenuItem[] = [
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
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                {agent.avatarUrl ? (
                  <img
                    src={agent.avatarUrl}
                    alt={agent.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <Bot className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <h3 className="font-semibold leading-none">{agent.name}</h3>
                <Badge variant="default" className="mt-1 text-xs">
                  {typeLabels[agent.type] || agent.type}
                </Badge>
              </div>
            </div>
            <Dropdown
              trigger={
                <Button variant="light" isIconOnly size="sm" aria-label="Actions">
                  <MoreHorizontal size={16} />
                </Button>
              }
              items={dropdownItems}
              onAction={handleDropdownAction}
            />
          </div>
        </CardHeader>
        <CardBody className="flex-1 pb-3 pt-0">
          <div className="flex items-center gap-2 mb-3">
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            <span className="text-sm text-default-500">{status.label}</span>
          </div>
          {agent.status === "active" || agent.status === "paused" ? (
            <div className="space-y-1 text-sm text-default-500">
              <p>This week: {agent.weeklyConversations.toLocaleString()} convos</p>
              <p>{agent.aiResolutionRate}% AI resolved</p>
            </div>
          ) : (
            <p className="text-sm text-default-500">Not deployed</p>
          )}
        </CardBody>
        <CardFooter className="pt-0">
          <Button
            as={Link}
            href={`/agents/${agent.id}`}
            variant="bordered"
            size="sm"
            className="w-full"
            leftIcon={Pencil}
          >
            Edit
          </Button>
        </CardFooter>
      </Card>

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
