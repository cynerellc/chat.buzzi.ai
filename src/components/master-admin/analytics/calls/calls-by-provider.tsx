"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

import { Card, Skeleton } from "@/components/ui";
import type { CallsByProvider } from "@/hooks/master-admin";

interface CallsByProviderChartProps {
  data: CallsByProvider[];
  isLoading: boolean;
}

const COLORS = [
  "hsl(var(--nextui-primary))",
  "hsl(var(--nextui-secondary))",
  "hsl(var(--nextui-success))",
  "hsl(var(--nextui-warning))",
];

const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: "OpenAI Realtime",
  GEMINI: "Gemini Live",
  unknown: "Unknown",
};

export function CallsByProviderChart({
  data,
  isLoading,
}: CallsByProviderChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Calls by AI Provider</h3>
        <div className="h-[250px] flex items-center justify-center text-default-400">
          No call data available
        </div>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: PROVIDER_LABELS[item.provider] || item.provider,
  }));

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Calls by AI Provider</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="count"
              label={({ name, payload }) => `${name} (${payload?.percentage ?? 0}%)`}
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--nextui-content1))",
                border: "1px solid hsl(var(--nextui-default-200))",
                borderRadius: "8px",
              }}
              formatter={(value, name, props) => {
                const item = props.payload;
                return [
                  <div key="tooltip" className="text-sm">
                    <div>
                      <strong>{value}</strong> calls
                    </div>
                    <div className="text-default-500">
                      Avg: {formatDuration(item.avgDuration)}
                    </div>
                  </div>,
                  name,
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
