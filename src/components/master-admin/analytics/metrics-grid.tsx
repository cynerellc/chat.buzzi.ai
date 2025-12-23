"use client";

import {
  MessageSquare,
  Users,
  MessagesSquare,
  Bot,
  UserCheck,
} from "lucide-react";

import { Card, Skeleton } from "@/components/ui";
import type { AnalyticsOverview } from "@/hooks/master-admin";

interface MetricCardProps {
  title: string;
  value: string | number;
  growth: number;
  icon: React.ReactNode;
  isLoading?: boolean;
}

function MetricCard({ title, value, growth, icon, isLoading }: MetricCardProps) {
  const isPositive = growth >= 0;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-default-500">{title}</p>
          <p className="text-2xl font-semibold mt-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p
            className={`text-sm mt-1 ${
              isPositive ? "text-success" : "text-danger"
            }`}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(growth)}%
          </p>
        </div>
        <div className="p-2 bg-primary-50 rounded-lg text-primary">
          {icon}
        </div>
      </div>
    </Card>
  );
}

interface MetricsGridProps {
  overview: AnalyticsOverview | undefined;
  isLoading: boolean;
}

export function MetricsGrid({ overview, isLoading }: MetricsGridProps) {
  const metrics = [
    {
      title: "Total Conversations",
      value: overview?.totalConversations ?? 0,
      growth: overview?.conversationsGrowth ?? 0,
      icon: <MessageSquare size={24} />,
    },
    {
      title: "Active Users",
      value: overview?.activeUsers ?? 0,
      growth: overview?.activeUsersGrowth ?? 0,
      icon: <Users size={24} />,
    },
    {
      title: "Total Messages",
      value: overview?.totalMessages ?? 0,
      growth: overview?.messagesGrowth ?? 0,
      icon: <MessagesSquare size={24} />,
    },
    {
      title: "AI Resolution",
      value: `${overview?.aiResolutionRate ?? 0}%`,
      growth: overview?.aiResolutionGrowth ?? 0,
      icon: <Bot size={24} />,
    },
    {
      title: "Human Escalations",
      value: `${overview?.humanEscalationRate ?? 0}%`,
      growth: overview?.humanEscalationGrowth ?? 0,
      icon: <UserCheck size={24} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          growth={metric.growth}
          icon={metric.icon}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
