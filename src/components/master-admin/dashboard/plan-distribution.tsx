"use client";

import { DonutChart } from "@/components/charts";
import { Card, Skeleton } from "@/components/ui";
import { usePlanDistribution } from "@/hooks/master-admin";

export function PlanDistribution() {
  const { distribution, isLoading } = usePlanDistribution();

  const total = distribution.reduce((sum, item) => sum + item.value, 0);

  // Transform data to match DonutChartDataPoint interface
  const chartData = distribution.map((item) => ({
    name: item.name,
    value: item.value,
    color: item.color,
  }));

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="font-semibold">Subscription Distribution</h3>
        <p className="text-sm text-default-500">Companies by plan type</p>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <Skeleton className="h-48 w-48 rounded-full" />
        </div>
      ) : distribution.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-default-400">
          No subscription data available
        </div>
      ) : (
        <>
          <DonutChart
            data={chartData}
            height={200}
            innerRadius={60}
            outerRadius={80}
            showLabels={false}
          />
          <div className="mt-4 space-y-2">
            {distribution.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-default-600">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.value}</span>
                  <span className="text-default-400">
                    ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
