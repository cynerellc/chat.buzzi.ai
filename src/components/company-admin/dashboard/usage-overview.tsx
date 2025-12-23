"use client";

import Link from "next/link";

import { Badge, Button, Card, Progress, Skeleton } from "@/components/ui";
import type { UsageItem } from "@/hooks/company";

interface UsageOverviewProps {
  planName: string;
  usage: UsageItem[];
  isLoading?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function UsageBar({ item }: { item: UsageItem }) {
  const isWarning = item.percentage >= 80;
  const isDanger = item.percentage >= 95;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-default-500">{item.name}</span>
        <span className="font-medium">
          {formatNumber(item.current)} / {formatNumber(item.limit)}
        </span>
      </div>
      <Progress
        value={item.percentage}
        color={isDanger ? "danger" : isWarning ? "warning" : "primary"}
        size="sm"
        className="max-w-full"
      />
      <div className="text-xs text-default-400 text-right">{item.percentage}%</div>
    </div>
  );
}

export function UsageOverview({
  planName,
  usage,
  isLoading,
}: UsageOverviewProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Usage This Month</h3>
        <Badge variant="info">Plan: {planName}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {usage.map((item) => (
          <UsageBar key={item.name} item={item} />
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-default-100 flex justify-end">
        <Button as={Link} href="/settings/billing" variant="light" size="sm">
          View Details →
        </Button>
      </div>
    </Card>
  );
}
