"use client";

import Link from "next/link";
import { Plus, Bot, List, LayoutGrid } from "lucide-react";
import { ButtonGroup } from "@heroui/react";

import {
  Button,
  Card,
  CardBody,
  Skeleton,
} from "@/components/ui";
import { AgentCard } from "./agent-card";

import type { AgentListItem } from "@/app/api/company/agents/route";

interface AgentsGridProps {
  agents: AgentListItem[];
  isLoading: boolean;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onDuplicate: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onStatusChange: (agentId: string, status: "active" | "paused") => void;
}

export function AgentsGrid({
  agents,
  isLoading,
  viewMode,
  onViewModeChange,
  onDuplicate,
  onDelete,
  onStatusChange,
}: AgentsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody className="p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex justify-end">
        <ButtonGroup size="sm" variant="bordered">
          <Button
            isIconOnly
            variant={viewMode === "grid" ? "solid" : "bordered"}
            onPress={() => onViewModeChange("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            variant={viewMode === "list" ? "solid" : "bordered"}
            onPress={() => onViewModeChange("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </ButtonGroup>
      </div>

      {/* Grid/List View */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Create New Agent Card */}
          <Link href="/agents/new">
            <Card className="flex h-full min-h-[200px] cursor-pointer items-center justify-center border-dashed border-2 transition-colors hover:border-primary hover:bg-default-100">
              <CardBody className="flex flex-col items-center gap-2 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium">Create Agent</span>
                <span className="text-sm text-default-500">
                  Add a new AI agent
                </span>
              </CardBody>
            </Card>
          </Link>

          {/* Agent Cards */}
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}

          {/* Empty State */}
          {agents.length === 0 && (
            <Card className="col-span-full flex min-h-[200px] items-center justify-center">
              <CardBody className="flex flex-col items-center gap-2 p-6 text-center">
                <Bot className="h-12 w-12 text-default-400" />
                <p className="text-default-500">No agents found</p>
                <Button as={Link} href="/agents/new" variant="bordered" size="sm">
                  Create your first agent
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Create New Agent Row */}
          <Link href="/agents/new">
            <Card className="cursor-pointer border-dashed border-2 transition-colors hover:border-primary hover:bg-default-100">
              <CardBody className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="font-medium">Create Agent</span>
                  <p className="text-sm text-default-500">
                    Add a new AI agent
                  </p>
                </div>
              </CardBody>
            </Card>
          </Link>

          {/* Agent List Rows */}
          {agents.map((agent) => (
            <AgentListRow
              key={agent.id}
              agent={agent}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}

          {/* Empty State */}
          {agents.length === 0 && (
            <Card className="flex min-h-[100px] items-center justify-center">
              <CardBody className="flex items-center gap-4 p-6">
                <Bot className="h-8 w-8 text-default-400" />
                <p className="text-default-500">No agents found</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// List view row component
function AgentListRow({
  agent,
}: {
  agent: AgentListItem;
  onDuplicate: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onStatusChange: (agentId: string, status: "active" | "paused") => void;
}) {
  const statusColors = {
    active: "bg-success",
    paused: "bg-warning",
    draft: "bg-default-400",
  };

  return (
    <Card>
      <CardBody className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            {agent.avatarUrl ? (
              <img
                src={agent.avatarUrl}
                alt={agent.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <Bot className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{agent.name}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  statusColors[agent.status as keyof typeof statusColors] ||
                  statusColors.draft
                }`}
              />
            </div>
            <p className="text-sm text-default-500">
              {agent.type} &bull; {agent.weeklyConversations} convos this week
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-medium">{agent.aiResolutionRate}%</p>
            <p className="text-sm text-default-500">AI resolved</p>
          </div>
          <Button as={Link} href={`/agents/${agent.id}`} variant="bordered" size="sm">
            Edit
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
