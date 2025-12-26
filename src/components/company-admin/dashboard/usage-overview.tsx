"use client";

import { motion } from "framer-motion";
import { Zap, ArrowRight, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, CardBody, Progress, Skeleton } from "@/components/ui";
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

function UsageBar({ item, index }: { item: UsageItem; index: number }) {
  const isWarning = item.percentage >= 80;
  const isDanger = item.percentage >= 95;

  const statusColor = isDanger
    ? "text-destructive"
    : isWarning
      ? "text-warning"
      : "text-primary";

  const bgColor = isDanger
    ? "bg-destructive/10"
    : isWarning
      ? "bg-warning/10"
      : "bg-primary/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "p-4 rounded-xl border transition-all duration-200",
        isDanger ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{item.name}</span>
        {isDanger && (
          <AlertTriangle size={14} className="text-destructive" />
        )}
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-2xl font-bold">{formatNumber(item.current)}</span>
        <span className="text-sm text-muted-foreground">/ {formatNumber(item.limit)}</span>
      </div>
      <div className="space-y-2">
        <Progress
          value={item.percentage}
          color={isDanger ? "danger" : isWarning ? "warning" : "primary"}
          size="sm"
          className="h-2"
        />
        <div className="flex items-center justify-between">
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
            bgColor, statusColor
          )}>
            <TrendingUp size={10} />
            {item.percentage}% used
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function UsageOverview({
  planName,
  usage,
  isLoading,
}: UsageOverviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="font-semibold">Usage This Month</h3>
            <p className="text-sm text-muted-foreground">Monitor your resource consumption</p>
          </div>
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
            "bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
          )}>
            <Zap size={14} className="text-primary" />
            <span className="text-sm font-medium">{planName}</span>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {usage.map((item, index) => (
            <UsageBar key={item.name} item={item} index={index} />
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Need more resources?
          </p>
          <Button asChild variant="ghost" size="sm" className="group">
            <Link href="/billing" className="flex items-center gap-1">
              Upgrade Plan
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
