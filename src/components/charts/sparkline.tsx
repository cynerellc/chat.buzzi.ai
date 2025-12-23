"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

import { cn } from "@/lib/utils";

export interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function Sparkline({
  data,
  color,
  height = 40,
  strokeWidth = 2,
  showArea = false,
  trend,
  className,
}: SparklineProps) {
  // Convert raw numbers to chart data
  const chartData = data.map((value, index) => ({ index, value }));

  // Auto-detect trend if not provided
  const lastValue = data[data.length - 1];
  const firstValue = data[0];
  const effectiveTrend =
    trend ?? (data.length > 1 && lastValue !== undefined && firstValue !== undefined
      ? (lastValue > firstValue ? "up" : "down")
      : "neutral");

  // Select color based on trend
  const effectiveColor =
    color ??
    (effectiveTrend === "up"
      ? "hsl(var(--heroui-success))"
      : effectiveTrend === "down"
        ? "hsl(var(--heroui-danger))"
        : "hsl(var(--heroui-default-400))");

  // Calculate min/max for proper scaling
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const padding = (maxValue - minValue) * 0.1;

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis
            domain={[minValue - padding, maxValue + padding]}
            hide
          />
          <defs>
            {showArea && (
              <linearGradient id={`sparkline-gradient-${effectiveTrend}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={effectiveColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={effectiveColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <Line
            type="monotone"
            dataKey="value"
            stroke={effectiveColor}
            strokeWidth={strokeWidth}
            dot={false}
            fill={showArea ? `url(#sparkline-gradient-${effectiveTrend})` : "none"}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Mini bar sparkline
export interface BarSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  gap?: number;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function BarSparkline({
  data,
  color,
  height = 40,
  gap = 2,
  trend,
  className,
}: BarSparklineProps) {
  const max = Math.max(...data);
  const barLastValue = data[data.length - 1];
  const barFirstValue = data[0];
  const effectiveTrend =
    trend ?? (data.length > 1 && barLastValue !== undefined && barFirstValue !== undefined
      ? (barLastValue > barFirstValue ? "up" : "down")
      : "neutral");

  const effectiveColor =
    color ??
    (effectiveTrend === "up"
      ? "bg-success"
      : effectiveTrend === "down"
        ? "bg-danger"
        : "bg-default-400");

  return (
    <div
      className={cn("flex items-end", className)}
      style={{ height, gap }}
    >
      {data.map((value, index) => {
        const barHeight = max > 0 ? (value / max) * 100 : 0;
        return (
          <div
            key={index}
            className={cn("flex-1 rounded-sm transition-all", effectiveColor)}
            style={{ height: `${Math.max(barHeight, 5)}%` }}
          />
        );
      })}
    </div>
  );
}
