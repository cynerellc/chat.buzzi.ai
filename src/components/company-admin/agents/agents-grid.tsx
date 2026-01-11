"use client";

import Link from "next/link";
import { Plus, Bot, List, LayoutGrid } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  Skeleton,
} from "@/components/ui";
import { AgentCard } from "./agent-card";

import type { ChatbotListItem } from "@/app/api/company/chatbots/route";

interface AgentsGridProps {
  agents: ChatbotListItem[];
  isLoading: boolean;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onDuplicate: (agentId: string) => void;
  onDelete: (agentId: string) => void;
  onStatusChange: (agentId: string, status: "active" | "paused") => void;
  basePath?: string;
  showCreateCard?: boolean;
}

export function AgentsGrid({
  agents,
  isLoading,
  viewMode,
  onViewModeChange,
  onDuplicate,
  onDelete,
  onStatusChange,
  basePath = "/chatbots",
  showCreateCard = true,
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
        <div className="flex">
          <Button
            size="icon"
            variant={viewMode === "grid" ? "default" : "outline"}
            onPress={() => onViewModeChange("grid")}
            aria-label="Grid view"
            className="rounded-r-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "list" ? "default" : "outline"}
            onPress={() => onViewModeChange("list")}
            aria-label="List view"
            className="rounded-l-none border-l-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid/List View */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Create New Agent Card */}
          {showCreateCard && (
            <Link href={`${basePath}/new`}>
              <Card className="flex h-full min-h-[200px] cursor-pointer items-center justify-center border-dashed border-2 transition-colors hover:border-primary hover:bg-muted">
                <CardBody className="flex flex-col items-center gap-2 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <span className="font-medium">Create Agent</span>
                  <span className="text-sm text-muted-foreground">
                    Add a new AI agent
                  </span>
                </CardBody>
              </Card>
            </Link>
          )}

          {/* Chatbot Cards */}
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              basePath={basePath}
            />
          ))}

          {/* Empty State */}
          {agents.length === 0 && (
            <Card className="col-span-full flex min-h-[200px] items-center justify-center">
              <CardBody className="flex flex-col items-center gap-2 p-6 text-center">
                <Bot className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No chatbots found</p>
                {showCreateCard && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${basePath}/new`}>Create your first chatbot</Link>
                  </Button>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Create New Chatbot Row */}
          {showCreateCard && (
            <Link href={`${basePath}/new`}>
              <Card className="cursor-pointer border-dashed border-2 transition-colors hover:border-primary hover:bg-muted">
                <CardBody className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Create Chatbot</span>
                    <p className="text-sm text-muted-foreground">
                      Add a new AI chatbot
                    </p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          )}

          {/* Chatbot List Rows */}
          {agents.map((agent) => (
            <AgentListRow
              key={agent.id}
              agent={agent}
              basePath={basePath}
            />
          ))}

          {/* Empty State */}
          {agents.length === 0 && (
            <Card className="flex min-h-[100px] items-center justify-center">
              <CardBody className="flex items-center gap-4 p-6">
                <Bot className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No chatbots found</p>
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
  basePath = "/chatbots",
}: {
  agent: ChatbotListItem;
  basePath?: string;
}) {
  const statusColors = {
    active: "bg-success",
    paused: "bg-warning",
    draft: "bg-muted-foreground",
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
            <p className="text-sm text-muted-foreground">
              {agent.type} &bull; {agent.weeklyConversations} convos this week
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-medium">{agent.aiResolutionRate}%</p>
            <p className="text-sm text-muted-foreground">AI resolved</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}/${agent.id}`}>Edit</Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
