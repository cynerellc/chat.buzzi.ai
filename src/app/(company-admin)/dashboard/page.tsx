"use client";

import {
  WelcomeHeader,
  MetricsGrid,
  AgentsOverview,
  RecentConversations,
  QuickActions,
  UsageOverview,
  ActivityFeed,
} from "@/components/company-admin/dashboard";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  useDashboardStats,
  useAgentsOverview,
  useRecentConversations,
  useActivityFeed,
  useUsageOverview,
} from "@/hooks/company";

export default function CompanyAdminDashboard() {
  useSetPageTitle("Dashboard");
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { agents, isLoading: agentsLoading } = useAgentsOverview();
  const { conversations, isLoading: conversationsLoading } =
    useRecentConversations(5);
  const { activities, isLoading: activitiesLoading } = useActivityFeed(10);
  const { planName, usage, isLoading: usageLoading } = useUsageOverview();

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <WelcomeHeader />

      {/* Key Metrics */}
      <MetricsGrid stats={stats} isLoading={statsLoading} />

      {/* Agents Overview */}
      <AgentsOverview agents={agents} isLoading={agentsLoading} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <RecentConversations
          conversations={conversations}
          isLoading={conversationsLoading}
        />

        {/* Quick Actions + Usage */}
        <div className="space-y-6">
          <QuickActions />
          <UsageOverview
            planName={planName}
            usage={usage}
            isLoading={usageLoading}
          />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={activities} isLoading={activitiesLoading} />
    </div>
  );
}
