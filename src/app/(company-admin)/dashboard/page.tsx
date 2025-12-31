/**
 * C5: Company Admin Dashboard - Server Component
 *
 * This page fetches all dashboard data server-side using React.cache()
 * for request-level deduplication, then passes it to client components.
 * This eliminates:
 * - Client-side waterfalls (5 parallel SWR fetches)
 * - Loading states (data is available on first render)
 * - HTTP overhead (direct database access)
 */
import {
  WelcomeHeader,
  MetricsGrid,
  AgentsOverview,
  RecentConversations,
  QuickActions,
  UsageOverview,
  ActivityFeed,
  PageTitleSetter,
} from "@/components/company-admin/dashboard";
import { requireCompanyAdmin } from "@/lib/auth/guards";
import { cachedGetCompanyDashboardData } from "@/lib/data/company-dashboard";

export default async function CompanyAdminDashboard() {
  // Auth check + get company context
  const { company } = await requireCompanyAdmin();

  // Fetch all dashboard data in parallel, server-side
  const { stats, agents, conversations, activities, usage } =
    await cachedGetCompanyDashboardData(company.id);

  return (
    <div className="space-y-6 p-6">
      {/* C5: Client wrapper for page title */}
      <PageTitleSetter title="Dashboard" />

      {/* Welcome Header */}
      <WelcomeHeader companyName={company.name} />

      {/* Key Metrics - no loading state, data is pre-fetched */}
      <MetricsGrid stats={stats} />

      {/* Agents Overview */}
      <AgentsOverview agents={agents} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <RecentConversations conversations={conversations} />

        {/* Quick Actions + Usage */}
        <div className="space-y-6">
          <QuickActions />
          <UsageOverview planName={usage.planName} usage={usage.usage} />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={activities} />
    </div>
  );
}
