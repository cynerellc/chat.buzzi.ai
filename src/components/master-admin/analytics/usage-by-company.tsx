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
import type { CompanyUsage } from "@/hooks/master-admin";

interface UsageByCompanyProps {
  data: CompanyUsage[];
  isLoading: boolean;
}

export function UsageByCompany({ data, isLoading }: UsageByCompanyProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  // Format company names for display
  const chartData = data.map((item) => ({
    ...item,
    name: item.companyName.length > 15
      ? item.companyName.substring(0, 15) + "..."
      : item.companyName,
  }));

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Top Companies by Usage</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-default-200" />
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
              formatter={(value, name) => {
                const numValue = typeof value === "number" ? value : 0;
                return [
                  numValue.toLocaleString(),
                  name === "conversations" ? "Conversations" : "Messages",
                ];
              }}
            />
            <Bar
              dataKey="conversations"
              fill="hsl(var(--nextui-primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
