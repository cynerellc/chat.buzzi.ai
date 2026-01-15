"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, Skeleton } from "@/components/ui";
import type { CallsByCompany } from "@/hooks/master-admin";

interface CallsByCompanyChartProps {
  data: CallsByCompany[];
  isLoading: boolean;
}

export function CallsByCompanyChart({
  data,
  isLoading,
}: CallsByCompanyChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Top Companies by Calls</h3>
        <div className="h-[300px] flex items-center justify-center text-default-400">
          No call data available
        </div>
      </Card>
    );
  }

  // Format company names for display
  const chartData = data.map((item) => ({
    ...item,
    name:
      item.companyName.length > 15
        ? item.companyName.substring(0, 15) + "..."
        : item.companyName,
    durationMinutes: Math.round(item.totalDuration / 60),
  }));

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Top Companies by Calls</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-default-200"
            />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--nextui-content1))",
                border: "1px solid hsl(var(--nextui-default-200))",
                borderRadius: "8px",
              }}
              formatter={(value, name, props) => {
                const item = props.payload;
                if (name === "totalCalls") {
                  return [
                    <div key="tooltip" className="text-sm">
                      <div>
                        <strong>{value}</strong> calls
                      </div>
                      <div className="text-default-500">
                        Success: {item.successRate}%
                      </div>
                      <div className="text-default-500">
                        Avg: {formatDuration(item.avgDuration)}
                      </div>
                    </div>,
                    "Calls",
                  ];
                }
                return [value, name];
              }}
            />
            <Bar
              dataKey="totalCalls"
              fill="hsl(var(--nextui-primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
