"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  Bot,
  Building2,
  Clock,
  RefreshCw,
  Rocket,
  Search,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import {
  Badge,
  Button,
  Card,
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

export interface PackageDeployment {
  id: string;
  agentId: string;
  agentName: string;
  companyId: string;
  companyName: string;
  versionId: string;
  version: string;
  deployedAt: string;
  status: "active" | "inactive" | "error";
  lastActivityAt: string | null;
  conversationCount: number;
}

interface PackageDeploymentsProps {
  packageId: string;
  onViewAgent?: (companyId: string, agentId: string) => void;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  inactive: "default",
  error: "danger",
};

export function PackageDeployments({
  packageId,
  onViewAgent,
}: PackageDeploymentsProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error, mutate } = useSWR<{
    deployments: PackageDeployment[];
  }>(`/api/master-admin/packages/${packageId}/deployments`, fetcher);

  const filteredDeployments = (data?.deployments ?? []).filter((deployment) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      deployment.agentName.toLowerCase().includes(query) ||
      deployment.companyName.toLowerCase().includes(query)
    );
  });

  const groupedDeployments = filteredDeployments.reduce(
    (acc, deployment) => {
      const existing = acc[deployment.companyId];
      if (!existing) {
        acc[deployment.companyId] = {
          companyName: deployment.companyName,
          companyId: deployment.companyId,
          deployments: [deployment],
        };
      } else {
        existing.deployments.push(deployment);
      }
      return acc;
    },
    {} as Record<
      string,
      {
        companyName: string;
        companyId: string;
        deployments: PackageDeployment[];
      }
    >
  );

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-danger">{error.message}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          startContent={<RefreshCw size={16} />}
          onPress={() => mutate()}
        >
          Retry
        </Button>
      </Card>
    );
  }

  const totalDeployments = data?.deployments?.length ?? 0;
  const activeDeployments =
    data?.deployments?.filter((d) => d.status === "active").length ?? 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Rocket size={20} />
          <h3 className="font-semibold">Deployments</h3>
          <Badge variant="default" size="sm">
            {activeDeployments} active / {totalDeployments} total
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search agents or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            aria-label="Refresh deployments"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {totalDeployments === 0 ? (
        <div className="text-center py-8">
          <Rocket size={40} className="mx-auto mb-3 text-default-300" />
          <p className="text-default-500">
            No agents are using this package yet
          </p>
          <p className="text-sm text-default-400 mt-1">
            Companies can deploy this package to their agents from the agent
            configuration page.
          </p>
        </div>
      ) : filteredDeployments.length === 0 ? (
        <div className="text-center py-8">
          <Search size={40} className="mx-auto mb-3 text-default-300" />
          <p className="text-default-500">
            No deployments match &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedDeployments).map((group) => (
            <div key={group.companyId} className="space-y-3">
              {/* Company Header */}
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={16} className="text-default-400" />
                <span className="font-medium">{group.companyName}</span>
                <Badge variant="default" size="sm">
                  {group.deployments.length} agent
                  {group.deployments.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Agent Deployments */}
              <div className="grid gap-3 md:grid-cols-2">
                {group.deployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="p-4 border border-divider rounded-lg hover:bg-default-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot size={18} className="text-primary" />
                        <span className="font-medium">
                          {deployment.agentName}
                        </span>
                      </div>
                      <Badge
                        variant={statusBadgeVariants[deployment.status]}
                        size="sm"
                      >
                        {deployment.status}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm text-default-500">
                      <div className="flex items-center gap-2">
                        <span>Version:</span>
                        <code className="font-mono text-xs bg-default-100 px-1 rounded">
                          v{deployment.version}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>
                          Deployed{" "}
                          {format(
                            new Date(deployment.deployedAt),
                            "MMM d, yyyy"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{deployment.conversationCount} conversations</span>
                      </div>
                    </div>

                    {onViewAgent && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3 w-full"
                        endContent={<ArrowRight size={14} />}
                        onPress={() =>
                          onViewAgent(deployment.companyId, deployment.agentId)
                        }
                      >
                        View Agent
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {totalDeployments > 0 && (
        <div className="mt-6 pt-4 border-t border-divider">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">
                {Object.keys(groupedDeployments).length}
              </p>
              <p className="text-sm text-default-500">Companies</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">
                {activeDeployments}
              </p>
              <p className="text-sm text-default-500">Active Agents</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">
                {filteredDeployments.reduce(
                  (sum, d) => sum + d.conversationCount,
                  0
                )}
              </p>
              <p className="text-sm text-default-500">Total Conversations</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
