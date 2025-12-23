# Impersonation

## Page Overview

| Property | Value |
|----------|-------|
| URL | `/admin/impersonate/{companyId}` |
| Access | Master Admin only |
| Purpose | Access company dashboard as admin for support |
| Mobile Support | Full (mirrors company admin) |

---

## Impersonation Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Company List   │───▶│  Confirm Modal  │───▶│  Impersonated   │
│  or Details     │    │                 │    │  View           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      │ Exit
                                                      ▼
                                              ┌─────────────────┐
                                              │  Return to      │
                                              │  Master Admin   │
                                              └─────────────────┘
```

---

## Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Impersonate Company                                        [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│        ┌─────────────────────────────────────────┐              │
│        │                                         │              │
│        │           [Company Logo]                │              │
│        │                                         │              │
│        │         Acme Corporation                │              │
│        │                                         │              │
│        └─────────────────────────────────────────┘              │
│                                                                 │
│  You are about to access this company's dashboard as their      │
│  administrator. This action will be logged.                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Important:                                          │   │
│  │                                                         │   │
│  │  • All actions will be recorded in the audit log        │   │
│  │  • You will have full admin access to this company      │   │
│  │  • The company will NOT be notified                     │   │
│  │  • Session will end after 1 hour or manual exit         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Reason for access (required)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Customer support ticket #12345                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        [Cancel]  [Start Impersonation]          │
└─────────────────────────────────────────────────────────────────┘
```

### Required Fields

| Field | Type | Validation |
|-------|------|------------|
| Reason | Text | Required, min 10 characters |

---

## Impersonation Banner

When impersonating, a persistent banner is shown:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ IMPERSONATION MODE: Viewing as Acme Corporation          [Exit] [■ Minimize]│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Banner States

| State | Appearance |
|-------|------------|
| Default | Full purple banner at top |
| Minimized | Small floating badge in corner |
| Hover (minimized) | Expands to show company name |

### Banner Elements
- Warning icon
- "IMPERSONATION MODE" label
- Company name
- Exit button (returns to master admin)
- Minimize button (collapses to badge)

---

## Impersonated View

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ IMPERSONATION MODE: Viewing as Acme Corporation          [Exit] [■]         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [Logo] Acme Corporation          [Search...]        [?] [🔔] [Imp. Admin ▼]   │
├────────────────┬────────────────────────────────────────────────────────────────┤
│                │                                                                │
│  MAIN MENU     │                                                                │
│  ─────────     │           [Full Company Admin Dashboard]                       │
│  ● Dashboard   │                                                                │
│  ○ Agents      │           (Exact same as company admin sees)                   │
│  ○ Knowledge   │                                                                │
│  ○ Conversations│                                                               │
│  ...           │                                                                │
│                │                                                                │
│  CONFIGURE     │                                                                │
│  ─────────     │                                                                │
│  ○ Widget      │                                                                │
│  ○ Settings    │                                                                │
│  ○ Billing     │                                                                │
│                │                                                                │
└────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## Capabilities During Impersonation

### Full Access (Default)
| Capability | Available |
|------------|-----------|
| View Dashboard | ✓ |
| View Agents | ✓ |
| Edit Agents | ✓ |
| View Knowledge Base | ✓ |
| Upload Documents | ✓ |
| View Conversations | ✓ |
| Respond as Agent | ✓ |
| View Team Members | ✓ |
| Invite Team Members | ✓ |
| View Analytics | ✓ |
| Edit Widget | ✓ |
| Edit Settings | ✓ |
| View Billing | ✓ |

### Restricted Actions
| Action | Restriction | Reason |
|--------|-------------|--------|
| Change Plan | Blocked | Requires billing confirmation |
| Cancel Subscription | Blocked | Must be done from master admin |
| Delete Company | Blocked | Must be done from master admin |
| Change Admin Email | Blocked | Security |
| Reset Admin Password | Blocked | Security |

---

## Audit Logging

All impersonation sessions are logged with:

### Session Start Log
```json
{
  "event": "impersonation_started",
  "masterAdmin": "admin@chat.buzzi.ai",
  "targetCompany": "Acme Corporation",
  "targetCompanyId": "comp_abc123",
  "reason": "Customer support ticket #12345",
  "timestamp": "2024-01-18T10:45:00Z",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

### Action Logs (During Impersonation)
```json
{
  "event": "agent_updated",
  "performedBy": "admin@chat.buzzi.ai",
  "impersonating": "Acme Corporation",
  "resource": "agent_xyz789",
  "changes": {...},
  "timestamp": "2024-01-18T10:47:00Z"
}
```

### Session End Log
```json
{
  "event": "impersonation_ended",
  "masterAdmin": "admin@chat.buzzi.ai",
  "targetCompany": "Acme Corporation",
  "duration": "15 minutes",
  "actionsPerformed": 3,
  "timestamp": "2024-01-18T11:00:00Z"
}
```

---

## Exit Impersonation

### Exit Confirmation
```
┌─────────────────────────────────────────┐
│  Exit Impersonation                 [×] │
├─────────────────────────────────────────┤
│                                         │
│  End your session as Acme Corporation?  │
│                                         │
│  Session Summary:                       │
│  • Duration: 15 minutes                 │
│  • Actions performed: 3                 │
│                                         │
│  You will be returned to the Master     │
│  Admin dashboard.                       │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel]  [Exit Session]   │
└─────────────────────────────────────────┘
```

### Auto-Exit Conditions
| Condition | Behavior |
|-----------|----------|
| 1 hour timeout | Warning at 5 min, auto-exit |
| Browser close | Session ends |
| Master admin signs out | Session ends |
| Company suspended | Immediate exit |

---

## Session Timeout Warning

```
┌─────────────────────────────────────────┐
│  Session Expiring Soon              [×] │
├─────────────────────────────────────────┤
│                                         │
│  ⏱️ Your impersonation session will    │
│  expire in 5 minutes.                   │
│                                         │
│  [Extend 30 min]  [Exit Now]           │
│                                         │
└─────────────────────────────────────────┘
```

---

## Quick Impersonate (From Company List)

```
┌────────────────────────────────────────────────────────────────┐
│  Company Name          Plan        Actions                     │
├────────────────────────────────────────────────────────────────┤
│  Acme Corporation      Pro         [👤 Impersonate] [⋮]        │
│  TechStart             Starter     [👤 Impersonate] [⋮]        │
└────────────────────────────────────────────────────────────────┘
```

- Hover reveals "Impersonate" button
- Click opens confirmation modal directly
- Keyboard shortcut: Select row + `I`

---

## Behaviors

### Visual Indicators
- Purple theme during impersonation
- Company logo in header changes
- Navigation reflects company's access level
- User avatar shows impersonation badge

### Data Isolation
- Only see impersonated company's data
- Cannot access other companies
- Cannot access master admin functions (except exit)

### Security Measures
- Session tied to browser tab
- Cannot open multiple impersonation sessions
- All API calls tagged with impersonation context
- Rate limited to prevent abuse

---

## Mobile Layout

```
┌───────────────────────────┐
│ ⚠️ Impersonating: Acme [×]│
├───────────────────────────┤
│  [☰] Dashboard    [🔔] [👤]│
├───────────────────────────┤
│                           │
│  [Standard Company Admin  │
│   Mobile Layout]          │
│                           │
└───────────────────────────┘
```

- Compact impersonation banner
- Tap banner to see full info & exit option
- Same mobile experience as company admin

---

## Related Pages

- [Companies List](./02-companies-list.md)
- [Company Details](./03-company-details.md)
- [Audit Logs](./06-audit-logs.md)
- [Company Admin Dashboard](../company-admin/01-dashboard.md)
