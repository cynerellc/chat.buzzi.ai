"use client";

import { format } from "date-fns";
import {
  Bot,
  MessageSquare,
  MoreVertical,
  Package,
  Search,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import {
  Badge,
  Button,
  Card,
  Dropdown,
  type DropdownMenuItemData,
  EmptyState,
  Input,
  Skeleton,
  type BadgeVariant,
} from "@/components/ui";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

interface CompanyAgent {
  id: string;
  name: string;
  description: string | null;
  packageId: string | null;
  packageName: string;
  status: string;
  conversationCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CompanyAgentsProps {
  companyId: string;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  draft: "warning",
  paused: "default",
  archived: "danger",
};

export function CompanyAgents({ companyId }: CompanyAgentsProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = useSWR<{ agents: CompanyAgent[] }>(
    `/api/master-admin/companies/${companyId}/chatbots`,
    fetcher
  );

  const filteredAgents = (data?.agents ?? []).filter((agent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.packageName.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query)
    );
  });

  const handleConfigureAgent = (agentId: string) => {
    router.push(`/admin/companies/${companyId}/agents/${agentId}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getAgentDropdownItems = (_agentId: string): DropdownMenuItemData[] => [
    {
      key: "configure",
      label: "Configure Agent",
      icon: Settings,
    },
    {
      key: "view-conversations",
      label: "View Conversations",
      icon: MessageSquare,
    },
  ];

  const handleAgentAction = (agentId: string, key: React.Key) => {
    if (key === "configure") {
      handleConfigureAgent(agentId);
    }
    // Add other actions as needed
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-danger">{error.message}</p>
      </Card>
    );
  }

  const activeCount = data?.agents?.filter((a) => a.status === "active").length ?? 0;
  const totalCount = data?.agents?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <h3 className="font-semibold">Agents</h3>
          <Badge variant="default" size="sm">
            {activeCount} active / {totalCount} total
          </Badge>
        </div>
        <Input
          placeholder="Search agents..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          startContent={<Search size={16} className="text-default-400" />}
          className="w-64 h-9"
        />
      </div>

      {/* Agents Grid */}
      {totalCount === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Bot}
            title="No Agents"
            description="This company hasn't created any agents yet."
          />
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card className="p-6 text-center">
          <Search size={40} className="mx-auto mb-3 text-default-300" />
          <p className="text-default-500">
            No agents match &quot;{searchQuery}&quot;
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-100">
                    <Bot size={20} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{agent.name}</h4>
                      <Badge
                        variant={statusBadgeVariants[agent.status] ?? "default"}
                        size="sm"
                      >
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-default-500">
                      {agent.description ?? "No description"}
                    </p>
                  </div>
                </div>

                <Dropdown
                  trigger={
                    <Button variant="secondary" size="icon">
                      <MoreVertical size={16} />
                    </Button>
                  }
                  items={getAgentDropdownItems(agent.id)}
                  onAction={(key) => handleAgentAction(agent.id, key)}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-default-500 mb-3">
                <Package size={14} />
                <span>{agent.packageName}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-default-50 rounded-lg text-center">
                <div>
                  <p className="text-lg font-semibold">
                    {agent.conversationCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-default-500">Conversations</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {agent.messageCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-default-500">Messages</p>
                </div>
                <div>
                  <p className="text-xs text-default-500">Created</p>
                  <p className="text-sm">
                    {format(new Date(agent.createdAt), "MMM d")}
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                className="w-full mt-3"
                startContent={<Settings size={16} />}
                onClick={() => handleConfigureAgent(agent.id)}
              >
                Configure
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {totalCount > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{totalCount}</p>
              <p className="text-sm text-default-500">Total Agents</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{activeCount}</p>
              <p className="text-sm text-default-500">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">
                {filteredAgents.reduce(
                  (sum, a) => sum + a.conversationCount,
                  0
                ).toLocaleString()}
              </p>
              <p className="text-sm text-default-500">Total Conversations</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-info">
                {filteredAgents.reduce(
                  (sum, a) => sum + a.messageCount,
                  0
                ).toLocaleString()}
              </p>
              <p className="text-sm text-default-500">Total Messages</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
