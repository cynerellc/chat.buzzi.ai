"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { cn } from "@/lib/utils";

export interface BarChartDataPoint {
  name: string;
  [key: string]: string | number;
}

export interface BarConfig {
  dataKey: string;
  color?: string;
  name?: string;
  stackId?: string;
  radius?: number;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  bars: BarConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  xAxisKey?: string;
  yAxisWidth?: number;
  layout?: "horizontal" | "vertical";
  className?: string;
}

const defaultColors = [
  "hsl(var(--heroui-primary))",
  "hsl(var(--heroui-secondary))",
  "hsl(var(--heroui-success))",
  "hsl(var(--heroui-warning))",
  "hsl(var(--heroui-danger))",
];

export function BarChart({
  data,
  bars,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisKey = "name",
  yAxisWidth = 40,
  layout = "horizontal",
  className,
}: BarChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--heroui-divider))"
              vertical={layout === "horizontal" ? false : true}
              horizontal={layout === "horizontal" ? true : false}
            />
          )}
          {layout === "horizontal" ? (
            <>
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 12, fill: "hsl(var(--heroui-default-500))" }}
                axisLine={{ stroke: "hsl(var(--heroui-divider))" }}
                tickLine={false}
              />
              <YAxis
                width={yAxisWidth}
                tick={{ fontSize: 12, fill: "hsl(var(--heroui-default-500))" }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: "hsl(var(--heroui-default-500))" }}
                axisLine={{ stroke: "hsl(var(--heroui-divider))" }}
                tickLine={false}
              />
              <YAxis
                dataKey={xAxisKey}
                type="category"
                width={yAxisWidth}
                tick={{ fontSize: 12, fill: "hsl(var(--heroui-default-500))" }}
                axisLine={false}
                tickLine={false}
              />
            </>
          )}
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--heroui-content1))",
                border: "1px solid hsl(var(--heroui-divider))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              cursor={{ fill: "hsl(var(--heroui-default-100))" }}
            />
          )}
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
              iconType="rect"
              iconSize={12}
            />
          )}
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name ?? bar.dataKey}
              fill={bar.color ?? defaultColors[index % defaultColors.length]}
              stackId={bar.stackId}
              radius={bar.radius ?? 4}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
