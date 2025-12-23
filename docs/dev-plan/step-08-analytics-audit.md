# Step 08: Master Admin - Platform Analytics & Audit Logs

## Objective
Implement platform-wide analytics dashboard and comprehensive audit logging system for the Master Admin portal.

---

## Prerequisites
- Step 07 completed
- Database schema with analytics and audit_logs tables
- Chart components created

---

## Reference Documents
- [UI: Platform Analytics](../ui/master-admin/05-platform-analytics.md)
- [UI: Audit Logs](../ui/master-admin/06-audit-logs.md)

---

## Tasks

### 8.1 Create Platform Analytics Page

**Route:** `src/app/(master-admin)/analytics/page.tsx`

**Features:**
- Platform-wide metrics
- Time period selection
- Interactive charts
- Export functionality

### 8.2 Implement Analytics Header

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Platform Analytics                                                              │
│                                                                                 │
│ [Today] [7 Days] [30 Days] [90 Days] [Custom Range]         [↓ Export Report]   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Preset date ranges
- Custom date picker
- Export to CSV/PDF

### 8.3 Implement Key Metrics Cards

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Total       │ │ Active      │ │ Total       │ │ AI          │ │ Human       │
│ Conversations│ │ Users       │ │ Messages    │ │ Resolution  │ │ Escalations │
│   45,678    │ │    892      │ │   234,567   │ │    87%      │ │    13%      │
│   ↑ 15%     │ │   ↑ 8%      │ │   ↑ 22%     │ │   ↑ 3%      │ │   ↓ 5%      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Metrics:**
- Total Conversations
- Active Users (daily)
- Total Messages
- AI Resolution Rate
- Human Escalation Rate

### 8.4 Implement Conversations Chart

**Line chart showing:**
- Daily conversation volume
- Breakdown by resolution type (AI vs Human)
- Trend line

**Features:**
- Hover tooltips
- Toggle series visibility
- Zoom on date range

### 8.5 Implement Usage by Company Chart

**Bar chart showing:**
- Top 10 companies by usage
- Messages, conversations, or API calls
- Sortable metric

### 8.6 Implement Platform Usage Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Usage Breakdown                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ By Channel                          By Agent Type                               │
│ ┌─────────────────────────┐        ┌─────────────────────────┐                 │
│ │                         │        │                         │                 │
│ │   [Donut Chart]         │        │   [Donut Chart]         │                 │
│ │                         │        │                         │                 │
│ │   Widget: 65%           │        │   Support: 45%          │                 │
│ │   WhatsApp: 20%         │        │   Sales: 35%            │                 │
│ │   Slack: 10%            │        │   FAQ: 15%              │                 │
│ │   Other: 5%             │        │   Custom: 5%            │                 │
│ │                         │        │                         │                 │
│ └─────────────────────────┘        └─────────────────────────┘                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.7 Implement AI Performance Metrics

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ AI Performance                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Tokens Used This Month                Average Response Time                     │
│ ┌─────────────────────────┐          ┌─────────────────────────┐               │
│ │ 12.5M / 50M             │          │ 1.2 seconds             │               │
│ │ [████████████░░░░░░░░]  │          │ [Line Chart Trend]      │               │
│ └─────────────────────────┘          └─────────────────────────┘               │
│                                                                                 │
│ Cost Breakdown (Estimated)           Model Usage                               │
│ ┌─────────────────────────┐          ┌─────────────────────────┐               │
│ │ Total: $1,234.56        │          │ GPT-4: 45%              │               │
│ │ GPT-4: $890.00          │          │ GPT-3.5: 40%            │               │
│ │ GPT-3.5: $344.56        │          │ Claude: 15%             │               │
│ └─────────────────────────┘          └─────────────────────────┘               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.8 Implement Growth Metrics

**Metrics:**
- New companies per period
- Company growth rate
- Churn rate
- Net revenue growth

### 8.9 Create Audit Logs Page

**Route:** `src/app/(master-admin)/audit-logs/page.tsx`

**Features:**
- Searchable log table
- Filter by type, user, date
- Export logs
- Log detail view

### 8.10 Implement Audit Logs Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Audit Logs                                                    [↓ Export Logs]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search logs...                                                               │
│                                                                                 │
│ [All Actions ▼] [All Users ▼] [All Companies ▼] [Date Range ▼]                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Timestamp          │ User           │ Action              │ Resource    │ Details│
├────────────────────┼────────────────┼─────────────────────┼─────────────┼────────┤
│ Jan 18, 2:30 PM    │ john@admin.com │ company.created     │ Acme Corp   │ [View] │
│ Jan 18, 2:15 PM    │ jane@admin.com │ plan.updated        │ Professional│ [View] │
│ Jan 18, 1:45 PM    │ john@admin.com │ user.impersonated   │ bob@acme... │ [View] │
│ Jan 18, 1:30 PM    │ system         │ subscription.renewed│ TechCo      │ [View] │
│ Jan 18, 12:00 PM   │ jane@admin.com │ agent.deleted       │ Support Bot │ [View] │
└────────────────────┴────────────────┴─────────────────────┴─────────────┴────────┘
│ Showing 1-50 of 1,234 logs                                [< 1 2 3 ... 25 >]    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Table Columns:**
- Timestamp
- User (who performed action)
- Action (what was done)
- Resource (what was affected)
- Details link

### 8.11 Implement Log Filters

**Filters:**
- Action type: company.*, user.*, agent.*, plan.*, system.*
- User: All users or specific user
- Company: All companies or specific company
- Date range: Preset or custom

### 8.12 Implement Log Detail Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Audit Log Details                                           [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Action: company.updated                                         │
│ Timestamp: January 18, 2024 at 2:30:45 PM                       │
│                                                                 │
│ Performed By                                                    │
│ ─────────────                                                   │
│ User: John Smith (john@admin.com)                               │
│ Role: Master Admin                                              │
│ IP Address: 192.168.1.100                                       │
│ User Agent: Chrome 120 on macOS                                 │
│                                                                 │
│ Resource                                                        │
│ ────────                                                        │
│ Type: Company                                                   │
│ ID: comp_abc123xyz                                              │
│ Name: Acme Corporation                                          │
│                                                                 │
│ Changes                                                         │
│ ───────                                                         │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Field          │ Before         │ After                 │    │
│ ├────────────────┼────────────────┼───────────────────────┤    │
│ │ name           │ Acme Corp      │ Acme Corporation      │    │
│ │ domain         │ null           │ acme.com              │    │
│ │ settings.theme │ light          │ dark                  │    │
│ └────────────────┴────────────────┴───────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                      [Close]    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.13 Implement Audit Logging Service

**`src/lib/audit/logger.ts`:**

```typescript
// Log creation utility
export async function createAuditLog(params: {
  userId?: string;
  companyId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void>
```

**Action types to log:**
- `company.created`, `company.updated`, `company.deleted`, `company.suspended`
- `user.created`, `user.updated`, `user.deleted`, `user.impersonated`
- `agent.created`, `agent.updated`, `agent.deleted`
- `plan.created`, `plan.updated`
- `package.created`, `package.updated`
- `settings.updated`
- `subscription.changed`, `subscription.renewed`, `subscription.cancelled`

### 8.14 Create Analytics API Routes

**`src/app/api/master-admin/analytics/overview/route.ts`:**
- GET: Platform overview metrics

**`src/app/api/master-admin/analytics/conversations/route.ts`:**
- GET: Conversation analytics with date range

**`src/app/api/master-admin/analytics/usage/route.ts`:**
- GET: Usage breakdown data

**`src/app/api/master-admin/analytics/ai/route.ts`:**
- GET: AI performance metrics

**`src/app/api/master-admin/analytics/export/route.ts`:**
- POST: Generate export file

### 8.15 Create Audit Logs API Routes

**`src/app/api/master-admin/audit-logs/route.ts`:**
- GET: List audit logs with filters, pagination

**`src/app/api/master-admin/audit-logs/[logId]/route.ts`:**
- GET: Get log details

**`src/app/api/master-admin/audit-logs/export/route.ts`:**
- POST: Export audit logs

---

## Data Models

### Analytics Overview
```typescript
interface AnalyticsOverview {
  totalConversations: number;
  conversationsGrowth: number;
  activeUsers: number;
  activeUsersGrowth: number;
  totalMessages: number;
  messagesGrowth: number;
  aiResolutionRate: number;
  aiResolutionGrowth: number;
  humanEscalationRate: number;
  humanEscalationGrowth: number;
}
```

### Audit Log Entry
```typescript
interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyName: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

---

## Validation Checklist

- [ ] Analytics page loads with data
- [ ] Date range filters work
- [ ] All charts render correctly
- [ ] Charts update on filter change
- [ ] Export generates correct file
- [ ] Audit logs page loads
- [ ] Log filters work
- [ ] Log detail modal shows data
- [ ] Audit logging captures actions
- [ ] Old/new values recorded correctly

---

## File Structure

```
src/
├── app/
│   ├── (master-admin)/
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   └── audit-logs/
│   │       └── page.tsx
│   │
│   └── api/
│       └── master-admin/
│           ├── analytics/
│           │   ├── overview/
│           │   │   └── route.ts
│           │   ├── conversations/
│           │   │   └── route.ts
│           │   ├── usage/
│           │   │   └── route.ts
│           │   ├── ai/
│           │   │   └── route.ts
│           │   └── export/
│           │       └── route.ts
│           └── audit-logs/
│               ├── route.ts
│               ├── [logId]/
│               │   └── route.ts
│               └── export/
│                   └── route.ts
│
├── components/
│   └── master-admin/
│       ├── analytics/
│       │   ├── analytics-header.tsx
│       │   ├── metrics-grid.tsx
│       │   ├── conversations-chart.tsx
│       │   ├── usage-by-company.tsx
│       │   ├── usage-breakdown.tsx
│       │   ├── ai-performance.tsx
│       │   └── growth-metrics.tsx
│       └── audit-logs/
│           ├── audit-logs-table.tsx
│           ├── audit-logs-filters.tsx
│           └── log-detail-modal.tsx
│
├── lib/
│   └── audit/
│       └── logger.ts
│
└── hooks/
    └── master-admin/
        ├── useAnalytics.ts
        └── useAuditLogs.ts
```

---

## Next Step
[Step 09 - System Settings](./step-09-system-settings.md)

---

## Related Documentation
- [UI: Platform Analytics](../ui/master-admin/05-platform-analytics.md)
- [UI: Audit Logs](../ui/master-admin/06-audit-logs.md)
