"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

import { Card, Skeleton } from "@/components/ui";
import type { ChannelBreakdown as ChannelBreakdownType } from "@/hooks/master-admin";

interface ChannelBreakdownProps {
  data: ChannelBreakdownType[];
  isLoading: boolean;
}

const COLORS = [
  "hsl(var(--nextui-primary))",
  "hsl(var(--nextui-secondary))",
  "hsl(var(--nextui-success))",
  "hsl(var(--nextui-warning))",
  "hsl(var(--nextui-danger))",
];

export function ChannelBreakdown({ data, isLoading }: ChannelBreakdownProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    name: item.channel.charAt(0).toUpperCase() + item.channel.slice(1),
    value: item.count,
    percentage: item.percentage,
  }));

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">By Channel</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--nextui-content1))",
                border: "1px solid hsl(var(--nextui-default-200))",
                borderRadius: "8px",
              }}
              formatter={(value, name) => {
                const numValue = typeof value === "number" ? value : 0;
                const strName = String(name);
                return [
                  `${numValue.toLocaleString()} (${chartData.find(d => d.name === strName)?.percentage ?? 0}%)`,
                  strName,
                ];
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
