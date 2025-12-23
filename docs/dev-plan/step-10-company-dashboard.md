# Step 10: Company Admin - Dashboard

## Objective
Implement the Company Admin dashboard with company-specific metrics, agent overview, recent activity, and quick actions.

---

## Prerequisites
- Steps 01-09 completed
- Company Admin layout created
- User belongs to a company with company_admin role

---

## Reference Documents
- [UI: Company Admin Dashboard](../ui/company-admin/01-dashboard.md)

---

## Tasks

### 10.1 Create Dashboard Route

**Route:** `src/app/(company-admin)/dashboard/page.tsx`

- Server component with initial data fetch
- Company-scoped queries (multi-tenant isolation)
- Loading states with skeletons

### 10.2 Implement Welcome Header

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Welcome back, John! 👋                                                          │
│ Here's what's happening with your support today.                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Personalized greeting with user name
- Time-based greeting (Good morning/afternoon/evening)
- Summary text

### 10.3 Implement Key Metrics Cards

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Active      │ │ AI          │ │ Human       │ │ Avg         │
│ Conversations│ │ Resolution  │ │ Escalations │ │ Response    │
│     23      │ │    85%      │ │     4       │ │   1.2 min   │
│   ↑ 5%      │ │   ↑ 3%      │ │   ↓ 12%     │ │   ↓ 8%      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Metrics:**
- Active Conversations (live count)
- AI Resolution Rate (% handled by AI)
- Human Escalations (today)
- Average Response Time

**Data Source:** Aggregate from conversations, messages tables for current company.

### 10.4 Implement Agents Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Your Agents                                                    [Manage Agents →]│
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐              │
│ │                   │ │                   │ │                   │              │
│ │  [🤖 Avatar]      │ │  [🤖 Avatar]      │ │  [+ Create]       │              │
│ │                   │ │                   │ │                   │              │
│ │  Support Bot      │ │  Sales Assistant  │ │  New Agent        │              │
│ │  ● Active         │ │  ● Active         │ │                   │              │
│ │                   │ │                   │ │                   │              │
│ │  Today:           │ │  Today:           │ │                   │              │
│ │  156 conversations│ │  43 conversations │ │                   │              │
│ │  92% AI resolved  │ │  78% AI resolved  │ │                   │              │
│ │                   │ │                   │ │                   │              │
│ └───────────────────┘ └───────────────────┘ └───────────────────┘              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Agent Card Info:**
- Avatar and name
- Status (Active/Paused/Draft)
- Today's conversation count
- AI resolution rate

### 10.5 Implement Conversations Chart

**Line/Area chart showing:**
- Conversation volume over last 7/30 days
- Breakdown: AI handled vs Human handled
- Interactive tooltips

**Controls:**
- Date range toggle (7d/30d)
- Toggle series visibility

### 10.6 Implement Recent Conversations

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Recent Conversations                                         [View All →]       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ [Avatar] John Customer        Support Bot   5m ago    ● Active     [→]         │
│          "How do I reset my password?"                                          │
│                                                                                 │
│ [Avatar] Jane Prospect        Sales Bot     12m ago   ✓ Resolved   [→]         │
│          "What's included in the Pro plan?"                                     │
│                                                                                 │
│ [Avatar] Bob User             Support Bot   25m ago   🧑 Escalated [→]         │
│          "I need help with API integration"                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Display:**
- Customer avatar and name
- Agent that handled
- Time ago
- Status badge
- Message preview
- Link to conversation

### 10.7 Implement Quick Actions

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Quick Actions                                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ [+ Create Agent]  [📚 Add Knowledge]  [🎨 Customize Widget]  [👥 Invite Team]   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Actions:**
- Create Agent → Navigate to agent editor
- Add Knowledge → Navigate to knowledge base
- Customize Widget → Navigate to widget customizer
- Invite Team → Open invite modal

### 10.8 Implement Usage Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Usage This Month                                    Plan: Professional          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Messages          Conversations       Storage            API Calls              │
│ 12,456 / 50,000   1,234 / 10,000      2.3 GB / 10 GB    5,678 / 100,000        │
│ [████████░░░]     [████░░░░░░░]       [██░░░░░░░░░]     [█████░░░░░░]          │
│ 25%               12%                 23%               6%                      │
│                                                                                 │
│                                                          [View Details →]       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Show:**
- Current plan name
- Usage bars for each limit
- Percentage used
- Link to billing/usage details

### 10.9 Implement Activity Feed

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Recent Activity                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ● Sarah added new knowledge source "FAQ Guide"             10 minutes ago       │
│ ● Support Bot resolved 5 conversations                     30 minutes ago       │
│ ● John updated Sales Assistant system prompt               2 hours ago          │
│ ● New team member Mike joined                              5 hours ago          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Activity Types:**
- Knowledge changes
- Agent updates
- Team changes
- Conversation milestones

### 10.10 Create Dashboard API Routes

**`src/app/api/company/dashboard/stats/route.ts`:**
- GET: Dashboard metrics for company
- Requires company_admin or support_agent role
- Filters by company_id

**`src/app/api/company/dashboard/agents/route.ts`:**
- GET: Agent overview with today's stats

**`src/app/api/company/dashboard/conversations/route.ts`:**
- GET: Recent conversations list

**`src/app/api/company/dashboard/activity/route.ts`:**
- GET: Recent activity feed

**`src/app/api/company/dashboard/usage/route.ts`:**
- GET: Current usage vs plan limits

### 10.11 Implement Company Context Provider

**`src/lib/company/context.tsx`:**

```typescript
interface CompanyContext {
  company: Company;
  subscription: Subscription;
  limits: PlanLimits;
  usage: CurrentUsage;
}

export function CompanyProvider({ children }: { children: React.ReactNode });
export function useCompany(): CompanyContext;
```

- Fetch company data on mount
- Cache in context
- Refresh on demand

### 10.12 Create Dashboard Components

**`src/components/company-admin/dashboard/welcome-header.tsx`:**
- Personalized greeting
- Time-based message

**`src/components/company-admin/dashboard/metrics-grid.tsx`:**
- Grid of stat cards
- Animated number counting

**`src/components/company-admin/dashboard/agents-overview.tsx`:**
- Agent cards with stats
- Create agent card

**`src/components/company-admin/dashboard/conversations-chart.tsx`:**
- Line chart with date range
- Series toggle

**`src/components/company-admin/dashboard/recent-conversations.tsx`:**
- Conversation list
- Status badges
- Click to navigate

**`src/components/company-admin/dashboard/quick-actions.tsx`:**
- Action buttons
- Navigation/modal triggers

**`src/components/company-admin/dashboard/usage-overview.tsx`:**
- Usage progress bars
- Plan info

**`src/components/company-admin/dashboard/activity-feed.tsx`:**
- Activity timeline
- Load more

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Welcome back, John! 👋                                           │
│             │                                                                   │
│             │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│             │  │ Active  │ │ AI Res  │ │ Human   │ │ Avg Resp│                 │
│             │  │   23    │ │   85%   │ │    4    │ │  1.2m   │                 │
│             │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                 │
│             │                                                                   │
│             │  ┌────────────────────────────────────────────────────────────┐  │
│             │  │  Your Agents                                               │  │
│             │  │  [Agent 1] [Agent 2] [+ Create]                            │  │
│             │  └────────────────────────────────────────────────────────────┘  │
│             │                                                                   │
│             │  ┌─────────────────────────────┐ ┌────────────────────────────┐  │
│             │  │  Conversations Chart        │ │  Recent Conversations      │  │
│             │  │                             │ │                            │  │
│             │  └─────────────────────────────┘ └────────────────────────────┘  │
│             │                                                                   │
│             │  ┌─────────────────────────────┐ ┌────────────────────────────┐  │
│             │  │  Quick Actions              │ │  Usage Overview            │  │
│             │  │                             │ │                            │  │
│             │  └─────────────────────────────┘ └────────────────────────────┘  │
│             │                                                                   │
│             │  ┌────────────────────────────────────────────────────────────┐  │
│             │  │  Recent Activity                                           │  │
│             │  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Dashboard Stats
```typescript
interface DashboardStats {
  activeConversations: number;
  activeConversationsChange: number;
  aiResolutionRate: number;
  aiResolutionChange: number;
  humanEscalations: number;
  humanEscalationsChange: number;
  avgResponseTime: number;
  avgResponseTimeChange: number;
}
```

### Agent Overview
```typescript
interface AgentOverview {
  id: string;
  name: string;
  avatarUrl: string;
  status: 'active' | 'paused' | 'draft';
  todayConversations: number;
  aiResolutionRate: number;
}
```

---

## Validation Checklist

- [ ] Dashboard loads with company data
- [ ] Metrics display correct values
- [ ] Agents overview shows all agents
- [ ] Chart renders correctly
- [ ] Recent conversations load
- [ ] Quick actions navigate correctly
- [ ] Usage bars reflect actual usage
- [ ] Activity feed updates
- [ ] Multi-tenant isolation works

---

## File Structure

```
src/
├── app/
│   ├── (company-admin)/
│   │   └── dashboard/
│   │       └── page.tsx
│   │
│   └── api/
│       └── company/
│           └── dashboard/
│               ├── stats/
│               │   └── route.ts
│               ├── agents/
│               │   └── route.ts
│               ├── conversations/
│               │   └── route.ts
│               ├── activity/
│               │   └── route.ts
│               └── usage/
│                   └── route.ts
│
├── components/
│   └── company-admin/
│       └── dashboard/
│           ├── welcome-header.tsx
│           ├── metrics-grid.tsx
│           ├── agents-overview.tsx
│           ├── conversations-chart.tsx
│           ├── recent-conversations.tsx
│           ├── quick-actions.tsx
│           ├── usage-overview.tsx
│           └── activity-feed.tsx
│
└── lib/
    └── company/
        └── context.tsx
```

---

## Next Step
[Step 11 - Agent Management](./step-11-agent-management.md)

---

## Related Documentation
- [UI: Company Admin Dashboard](../ui/company-admin/01-dashboard.md)
- [Architecture Overview](../architecture-overview.md)
