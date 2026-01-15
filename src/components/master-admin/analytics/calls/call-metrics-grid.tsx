"use client";

import { Phone, CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";

import { Card, Skeleton } from "@/components/ui";
import type { CallAnalyticsOverview } from "@/hooks/master-admin";

interface MetricCardProps {
  title: string;
  value: string | number;
  growth?: number;
  icon: React.ReactNode;
  isLoading?: boolean;
  showGrowth?: boolean;
}

function MetricCard({
  title,
  value,
  growth = 0,
  icon,
  isLoading,
  showGrowth = true,
}: MetricCardProps) {
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
          {showGrowth && (
            <p
              className={`text-sm mt-1 ${
                isPositive ? "text-success" : "text-danger"
              }`}
            >
              {isPositive ? "↑" : "↓"} {Math.abs(growth)}%
            </p>
          )}
        </div>
        <div className="p-2 bg-primary-50 rounded-lg text-primary">{icon}</div>
      </div>
    </Card>
  );
}

interface CallMetricsGridProps {
  overview: CallAnalyticsOverview | undefined;
  isLoading: boolean;
}

export function CallMetricsGrid({ overview, isLoading }: CallMetricsGridProps) {
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const metrics = [
    {
      title: "Total Calls",
      value: overview?.totalCalls ?? 0,
      growth: overview?.callsGrowth ?? 0,
      icon: <Phone size={24} />,
      showGrowth: true,
    },
    {
      title: "Success Rate",
      value: `${overview?.successRate ?? 0}%`,
      growth: overview?.successRateGrowth ?? 0,
      icon: <CheckCircle size={24} />,
      showGrowth: true,
    },
    {
      title: "Failed Calls",
      value: overview?.failedCalls ?? 0,
      growth: 0,
      icon: <XCircle size={24} />,
      showGrowth: false,
    },
    {
      title: "Avg Duration",
      value: formatDuration(overview?.averageDurationSeconds ?? 0),
      growth: overview?.durationGrowth ?? 0,
      icon: <Clock size={24} />,
      showGrowth: true,
    },
    {
      title: "Avg Turns",
      value: overview?.averageTurns ?? 0,
      growth: 0,
      icon: <MessageSquare size={24} />,
      showGrowth: false,
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
          showGrowth={metric.showGrowth}
        />
      ))}
    </div>
  );
}
