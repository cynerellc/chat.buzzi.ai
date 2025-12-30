"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layouts";
import {
  AnalyticsHeader,
  MetricsGrid,
  ConversationsChart,
  UsageByCompany,
  ChannelBreakdown,
} from "@/components/master-admin/analytics";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  useAnalyticsOverview,
  useConversationsAnalytics,
  useUsageAnalytics,
} from "@/hooks/master-admin";

export default function AnalyticsPage() {
  useSetPageTitle("Analytics");
  const [days, setDays] = useState(30);

  const { overview, isLoading: isOverviewLoading } = useAnalyticsOverview();
  const { data: conversationsData, isLoading: isConversationsLoading } =
    useConversationsAnalytics({ days });
  const { data: usageData, isLoading: isUsageLoading } = useUsageAnalytics({
    days,
    limit: 10,
  });

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export analytics report");
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Platform Analytics"
        description="Monitor platform-wide metrics and performance"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Analytics" },
        ]}
      />

      <AnalyticsHeader
        selectedDays={days}
        onDaysChange={setDays}
        onExport={handleExport}
      />

      <div className="space-y-6">
        {/* Key Metrics */}
        <MetricsGrid overview={overview} isLoading={isOverviewLoading} />

        {/* Conversations Chart */}
        <ConversationsChart
          data={conversationsData?.data ?? []}
          isLoading={isConversationsLoading}
        />

        {/* Usage Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UsageByCompany
            data={usageData?.topCompanies ?? []}
            isLoading={isUsageLoading}
          />
          <ChannelBreakdown
            data={usageData?.channelBreakdown ?? []}
            isLoading={isUsageLoading}
          />
        </div>
      </div>
    </div>
  );
}
