"use client";

import { MessageSquare, Bot, UserCheck, Clock } from "lucide-react";

import { StatCard } from "@/components/shared";
import { Skeleton } from "@/components/ui";
import type { DashboardStats } from "@/hooks/company";

interface MetricsGridProps {
  stats?: DashboardStats;
  isLoading?: boolean;
}

export function MetricsGrid({ stats, isLoading }: MetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  // For escalations and response time, lower is better, so invert the trend
  const getInvertedTrend = (change: number): "up" | "down" | "neutral" => {
    if (change > 0) return "down"; // Increasing is bad
    if (change < 0) return "up"; // Decreasing is good
    return "neutral";
  };

  const metrics = [
    {
      title: "Active Conversations",
      value: stats?.activeConversations ?? 0,
      icon: MessageSquare,
      change: stats?.activeConversationsChange ?? 0,
      formatValue: (v: number) => v.toString(),
    },
    {
      title: "AI Resolution",
      value: stats?.aiResolutionRate ?? 0,
      icon: Bot,
      change: stats?.aiResolutionChange ?? 0,
      formatValue: (v: number) => `${v}%`,
    },
    {
      title: "Human Escalations",
      value: stats?.humanEscalations ?? 0,
      icon: UserCheck,
      change: stats?.humanEscalationsChange ?? 0,
      trend: getInvertedTrend(stats?.humanEscalationsChange ?? 0),
      formatValue: (v: number) => v.toString(),
    },
    {
      title: "Avg Response",
      value: stats?.avgResponseTime ?? 0,
      icon: Clock,
      change: stats?.avgResponseTimeChange ?? 0,
      trend: getInvertedTrend(stats?.avgResponseTimeChange ?? 0),
      formatValue: (v: number) => `${v.toFixed(1)}m`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <StatCard
          key={metric.title}
          title={metric.title}
          value={metric.formatValue(metric.value)}
          icon={metric.icon}
          change={metric.change}
          trend={"trend" in metric ? metric.trend : undefined}
        />
      ))}
    </div>
  );
}
