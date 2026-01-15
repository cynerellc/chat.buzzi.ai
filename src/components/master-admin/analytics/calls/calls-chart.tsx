"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Card, Skeleton } from "@/components/ui";
import type { CallDataPoint } from "@/hooks/master-admin";

interface CallsChartProps {
  data: CallDataPoint[];
  isLoading: boolean;
}

export function CallsChart({ data, isLoading }: CallsChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  // Format data for the chart
  const chartData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    durationMinutes: Math.round(item.totalDuration / 60),
  }));

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Call Volume</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-default-200"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-default-500"
            />
            <YAxis tick={{ fontSize: 12 }} className="text-default-500" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--nextui-content1))",
                border: "1px solid hsl(var(--nextui-default-200))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalCalls"
              name="Total Calls"
              stroke="hsl(var(--nextui-primary))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="completedCalls"
              name="Completed"
              stroke="hsl(var(--nextui-success))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failedCalls"
              name="Failed"
              stroke="hsl(var(--nextui-danger))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
