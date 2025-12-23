# Master Admin Dashboard

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/admin/dashboard` |
| Access | Master Admin only |
| Purpose | Platform-wide overview and quick actions |
| Mobile Support | Responsive (limited functionality) |

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Chat.buzzi.ai              [Search...]        [?] [🔔 3] [MA ▼]         │
├────────────────┬────────────────────────────────────────────────────────────────┤
│                │                                                                │
│  MAIN MENU     │  Dashboard                                          [Refresh] │
│  ─────────     │                                                                │
│  ● Dashboard   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐│
│  ○ Companies   │  │ Total       │ │ Active      │ │ Messages    │ │ Revenue   ││
│  ○ Plans       │  │ Companies   │ │ Users       │ │ Today       │ │ (MTD)     ││
│  ○ Analytics   │  │             │ │             │ │             │ │           ││
│                │  │    156      │ │   1,234     │ │  45.2K      │ │  $23.4K   ││
│  SYSTEM        │  │  ↑ 12%     │ │  ↑ 8%      │ │  ↑ 15%     │ │  ↑ 22%   ││
│  ──────        │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘│
│  ○ Audit Logs  │                                                                │
│  ○ Settings    │  ┌────────────────────────────────────────────────────────────┐│
│                │  │  Platform Activity (Last 30 Days)                         ││
│                │  │  ┌────────────────────────────────────────────────────┐   ││
│                │  │  │                                                    │   ││
│                │  │  │     📈 [Messages & Conversations Chart]            │   ││
│                │  │  │                                                    │   ││
│                │  │  │                                                    │   ││
│                │  │  └────────────────────────────────────────────────────┘   ││
│                │  │  [Messages ●] [Conversations ●] [Escalations ●]           ││
│                │  └────────────────────────────────────────────────────────────┘│
│                │                                                                │
│                │  ┌─────────────────────────────┐ ┌────────────────────────────┐│
│                │  │  Recent Companies           │ │  System Health             ││
│                │  │                             │ │                            ││
│                │  │  [Logo] Acme Corp    Pro    │ │  API          ● Healthy    ││
│                │  │          2 min ago          │ │  Database     ● Healthy    ││
│                │  │                             │ │  Queue        ● Healthy    ││
│                │  │  [Logo] TechStart   Starter │ │  AI Services  ● Healthy    ││
│                │  │          15 min ago         │ │  Storage      ⚠ Warning   ││
│                │  │                             │ │                            ││
│                │  │  [Logo] BigCorp     Enter.  │ │  ────────────────────────  ││
│                │  │          1 hour ago         │ │  Uptime: 99.97%            ││
│                │  │                             │ │  Last incident: 14 days    ││
│                │  │  [View All Companies →]     │ │  [View Status Page →]      ││
│                │  └─────────────────────────────┘ └────────────────────────────┘│
│                │                                                                │
│                │  ┌─────────────────────────────┐ ┌────────────────────────────┐│
│                │  │  Subscription Distribution  │ │  Quick Actions             ││
│                │  │                             │ │                            ││
│                │  │      [Pie Chart]            │ │  [+ Add Company]           ││
│                │  │                             │ │  [📧 Send Announcement]    ││
│                │  │  ● Starter    45 (29%)      │ │  [📊 Generate Report]      ││
│                │  │  ● Pro        78 (50%)      │ │  [⚙️ System Settings]      ││
│                │  │  ● Enterprise 33 (21%)      │ │                            ││
│                │  └─────────────────────────────┘ └────────────────────────────┘│
│                │                                                                │
└────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## Key Metrics Cards

### Card Structure

| Metric | Value | Comparison | Trend |
|--------|-------|------------|-------|
| Total Companies | Count | vs. last month | % change |
| Active Users | Count | vs. last month | % change |
| Messages Today | Count | vs. yesterday | % change |
| Revenue (MTD) | Currency | vs. last month | % change |

### Card Interactions
- **Click** - Navigate to detailed analytics for that metric
- **Hover** - Show tooltip with exact values and period

### Trend Indicators
- **Green arrow up** - Positive trend
- **Red arrow down** - Negative trend (except for churn)
- **Gray dash** - No change

---

## Platform Activity Chart

### Chart Type
Area chart with multiple series

### Data Series
| Series | Color | Description |
|--------|-------|-------------|
| Messages | Blue (#0066FF) | Total messages processed |
| Conversations | Green (#22C55E) | Unique conversations |
| Escalations | Orange (#F59E0B) | Human escalations |

### Interactions
- **Hover** - Show tooltip with exact values for that date
- **Click legend** - Toggle series visibility
- **Drag** - Select date range for zoom

### Time Range Options
- Last 7 days
- Last 30 days (default)
- Last 90 days
- Custom range

---

## Recent Companies Widget

### List Item Structure
```
┌────────────────────────────────────────┐
│  [Logo]  Company Name         [Badge]  │
│          Joined: X time ago            │
└────────────────────────────────────────┘
```

### Badge Types
| Plan | Color | Label |
|------|-------|-------|
| Starter | Gray | "Starter" |
| Professional | Blue | "Pro" |
| Enterprise | Purple | "Enterprise" |
| Trial | Yellow | "Trial" |

### Interactions
- **Click row** - Navigate to company details
- **"View All Companies"** - Navigate to companies list

---

## System Health Widget

### Status Indicators
| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| Healthy | ● | Green | All systems operational |
| Warning | ⚠ | Yellow | Degraded performance |
| Critical | ● | Red | Service disruption |

### Services Monitored
- API Gateway
- Database Cluster
- Message Queue
- AI/ML Services
- File Storage
- Email Service

### Footer Metrics
- **Uptime** - Platform uptime percentage (rolling 30 days)
- **Last Incident** - Days since last incident

---

## Subscription Distribution

### Chart Type
Donut/Pie chart

### Data
- Count and percentage by plan type
- Click segment to filter companies list

---

## Quick Actions

| Action | Icon | Description | Destination |
|--------|------|-------------|-------------|
| Add Company | + | Create new company manually | Modal/Companies page |
| Send Announcement | 📧 | Broadcast to all companies | Announcement modal |
| Generate Report | 📊 | Export platform report | Report generator modal |
| System Settings | ⚙️ | Access system configuration | Settings page |

---

## Header Elements

### Global Search
- Searches across companies, users, conversations
- Keyboard shortcut: `Cmd/Ctrl + K`
- Shows recent searches

### Notifications Bell
- Badge shows unread count
- Click opens notification dropdown
- Types: New companies, alerts, system notifications

### User Menu
```
┌────────────────────────┐
│  [Avatar]              │
│  Admin Name            │
│  admin@chat.buzzi.ai   │
├────────────────────────┤
│  My Profile            │
│  Preferences           │
├────────────────────────┤
│  Sign Out              │
└────────────────────────┘
```

---

## Behaviors

### Auto-Refresh
- Dashboard data refreshes every 60 seconds
- Manual refresh button available
- Shows "Last updated: X" timestamp

### Loading States
- Skeleton loaders for each widget
- Charts show loading spinner
- Graceful degradation if service unavailable

### Real-time Updates
- New company registrations appear without refresh
- System health updates immediately on status change

---

## Mobile Layout (< 1024px)

```
┌───────────────────────────┐
│  [☰] Dashboard    [🔔] [👤]│
├───────────────────────────┤
│                           │
│  ┌─────────┐ ┌─────────┐  │
│  │Companies│ │ Users   │  │
│  │   156   │ │  1,234  │  │
│  └─────────┘ └─────────┘  │
│                           │
│  ┌─────────┐ ┌─────────┐  │
│  │Messages │ │ Revenue │  │
│  │  45.2K  │ │ $23.4K  │  │
│  └─────────┘ └─────────┘  │
│                           │
│  [Platform Activity Chart]│
│                           │
│  System Health            │
│  ● API         Healthy    │
│  ● Database    Healthy    │
│  ⚠ Storage    Warning    │
│                           │
│  Recent Companies         │
│  ─────────────────────    │
│  Acme Corp        [→]     │
│  TechStart        [→]     │
│  BigCorp          [→]     │
│                           │
└───────────────────────────┘
```

- Hamburger menu for navigation
- 2x2 grid for metrics
- Stacked widgets
- Simplified charts

---

## Related Pages

- [Companies List](./02-companies-list.md)
- [Platform Analytics](./05-platform-analytics.md)
- [System Settings](./07-system-settings.md)
