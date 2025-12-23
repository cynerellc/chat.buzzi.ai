# Audit Logs

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/admin/audit-logs` |
| Access | Master Admin only |
| Purpose | View platform-wide audit trail |
| Mobile Support | Responsive table/cards |

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Chat.buzzi.ai              [Search...]        [?] [🔔] [MA ▼]           │
├────────────────┬────────────────────────────────────────────────────────────────┤
│                │                                                                │
│  MAIN MENU     │  Audit Logs                                          [Export] │
│  ─────────     │                                                                │
│  ○ Dashboard   │  ┌──────────────────────────────────────────────────────────┐ │
│  ○ Companies   │  │ 🔍 Search logs...                                        │ │
│  ○ Plans       │  │                                                          │ │
│  ○ Analytics   │  │ Date: [Last 7 days ▼]  Action: [All ▼]  User: [All ▼]   │ │
│                │  │                                                          │ │
│  SYSTEM        │  │ Resource: [All ▼]  Company: [All ▼]      [Apply Filters]│ │
│  ──────        │  └──────────────────────────────────────────────────────────┘ │
│  ● Audit Logs  │                                                                │
│  ○ Settings    │  Showing 1-50 of 12,456 events                                │
│                │                                                                │
│                │  ┌──────────────────────────────────────────────────────────┐ │
│                │  │ Timestamp        User           Action      Resource     │ │
│                │  ├──────────────────────────────────────────────────────────┤ │
│                │  │ Jan 18, 10:45   admin@...      Updated     Agent        │ │
│                │  │ Jan 18, 10:42   john@acme...   Created     Document     │ │
│                │  │ Jan 18, 10:38   admin@...      Viewed      Company      │ │
│                │  │ Jan 18, 10:35   system         Processed   Webhook      │ │
│                │  │ Jan 18, 10:30   jane@tech...   Deleted     Response     │ │
│                │  │ Jan 18, 10:28   admin@...      Impersonated Company     │ │
│                │  │ Jan 18, 10:25   bob@big...     Login       Session      │ │
│                │  │ Jan 18, 10:22   system         Scheduled   Backup       │ │
│                │  │ ...                                                      │ │
│                │  ├──────────────────────────────────────────────────────────┤ │
│                │  │ [< Previous]  Page 1 of 250  [Next >]                    │ │
│                │  └──────────────────────────────────────────────────────────┘ │
│                │                                                                │
└────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## Search & Filters

### Search Bar
- **Placeholder**: "Search by user, resource, IP address, or details..."
- **Behavior**: Full-text search with 500ms debounce
- **Scope**: User email, resource ID, IP address, event details

### Filter Options

#### Date Range
| Option | Description |
|--------|-------------|
| Last 24 hours | Past day |
| Last 7 days | Past week (default) |
| Last 30 days | Past month |
| Last 90 days | Past quarter |
| Custom range | Date picker |

#### Action Types
| Action | Description |
|--------|-------------|
| Created | New resource created |
| Updated | Resource modified |
| Deleted | Resource removed |
| Viewed | Resource accessed |
| Login | User authentication |
| Logout | Session ended |
| Failed Login | Authentication failure |
| Impersonated | Admin impersonation |
| Exported | Data export |
| System | Automated actions |

#### Resource Types
| Resource | Description |
|----------|-------------|
| User | User accounts |
| Company | Company records |
| Agent | AI agents |
| Conversation | Chat conversations |
| Document | Knowledge base files |
| Settings | Configuration changes |
| Plan | Subscription plans |
| Session | Login sessions |
| API Key | API credentials |
| Webhook | Webhook events |

#### User Filter
- Dropdown with autocomplete
- Filter by specific user
- Option for "System" actions

#### Company Filter
- Dropdown with autocomplete
- Filter by specific company
- Option for "Platform-level" actions

---

## Table Columns

| Column | Type | Sortable | Description |
|--------|------|----------|-------------|
| Timestamp | DateTime | Yes | When event occurred |
| User | User + Company | Yes | Who performed action |
| Action | Badge | Yes | Type of action |
| Resource | Type + Name | Yes | What was affected |
| IP Address | Text | Yes | Source IP |
| Details | Expandable | No | Additional context |

### Action Badges

| Action | Color | Icon |
|--------|-------|------|
| Created | Green | + |
| Updated | Blue | ✏️ |
| Deleted | Red | 🗑️ |
| Viewed | Gray | 👁️ |
| Login | Green | → |
| Logout | Gray | ← |
| Failed Login | Red | ⚠️ |
| Impersonated | Purple | 👤 |
| Exported | Yellow | ↓ |
| System | Gray | ⚙️ |

---

## Event Detail View

Clicking a row expands to show full details:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Event Details                                                      [×] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Event Information                                                      │
│  ─────────────────                                                      │
│                                                                         │
│  Event ID:        evt_abc123def456                                      │
│  Timestamp:       January 18, 2024 at 10:45:32 AM UTC                   │
│  Action:          Updated                                               │
│  Resource Type:   Agent                                                 │
│  Resource ID:     agent_xyz789                                          │
│  Resource Name:   Sales Bot                                             │
│                                                                         │
│  User Information                                                       │
│  ────────────────                                                       │
│                                                                         │
│  User:            admin@chat.buzzi.ai                                   │
│  User ID:         usr_admin001                                          │
│  Role:            Master Admin                                          │
│  Company:         Platform (Master Admin)                               │
│                                                                         │
│  Request Information                                                    │
│  ───────────────────                                                    │
│                                                                         │
│  IP Address:      192.168.1.100                                         │
│  User Agent:      Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...   │
│  Request ID:      req_abc123                                            │
│                                                                         │
│  Changes                                                                │
│  ───────                                                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Field          Before              After                       │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  name           "Sales Assistant"   "Sales Bot"                 │   │
│  │  personality    "Professional"      "Friendly & Professional"   │   │
│  │  isActive       false               true                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Raw Event Data                                              [Copy JSON]│
│  ──────────────                                                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  {                                                              │   │
│  │    "id": "evt_abc123def456",                                    │   │
│  │    "action": "updated",                                         │   │
│  │    "resource": { ... },                                         │   │
│  │    "changes": { ... },                                          │   │
│  │    ...                                                          │   │
│  │  }                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Export Options

```
┌─────────────────────────────────────┐
│  Export Audit Logs              [×] │
├─────────────────────────────────────┤
│                                     │
│  Export Scope                       │
│  ○ Current filtered results (245)   │
│  ○ All logs in date range (12,456)  │
│                                     │
│  Date Range                         │
│  [Jan 11] to [Jan 18]              │
│                                     │
│  Format                             │
│  ○ CSV                              │
│  ○ JSON                             │
│  ○ PDF Report                       │
│                                     │
│  Include                            │
│  ☑ Full event details               │
│  ☑ Change history                   │
│  ☐ Raw request data                 │
│                                     │
│  ⚠️ Large exports may take several  │
│     minutes. You'll receive an      │
│     email when ready.               │
│                                     │
│  [Cancel]  [Export]                 │
└─────────────────────────────────────┘
```

---

## Security Events Section

Special highlighting for security-related events:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Security Events (Last 24 hours)                          [View All] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  🔴 3 Failed login attempts from IP 45.33.32.156           2 hours ago │
│  🟡 Admin impersonated Acme Corp                           4 hours ago │
│  🔴 API key regenerated for TechStart                      6 hours ago │
│  🟡 Bulk user export performed                             8 hours ago │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Event Types
| Type | Severity | Description |
|------|----------|-------------|
| Failed Logins | High | Multiple failed attempts |
| Impersonation | Medium | Admin accessing as user |
| API Key Changes | Medium | Credential regeneration |
| Bulk Export | Medium | Large data exports |
| Permission Changes | High | Role/access modifications |
| Account Lockout | High | Account security triggers |

---

## Real-time Updates

### Live Mode Toggle
```
[○ Live Updates] - Off by default

When enabled:
- New events appear at top
- Visual pulse animation for new entries
- Counter shows events since page load
- Auto-pause when scrolling down
```

---

## Behaviors

### Pagination
- 50 events per page
- Jump to page input
- First/Last page navigation
- Maintains filters when paging

### Retention
- Logs retained for 365 days
- Older logs archived to cold storage
- Export available for archived data (request based)

### Performance
- Lazy loading for detail expansion
- Virtualized table for large result sets
- Cached filter options

---

## Mobile Layout

```
┌───────────────────────────┐
│  [☰] Audit Logs   [🔍] [⬇]│
├───────────────────────────┤
│  [Filter Tags...]         │
├───────────────────────────┤
│                           │
│  ┌─────────────────────┐  │
│  │ Jan 18, 10:45 AM    │  │
│  │ admin@chat.buzzi.ai │  │
│  │ [Updated] Agent     │  │
│  │ Sales Bot           │  │
│  │               [→]   │  │
│  └─────────────────────┘  │
│                           │
│  ┌─────────────────────┐  │
│  │ Jan 18, 10:42 AM    │  │
│  │ john@acme.com       │  │
│  │ [Created] Document  │  │
│  │ FAQ.pdf             │  │
│  │               [→]   │  │
│  └─────────────────────┘  │
│                           │
│  [Load More]              │
│                           │
└───────────────────────────┘
```

- Card-based layout
- Filters as bottom sheet
- Infinite scroll
- Tap card for details (slide-over panel)
- Swipe actions for quick export

---

## Related Pages

- [Dashboard](./01-dashboard.md)
- [Company Details - Audit Tab](./03-company-details.md)
- [System Settings](./07-system-settings.md)
