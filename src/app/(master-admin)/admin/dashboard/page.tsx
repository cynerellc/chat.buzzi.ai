"use client";

import { RefreshCw } from "lucide-react";
import { useCallback } from "react";

import { PageHeader } from "@/components/layouts";
import {
  StatsGrid,
  CompaniesChart,
  PlanDistribution,
  RecentCompanies,
  QuickActions,
  SystemHealth,
  ActivityFeed,
} from "@/components/master-admin/dashboard";
import { Button } from "@/components/ui";
import { useDashboardStats } from "@/hooks/master-admin";

export default function MasterAdminDashboard() {
  const { refresh, isLoading } = useDashboardStats();

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Platform overview and key metrics"
        actions={
          <Button
            variant="bordered"
            size="sm"
            leftIcon={RefreshCw}
            onPress={handleRefresh}
            isLoading={isLoading}
          >
            Refresh
          </Button>
        }
      />

      {/* Key Metrics */}
      <StatsGrid />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CompaniesChart />
        </div>
        <PlanDistribution />
      </div>

      {/* Companies & Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentCompanies />
        <QuickActions />
      </div>

      {/* Health & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemHealth />
        <ActivityFeed />
      </div>
    </div>
  );
}
