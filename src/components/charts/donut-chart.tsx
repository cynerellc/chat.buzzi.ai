"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export interface DonutChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

export interface DonutChartProps {
  data: DonutChartDataPoint[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  showLabels?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}

const defaultColors = [
  "hsl(var(--heroui-primary))",
  "hsl(var(--heroui-secondary))",
  "hsl(var(--heroui-success))",
  "hsl(var(--heroui-warning))",
  "hsl(var(--heroui-danger))",
  "hsl(var(--heroui-default-400))",
];

export function DonutChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 80,
  showLegend = true,
  showTooltip = true,
  showLabels = false,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={cn("w-full relative", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={
              showLabels
                ? ({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                : undefined
            }
            labelLine={showLabels}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color ?? defaultColors[index % defaultColors.length]}
                strokeWidth={0}
              />
            ))}
          </Pie>
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--heroui-content1))",
                border: "1px solid hsl(var(--heroui-divider))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => {
                const numValue = typeof value === "number" ? value : 0;
                return [`${numValue} (${((numValue / total) * 100).toFixed(1)}%)`, ""];
              }}
            />
          )}
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              iconType="circle"
              iconSize={8}
              layout="vertical"
              align="right"
              verticalAlign="middle"
            />
          )}
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            {centerValue && (
              <div className="text-2xl font-bold">{centerValue}</div>
            )}
            {centerLabel && (
              <div className="text-xs text-default-500">{centerLabel}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
