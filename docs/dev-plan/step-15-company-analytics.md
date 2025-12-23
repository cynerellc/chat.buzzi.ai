# Step 15: Company Admin - Analytics

## Objective
Implement comprehensive analytics dashboard with conversation metrics, agent performance, team statistics, and customer satisfaction tracking.

---

## Prerequisites
- Step 14 completed
- Conversations and messages data available
- Charting library configured (Recharts or similar)

---

## Reference Documents
- [UI: Company Analytics](../ui/company-admin/10-analytics.md)

---

## Tasks

### 15.1 Create Analytics Page

**Route:** `src/app/(company-admin)/analytics/page.tsx`

**Features:**
- Date range selector
- Tab-based navigation
- Export functionality
- Comparison mode

### 15.2 Implement Date Range Selector

```
┌──────────────────────────────────────────────────────────────┐
│ Date Range: [Last 30 days ▼]        Compare: [None ▼]        │
└──────────────────────────────────────────────────────────────┘
```

**Presets:**
- Last 7 days
- Last 30 days
- Last 90 days
- This month
- Last month
- Custom range

### 15.3 Implement Overview Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Key Metrics                                                        │
│  ───────────                                                        │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Total       │ │ AI          │ │ Human       │ │ Satisfaction│   │
│  │ Conversations│ │ Resolution │ │ Escalations │ │ Score       │   │
│  │             │ │ Rate        │ │             │ │             │   │
│  │   2,456     │ │    91%      │ │    234      │ │   4.7/5.0   │   │
│  │  ↑ 15%      │ │   ↑ 3%      │ │   ↓ 12%    │ │   ↑ 0.2     │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  Conversation Volume Chart                                          │
│  ─────────────────────────                                          │
│  [Area Chart: AI Resolved vs Escalated vs Abandoned]               │
│                                                                     │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│  │  Resolution Breakdown       │ │  Response Time              │   │
│  │  [Donut Chart]              │ │  [Progress Bars]            │   │
│  └─────────────────────────────┘ └─────────────────────────────┘   │
│                                                                     │
│  Popular Topics Table                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.4 Implement Conversations Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Conversation Analytics                                             │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Total       │ │ Avg         │ │ Avg Messages│ │ Peak Hour   │   │
│  │ Conversations│ │ Duration   │ │ per Conv    │ │             │   │
│  │   2,456     │ │   4.5 min   │ │     8       │ │  2-3 PM     │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  [Bar Chart: Daily Volume]                                          │
│                                                                     │
│  [Heatmap: Hour x Day of Week]                                      │
│                                                                     │
│  By Channel                        By Status                        │
│  [Pie Chart]                       [Pie Chart]                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.5 Implement Agents Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  AI Agent Performance                                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Agent           Conversations  Resolution  Avg Time  Score │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  [🤖] Sales Bot       1,234        94%       1.2s     4.8   │   │
│  │  [🤖] Support Bot       987        91%       1.5s     4.6   │   │
│  │  [🤖] FAQ Bot           235        88%       0.8s     4.5   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Line Chart: Resolution Rate by Agent Over Time]                   │
│                                                                     │
│  Knowledge Usage Table                                              │
│  Escalation Reasons Table                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.6 Implement Team Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Team Performance                                                   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Active      │ │ Total       │ │ Avg Response│ │ Avg Handle  │   │
│  │ Agents      │ │ Handled     │ │ Time        │ │ Time        │   │
│  │     8       │ │    234      │ │    45s      │ │   12 min    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  Agent Leaderboard                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Agent        Handled  Resp Time  Handle Time  Rating       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  1. Jane D.      78      32s        10 min     4.9 ⭐       │   │
│  │  2. Bob W.       65      45s        12 min     4.7 ⭐       │   │
│  │  3. Alice C.     56      38s        11 min     4.8 ⭐       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Stacked Bar: Online Hours by Agent]                               │
│                                                                     │
│  Queue Metrics                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.7 Implement Satisfaction Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Customer Satisfaction                                              │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Overall     │ │ Response    │ │ CSAT        │ │ NPS         │   │
│  │ Score       │ │ Rate        │ │ Score       │ │             │   │
│  │  4.7/5.0    │ │    23%      │ │    89%      │ │    +42      │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  Rating Distribution                                                │
│  5 stars  ████████████████████████████████████████  78%            │
│  4 stars  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14%            │
│  3 stars  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   5%            │
│  2 stars  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   2%            │
│  1 star   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   1%            │
│                                                                     │
│  [Line Chart: CSAT Over Time]                                       │
│                                                                     │
│  Recent Feedback                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⭐⭐⭐⭐⭐  "Very helpful and quick response!"              │   │
│  │  John D. • Sales Bot • 2 hours ago                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.8 Implement Export Modal

```
┌─────────────────────────────────────────┐
│  Export Analytics                   [×] │
├─────────────────────────────────────────┤
│                                         │
│  Date Range                             │
│  [Jan 1, 2024] to [Jan 31, 2024]       │
│                                         │
│  Reports to Include                     │
│  ☑ Overview metrics                     │
│  ☑ Conversation analytics               │
│  ☑ Agent performance                    │
│  ☑ Team performance                     │
│  ☑ Satisfaction scores                  │
│                                         │
│  Format                                 │
│  ○ PDF Report                           │
│  ● Excel (multiple sheets)              │
│  ○ CSV (separate files)                 │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel]  [Export]         │
└─────────────────────────────────────────┘
```

### 15.9 Create Analytics API Routes

**`src/app/api/company/analytics/overview/route.ts`:**
- GET: Overview metrics with trends

**`src/app/api/company/analytics/conversations/route.ts`:**
- GET: Conversation analytics data

**`src/app/api/company/analytics/agents/route.ts`:**
- GET: AI agent performance data

**`src/app/api/company/analytics/team/route.ts`:**
- GET: Team member performance data

**`src/app/api/company/analytics/satisfaction/route.ts`:**
- GET: Customer satisfaction data

**`src/app/api/company/analytics/export/route.ts`:**
- POST: Generate export file

### 15.10 Create Analytics Components

**`src/components/company-admin/analytics/date-range-picker.tsx`:**
- Date range selection
- Preset options
- Custom range picker

**`src/components/company-admin/analytics/metrics-cards.tsx`:**
- Stat card grid
- Trend indicators
- Animated values

**`src/components/company-admin/analytics/conversation-chart.tsx`:**
- Area/line chart
- Series toggles
- Tooltips

**`src/components/company-admin/analytics/heatmap.tsx`:**
- Hour x Day heatmap
- Color scale
- Tooltips

**`src/components/company-admin/analytics/agent-table.tsx`:**
- Agent performance rows
- Sortable columns
- Click to expand

**`src/components/company-admin/analytics/leaderboard.tsx`:**
- Ranked team members
- Performance metrics
- Rating display

**`src/components/company-admin/analytics/satisfaction-chart.tsx`:**
- Rating distribution
- CSAT trend line
- Feedback cards

**`src/components/company-admin/analytics/export-modal.tsx`:**
- Date range selection
- Report checkboxes
- Format selection

---

## Data Models

### Analytics Overview
```typescript
interface AnalyticsOverview {
  totalConversations: number;
  conversationsChange: number;
  aiResolutionRate: number;
  aiResolutionChange: number;
  humanEscalations: number;
  humanEscalationsChange: number;
  satisfactionScore: number;
  satisfactionChange: number;
  conversationVolume: {
    date: string;
    aiResolved: number;
    escalated: number;
    abandoned: number;
  }[];
  resolutionBreakdown: {
    aiResolved: number;
    humanResolved: number;
    abandoned: number;
  };
  responseTime: {
    firstResponse: number;
    firstResponseTarget: number;
    resolution: number;
    resolutionTarget: number;
  };
  popularTopics: {
    topic: string;
    count: number;
    trend: number;
  }[];
}
```

### Conversation Analytics
```typescript
interface ConversationAnalytics {
  total: number;
  avgDuration: number;
  avgMessages: number;
  peakHour: string;
  dailyVolume: {
    date: string;
    count: number;
  }[];
  heatmap: {
    hour: number;
    day: number;
    value: number;
  }[];
  byChannel: {
    channel: string;
    percentage: number;
  }[];
  byStatus: {
    status: string;
    percentage: number;
  }[];
}
```

### Agent Analytics
```typescript
interface AgentAnalytics {
  agents: {
    id: string;
    name: string;
    avatarUrl: string;
    conversations: number;
    resolutionRate: number;
    avgResponseTime: number;
    satisfactionScore: number;
  }[];
  performanceOverTime: {
    date: string;
    [agentId: string]: number;
  }[];
  knowledgeUsage: {
    category: string;
    timesUsed: number;
    helpfulness: number;
  }[];
  escalationReasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
}
```

### Team Analytics
```typescript
interface TeamAnalytics {
  activeAgents: number;
  totalHandled: number;
  avgResponseTime: number;
  avgHandleTime: number;
  leaderboard: {
    rank: number;
    name: string;
    avatarUrl: string;
    handled: number;
    responseTime: number;
    handleTime: number;
    rating: number;
  }[];
  availability: {
    name: string;
    hours: number[];
  }[];
  queueMetrics: {
    avgWaitTime: number;
    maxWaitTime: number;
    abandonedInQueue: number;
    abandonedPercentage: number;
  };
}
```

### Satisfaction Analytics
```typescript
interface SatisfactionAnalytics {
  overallScore: number;
  overallChange: number;
  responseRate: number;
  responseRateChange: number;
  csatScore: number;
  csatChange: number;
  nps: number;
  npsChange: number;
  ratingDistribution: {
    stars: number;
    percentage: number;
  }[];
  satisfactionTrend: {
    date: string;
    score: number;
  }[];
  recentFeedback: {
    rating: number;
    comment: string;
    customerName: string;
    agentName: string;
    timestamp: Date;
  }[];
}
```

---

## Validation Checklist

- [ ] Date range picker works correctly
- [ ] Overview metrics load with trends
- [ ] Conversation charts render
- [ ] Heatmap displays properly
- [ ] Agent table is sortable
- [ ] Team leaderboard updates
- [ ] Satisfaction ratings show
- [ ] Export generates files
- [ ] Mobile responsive

---

## File Structure

```
src/
├── app/
│   ├── (company-admin)/
│   │   └── analytics/
│   │       └── page.tsx
│   │
│   └── api/
│       └── company/
│           └── analytics/
│               ├── overview/
│               │   └── route.ts
│               ├── conversations/
│               │   └── route.ts
│               ├── agents/
│               │   └── route.ts
│               ├── team/
│               │   └── route.ts
│               ├── satisfaction/
│               │   └── route.ts
│               └── export/
│                   └── route.ts
│
└── components/
    └── company-admin/
        └── analytics/
            ├── date-range-picker.tsx
            ├── metrics-cards.tsx
            ├── conversation-chart.tsx
            ├── heatmap.tsx
            ├── agent-table.tsx
            ├── leaderboard.tsx
            ├── satisfaction-chart.tsx
            └── export-modal.tsx
```

---

## Next Step
[Step 16 - Widget Customizer](./step-16-widget-customizer.md)

---

## Related Documentation
- [UI: Company Analytics](../ui/company-admin/10-analytics.md)
- [Architecture Overview](../architecture-overview.md)
