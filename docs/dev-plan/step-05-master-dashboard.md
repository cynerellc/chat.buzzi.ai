# Step 05: Master Admin Dashboard

## Objective
Implement the Master Admin dashboard with platform-wide metrics, company overview, quick actions, and system health monitoring.

---

## Prerequisites
- Steps 01-04 completed
- Master admin layout created
- Database schema implemented

---

## Reference Documents
- [UI: Master Admin Dashboard](../ui/master-admin/01-dashboard.md)

---

## Tasks

### 5.1 Create Dashboard Route

**Route:** `src/app/(master-admin)/dashboard/page.tsx`

- Server component for initial data fetch
- Pass data to client components for interactivity
- Implement proper loading states

### 5.2 Implement Key Metrics Cards

Create a row of stat cards displaying:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Total       │ │ Active      │ │ Total       │ │ Monthly     │
│ Companies   │ │ Companies   │ │ Users       │ │ Revenue     │
│    156      │ │    142      │ │   2,847     │ │  $45,230    │
│  ↑ 12%      │ │  ↑ 8%       │ │  ↑ 23%      │ │  ↑ 15%      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Metrics to display:**
- Total Companies (with growth %)
- Active Companies (subscribed)
- Total Users across all companies
- Monthly Recurring Revenue (MRR)

**Data Source:** Aggregate from companies, users, and subscriptions tables.

### 5.3 Implement Companies Activity Chart

**Line chart showing:**
- New signups over time (30 days)
- Active companies trend
- Churned companies

**Features:**
- Date range selector (7d, 30d, 90d)
- Hover tooltips
- Legend

### 5.4 Implement Recent Companies List

```
┌─────────────────────────────────────────────────────────────────────┐
│ Recent Companies                                     [View All →]   │
├─────────────────────────────────────────────────────────────────────┤
│ [Logo] Acme Corp        Pro Plan    12 users    Jan 15   [→]       │
│ [Logo] TechStart        Starter     3 users     Jan 14   [→]       │
│ [Logo] BigCo            Enterprise  45 users    Jan 13   [→]       │
└─────────────────────────────────────────────────────────────────────┘
```

**Display:**
- Company logo/avatar
- Company name
- Subscription plan
- User count
- Signup date
- Link to company details

### 5.5 Implement Plan Distribution Chart

**Donut chart showing:**
- Breakdown by subscription plan
- Free, Starter, Professional, Enterprise
- Percentage and count for each

### 5.6 Implement Quick Actions

```
┌─────────────────────────────────────────────────────────────────────┐
│ Quick Actions                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ [+ Add Company]  [📦 Manage Plans]  [👤 Impersonate]  [⚙️ Settings] │
└─────────────────────────────────────────────────────────────────────┘
```

**Actions:**
- Add Company → Opens create company modal
- Manage Plans → Navigate to subscription plans
- Impersonate → Opens impersonation modal
- Settings → Navigate to system settings

### 5.7 Implement System Health Widget

```
┌─────────────────────────────────────────────────────────────────────┐
│ System Health                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ API Status        ● Operational                                     │
│ Database          ● Operational                                     │
│ AI Provider       ● Operational                                     │
│ Queue Workers     ● Operational                                     │
│                                                                     │
│ Last checked: 2 minutes ago                  [View Full Status →]   │
└─────────────────────────────────────────────────────────────────────┘
```

**Status indicators:**
- Green: Operational
- Yellow: Degraded
- Red: Down

### 5.8 Implement Recent Activity Feed

```
┌─────────────────────────────────────────────────────────────────────┐
│ Recent Activity                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ● New company registered: TechStart           5 minutes ago         │
│ ● Subscription upgraded: Acme Corp → Pro      1 hour ago            │
│ ● New user joined: john@acme.com              2 hours ago           │
│ ● Company deactivated: OldCo                  1 day ago             │
└─────────────────────────────────────────────────────────────────────┘
```

**Activity types:**
- Company created/deactivated
- Subscription changes
- User registrations
- System events

### 5.9 Create Dashboard API Routes

**`src/app/api/master-admin/dashboard/stats/route.ts`:**
- GET: Fetch dashboard statistics
- Aggregate counts from database
- Calculate growth percentages

**`src/app/api/master-admin/dashboard/activity/route.ts`:**
- GET: Fetch recent activity
- From audit_logs table
- Paginated response

**`src/app/api/master-admin/dashboard/charts/route.ts`:**
- GET: Fetch chart data
- Time series data for charts
- Configurable date range

### 5.10 Implement Data Fetching Hooks

**`src/hooks/master-admin/useDashboardStats.ts`:**
- Fetch and cache dashboard stats
- Auto-refresh interval
- Loading and error states

**`src/hooks/master-admin/useRecentCompanies.ts`:**
- Fetch recent companies
- Pagination support

**`src/hooks/master-admin/useActivityFeed.ts`:**
- Fetch activity feed
- Real-time updates option

### 5.11 Create Dashboard Components

**`src/components/master-admin/dashboard/stats-grid.tsx`:**
- Grid of stat cards
- Responsive layout

**`src/components/master-admin/dashboard/companies-chart.tsx`:**
- Line chart component
- Date range controls

**`src/components/master-admin/dashboard/plan-distribution.tsx`:**
- Donut chart component
- Legend with percentages

**`src/components/master-admin/dashboard/recent-companies.tsx`:**
- Companies list component
- Row click navigation

**`src/components/master-admin/dashboard/quick-actions.tsx`:**
- Action buttons grid
- Modal triggers

**`src/components/master-admin/dashboard/system-health.tsx`:**
- Health status display
- Auto-refresh

**`src/components/master-admin/dashboard/activity-feed.tsx`:**
- Activity timeline
- Load more pagination

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Dashboard                                                        │
│             │                                                                   │
│             │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│             │  │Companies│ │ Active  │ │ Users   │ │ Revenue │                 │
│             │  │   156   │ │   142   │ │  2,847  │ │ $45,230 │                 │
│             │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                 │
│             │                                                                   │
│             │  ┌────────────────────────────┐ ┌─────────────────────────────┐  │
│             │  │                            │ │                             │  │
│             │  │  Companies Activity Chart  │ │  Plan Distribution          │  │
│             │  │                            │ │                             │  │
│             │  │                            │ │                             │  │
│             │  └────────────────────────────┘ └─────────────────────────────┘  │
│             │                                                                   │
│             │  ┌────────────────────────────┐ ┌─────────────────────────────┐  │
│             │  │                            │ │                             │  │
│             │  │  Recent Companies          │ │  Quick Actions              │  │
│             │  │                            │ │                             │  │
│             │  └────────────────────────────┘ └─────────────────────────────┘  │
│             │                                                                   │
│             │  ┌────────────────────────────┐ ┌─────────────────────────────┐  │
│             │  │                            │ │                             │  │
│             │  │  System Health             │ │  Recent Activity            │  │
│             │  │                            │ │                             │  │
│             │  └────────────────────────────┘ └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Dashboard Stats Response
```typescript
interface DashboardStats {
  totalCompanies: number;
  totalCompaniesGrowth: number;
  activeCompanies: number;
  activeCompaniesGrowth: number;
  totalUsers: number;
  totalUsersGrowth: number;
  monthlyRevenue: number;
  monthlyRevenueGrowth: number;
}
```

### Activity Item
```typescript
interface ActivityItem {
  id: string;
  type: 'company_created' | 'subscription_changed' | 'user_joined' | 'company_deactivated';
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
```

---

## Validation Checklist

- [ ] Dashboard loads with all widgets
- [ ] Stats cards show correct data
- [ ] Charts render properly
- [ ] Recent companies list works
- [ ] Quick actions function correctly
- [ ] System health updates
- [ ] Activity feed loads
- [ ] Responsive layout works
- [ ] Loading states display correctly

---

## File Structure

```
src/
├── app/
│   ├── (master-admin)/
│   │   └── dashboard/
│   │       └── page.tsx
│   │
│   └── api/
│       └── master-admin/
│           └── dashboard/
│               ├── stats/
│               │   └── route.ts
│               ├── activity/
│               │   └── route.ts
│               └── charts/
│                   └── route.ts
│
├── components/
│   └── master-admin/
│       └── dashboard/
│           ├── stats-grid.tsx
│           ├── companies-chart.tsx
│           ├── plan-distribution.tsx
│           ├── recent-companies.tsx
│           ├── quick-actions.tsx
│           ├── system-health.tsx
│           └── activity-feed.tsx
│
└── hooks/
    └── master-admin/
        ├── useDashboardStats.ts
        ├── useRecentCompanies.ts
        └── useActivityFeed.ts
```

---

## Next Step
[Step 06 - Company Management](./step-06-company-management.md)

---

## Related Documentation
- [UI: Master Admin Dashboard](../ui/master-admin/01-dashboard.md)
- [Architecture Overview](../architecture-overview.md)
