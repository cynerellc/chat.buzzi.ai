"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Card, Skeleton } from "../ui";

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
  sparkline?: number[];
}

export function StatCard({
  title,
  value,
  change,
  changeLabel = "from last period",
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  trend,
  onClick,
  isLoading,
  className,
  sparkline,
}: StatCardProps) {
  // Auto-detect trend from change if not provided
  const effectiveTrend = trend ?? (change !== undefined ? (change > 0 ? "up" : change < 0 ? "down" : "neutral") : undefined);

  const trendConfig = {
    up: { color: "text-success", Icon: ArrowUpRight, bgColor: "bg-success/10" },
    down: { color: "text-danger", Icon: ArrowDownRight, bgColor: "bg-danger/10" },
    neutral: { color: "text-default-500", Icon: Minus, bgColor: "bg-default-100" },
  };

  if (isLoading) {
    return (
      <Card className={cn("p-5", className)}>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </Card>
    );
  }

  const TrendIcon = effectiveTrend ? trendConfig[effectiveTrend].Icon : null;
  const trendColor = effectiveTrend ? trendConfig[effectiveTrend].color : "";

  return (
    <Card onClick={onClick} className={cn("p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-default-500">{title}</p>
          <motion.div
            className="text-2xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={String(value)}
          >
            {value}
          </motion.div>
          {change !== undefined && (
            <div className={cn("flex items-center gap-1.5 text-sm", trendColor)}>
              {TrendIcon && <TrendIcon size={16} />}
              <span className="font-medium">
                {change > 0 && "+"}
                {typeof change === "number" ? change.toFixed(1) : change}%
              </span>
              <span className="text-default-400">{changeLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2.5 rounded-xl", iconBgColor)}>
            <Icon size={22} className={iconColor} />
          </div>
        )}
      </div>

      {/* Simple sparkline visualization */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 h-10 flex items-end gap-0.5">
          {sparkline.map((value, index) => {
            const max = Math.max(...sparkline);
            const height = max > 0 ? (value / max) * 100 : 0;
            return (
              <div
                key={index}
                className={cn(
                  "flex-1 rounded-sm transition-all",
                  effectiveTrend === "up" ? "bg-success/30" :
                  effectiveTrend === "down" ? "bg-danger/30" : "bg-default-200"
                )}
                style={{ height: `${Math.max(height, 5)}%` }}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
