"use client";

import {
  CheckCircle,
  XCircle,
  Clock,
  PhoneOff,
  PhoneIncoming,
  Loader,
} from "lucide-react";

import { Card, Skeleton, Chip } from "@/components/ui";
import type { CallsByStatus } from "@/hooks/master-admin";

interface CallsByStatusListProps {
  data: CallsByStatus[];
  isLoading: boolean;
}

const STATUS_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    label: string;
    color: "success" | "danger" | "warning" | "primary" | "default";
  }
> = {
  completed: {
    icon: <CheckCircle size={16} />,
    label: "Completed",
    color: "success",
  },
  failed: {
    icon: <XCircle size={16} />,
    label: "Failed",
    color: "danger",
  },
  in_progress: {
    icon: <Loader size={16} />,
    label: "In Progress",
    color: "primary",
  },
  pending: {
    icon: <Clock size={16} />,
    label: "Pending",
    color: "warning",
  },
  connecting: {
    icon: <PhoneIncoming size={16} />,
    label: "Connecting",
    color: "primary",
  },
  no_answer: {
    icon: <PhoneOff size={16} />,
    label: "No Answer",
    color: "default",
  },
};

export function CallsByStatusList({ data, isLoading }: CallsByStatusListProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Calls by Status</h3>
        <div className="h-[150px] flex items-center justify-center text-default-400">
          No call data available
        </div>
      </Card>
    );
  }

  // Sort by count descending
  const sortedData = [...data].sort((a, b) => b.count - a.count);

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Calls by Status</h3>
      <div className="space-y-3">
        {sortedData.map((item) => {
          const config = STATUS_CONFIG[item.status] || {
            icon: <Clock size={16} />,
            label: item.status,
            color: "default" as const,
          };

          return (
            <div
              key={item.status}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Chip color={config.color} size="sm">
                  <span className="flex items-center gap-1">
                    {config.icon}
                    {config.label}
                  </span>
                </Chip>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {item.count.toLocaleString()}
                </span>
                <span className="text-sm text-default-500 w-12 text-right">
                  {item.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
