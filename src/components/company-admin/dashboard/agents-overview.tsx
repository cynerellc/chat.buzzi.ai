"use client";

import { Plus, Bot } from "lucide-react";
import Link from "next/link";

import { Avatar, Badge, Button, Card, Skeleton } from "@/components/ui";
import type { AgentOverview } from "@/hooks/company";

interface AgentsOverviewProps {
  agents: AgentOverview[];
  isLoading?: boolean;
}

function AgentCard({ agent }: { agent: AgentOverview }) {
  const statusConfig = {
    active: { variant: "success" as const, label: "Active" },
    paused: { variant: "warning" as const, label: "Paused" },
    draft: { variant: "default" as const, label: "Draft" },
  };

  const config = statusConfig[agent.status] || statusConfig.draft;

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="p-4 hover:bg-default-50 transition-colors cursor-pointer h-full">
        <div className="flex flex-col items-center text-center">
          <Avatar
            src={agent.avatarUrl || undefined}
            name={agent.name}
            size="lg"
            icon={<Bot size={24} />}
            className="mb-3"
          />
          <h4 className="font-medium truncate w-full">{agent.name}</h4>
          <Badge variant={config.variant} className="mt-2">
            {config.label}
          </Badge>

          <div className="mt-4 w-full space-y-1 text-sm text-default-500">
            <div className="flex justify-between">
              <span>Today:</span>
              <span className="font-medium text-foreground">
                {agent.todayConversations} chats
              </span>
            </div>
            <div className="flex justify-between">
              <span>AI Resolved:</span>
              <span className="font-medium text-foreground">
                {agent.aiResolutionRate}%
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function CreateAgentCard() {
  return (
    <Link href="/agents/new">
      <Card className="p-4 h-full flex flex-col items-center justify-center text-center border-dashed border-2 hover:bg-default-50 transition-colors cursor-pointer min-h-[200px]">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Plus size={24} className="text-primary" />
        </div>
        <h4 className="font-medium">Create Agent</h4>
        <p className="text-sm text-default-500 mt-1">Add a new AI agent</p>
      </Card>
    </Link>
  );
}

export function AgentsOverview({ agents, isLoading }: AgentsOverviewProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Your Agents</h3>
        <Button as={Link} href="/agents" variant="light" size="sm">
          Manage Agents →
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        <CreateAgentCard />
      </div>
    </Card>
  );
}
