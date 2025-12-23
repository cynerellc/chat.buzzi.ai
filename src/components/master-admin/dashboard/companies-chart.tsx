"use client";

import { useState } from "react";

import { LineChart } from "@/components/charts";
import { Card, Skeleton, Tabs } from "@/components/ui";
import { useActivityChartData } from "@/hooks/master-admin";

const timeRanges = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

export function CompaniesChart() {
  const [days, setDays] = useState(30);
  const { chartData, isLoading } = useActivityChartData(days);

  const formattedData = chartData.map((point) => ({
    ...point,
    name: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold">Platform Activity</h3>
          <p className="text-sm text-default-500">Company signups over time</p>
        </div>
        <Tabs
          items={timeRanges}
          selectedKey={String(days)}
          onSelectionChange={(key) => setDays(Number(key))}
          size="sm"
          variant="bordered"
        />
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      ) : (
        <LineChart
          data={formattedData}
          xAxisKey="name"
          lines={[
            {
              dataKey: "companies",
              name: "New Companies",
              color: "#6366F1",
            },
          ]}
          height={256}
          showGrid
          showTooltip
          showLegend
        />
      )}
    </Card>
  );
}
