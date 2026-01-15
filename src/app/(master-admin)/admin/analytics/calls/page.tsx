"use client";

import { useState } from "react";
import { Download, Phone } from "lucide-react";

import { PageHeader } from "@/components/layouts";
import {
  CallMetricsGrid,
  CallsChart,
  CallsByProviderChart,
  CallsBySourceList,
  CallsByCompanyChart,
  CallsByStatusList,
} from "@/components/master-admin/analytics/calls";
import { Button, Select } from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import { useCallAnalytics } from "@/hooks/master-admin";

const DATE_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

export default function CallAnalyticsPage() {
  useSetPageTitle("Call Analytics");
  const [days, setDays] = useState(30);

  const { data, isLoading } = useCallAnalytics({ days, limit: 10 });

  const handleExport = () => {
    if (!data) return;

    // Create CSV content
    const csvRows: string[] = [];

    // Overview section
    csvRows.push("=== Call Analytics Overview ===");
    csvRows.push(`Total Calls,${data.overview.totalCalls}`);
    csvRows.push(`Completed Calls,${data.overview.completedCalls}`);
    csvRows.push(`Failed Calls,${data.overview.failedCalls}`);
    csvRows.push(`Success Rate,${data.overview.successRate}%`);
    csvRows.push(`Total Duration (min),${data.overview.totalDurationMinutes}`);
    csvRows.push(
      `Average Duration (sec),${data.overview.averageDurationSeconds}`
    );
    csvRows.push(`Total Turns,${data.overview.totalTurns}`);
    csvRows.push(`Average Turns,${data.overview.averageTurns}`);
    csvRows.push("");

    // By Provider section
    csvRows.push("=== By AI Provider ===");
    csvRows.push("Provider,Calls,Percentage,Total Duration,Avg Duration");
    data.byProvider.forEach((item) => {
      csvRows.push(
        `${item.provider},${item.count},${item.percentage}%,${item.totalDuration},${item.avgDuration}`
      );
    });
    csvRows.push("");

    // By Source section
    csvRows.push("=== By Source ===");
    csvRows.push("Source,Calls,Percentage");
    data.bySource.forEach((item) => {
      csvRows.push(`${item.source},${item.count},${item.percentage}%`);
    });
    csvRows.push("");

    // By Status section
    csvRows.push("=== By Status ===");
    csvRows.push("Status,Calls,Percentage");
    data.byStatus.forEach((item) => {
      csvRows.push(`${item.status},${item.count},${item.percentage}%`);
    });
    csvRows.push("");

    // Top Companies section
    csvRows.push("=== Top Companies ===");
    csvRows.push(
      "Company,Total Calls,Total Duration,Avg Duration,Success Rate"
    );
    data.topCompanies.forEach((item) => {
      csvRows.push(
        `${item.companyName},${item.totalCalls},${item.totalDuration},${item.avgDuration},${item.successRate}%`
      );
    });
    csvRows.push("");

    // Daily Data section
    csvRows.push("=== Daily Data ===");
    csvRows.push("Date,Total Calls,Completed,Failed,Duration (sec)");
    data.dailyData.forEach((item) => {
      csvRows.push(
        `${item.date},${item.totalCalls},${item.completedCalls},${item.failedCalls},${item.totalDuration}`
      );
    });

    // Create and download file
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `call-analytics-${days}days-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Call Analytics"
        description="Monitor voice call metrics across the platform"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Analytics", href: "/admin/analytics" },
          { label: "Calls" },
        ]}
        icon={<Phone className="text-primary" />}
        actions={
          <div className="flex items-center gap-3">
            <Select
              placeholder="Select range"
              value={days.toString()}
              onValueChange={(value) => setDays(parseInt(value, 10))}
              className="w-40"
              options={DATE_RANGE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <Button
              variant="outline"
              size="sm"
              leftIcon={Download}
              onClick={handleExport}
              isDisabled={!data}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Key Metrics */}
        <CallMetricsGrid overview={data?.overview} isLoading={isLoading} />

        {/* Call Volume Chart */}
        <CallsChart data={data?.dailyData ?? []} isLoading={isLoading} />

        {/* Provider & Source Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CallsByProviderChart
            data={data?.byProvider ?? []}
            isLoading={isLoading}
          />
          <CallsBySourceList data={data?.bySource ?? []} isLoading={isLoading} />
        </div>

        {/* Status & Company Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CallsByCompanyChart
              data={data?.topCompanies ?? []}
              isLoading={isLoading}
            />
          </div>
          <CallsByStatusList data={data?.byStatus ?? []} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
