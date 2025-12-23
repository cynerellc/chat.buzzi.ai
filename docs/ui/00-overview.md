# UI/UX Overview - Chat.buzzi.ai

## Platform Overview

Chat.buzzi.ai is a multi-tenant AI chatbot SaaS platform with three distinct user areas:
1. **Master Admin Portal** - Platform-level management
2. **Company Admin Dashboard** - Tenant management and configuration
3. **Support Agent Workspace** - Human-in-the-loop conversation handling

---

## Design Principles

### 1. Consistency
- Unified design language across all user roles
- Consistent navigation patterns and component usage
- Predictable behavior and interactions

### 2. Clarity
- Clear visual hierarchy
- Descriptive labels and helpful tooltips
- Contextual help where needed

### 3. Efficiency
- Minimal clicks to complete common tasks
- Keyboard shortcuts for power users
- Quick actions and bulk operations

### 4. Responsiveness
- Mobile-first approach for Support Agent workspace
- Responsive layouts for all screen sizes
- Touch-friendly interactions on mobile

### 5. Accessibility
- WCAG 2.1 AA compliance
- Proper ARIA labels and roles
- Keyboard navigation support
- High contrast mode support

---

## Theme

**Default Theme: Dark**

The platform uses dark theme by default across all user roles. Users can switch to light theme via their personal settings.

---

## Color Scheme

```
Default Primary Colors:
├── Primary:        #6437F3 (Purple - actions, links, focus)
├── Secondary:      #2b3dd8 (Blue - secondary actions)

Status Colors:
├── Success:        #afeb31 (confirmations, active)
├── Warning:        #f5a225 (warnings, pending)
├── Error:          #f31260 (errors, destructive)

Neutral Colors:
├── Gray 900:       #111827 (Primary text)
├── Gray 700:       #374151 (Secondary text)
├── Gray 500:       #6B7280 (Muted text)
├── Gray 300:       #D1D5DB (Borders)
├── Gray 100:       #F3F4F6 (Backgrounds)
├── White:          #FFFFFF (Cards, surfaces)

Role-specific Accents:
├── Master Admin:  (Primary: #6437F3  , Secondary: #2b3dd8  )
├── Company Admin:  (Primary: #6437F3  , Secondary: #2b3dd8  )
├── Support Agent:  (Primary: #10B981  , Secondary: #0D9488  )
```
---

## Typography   

```
Font Family: Inter (primary), system-ui (fallback)

Headings:
├── H1: 30px / 36px line-height / 700 weight
├── H2: 24px / 32px line-height / 600 weight
├── H3: 20px / 28px line-height / 600 weight
├── H4: 16px / 24px line-height / 600 weight

Body:
├── Large:  16px / 24px line-height / 400 weight
├── Base:   14px / 20px line-height / 400 weight
├── Small:  12px / 16px line-height / 400 weight

Labels:
├── Button: 14px / 20px line-height / 500 weight
├── Caption: 12px / 16px line-height / 500 weight
```

---

## Page Structure

### Complete Page Inventory

#### Authentication & Onboarding (4 pages)
| Page | File | Description |
|------|------|-------------|
| Login | `shared/01-login.md` | Email/password and OAuth login |
| Register | `shared/02-register.md` | Company registration flow |
| Forgot Password | `shared/03-forgot-password.md` | Password reset request |
| Accept Invitation | `shared/04-accept-invitation.md` | Support agent invitation acceptance |

#### Master Admin Portal (10 pages)
| Page | File | Description |
|------|------|-------------|
| Dashboard | `master-admin/01-dashboard.md` | Platform overview and metrics |
| Companies List | `master-admin/02-companies-list.md` | All tenant companies |
| Company Details | `master-admin/03-company-details.md` | Individual company view + agent creation |
| Subscription Plans | `master-admin/04-subscription-plans.md` | Plan management |
| Platform Analytics | `master-admin/05-platform-analytics.md` | Platform-wide analytics |
| Audit Logs | `master-admin/06-audit-logs.md` | System audit trail |
| System Settings | `master-admin/07-system-settings.md` | Global configuration |
| Impersonation | `master-admin/08-impersonation.md` | Company access as admin |
| Agent Packages | `master-admin/09-agent-packages.md` | Pluggable agent code management |
| Agent Configuration | `master-admin/10-agent-configuration.md` | Advanced agent settings (system prompts, execution) |

#### Company Admin Dashboard (14 pages)
| Page | File | Description |
|------|------|-------------|
| Dashboard | `company-admin/01-dashboard.md` | Company overview |
| Agents List | `company-admin/02-agents-list.md` | View AI agents (created by Master Admin) |
| Agent Editor | `company-admin/03-agent-editor.md` | Edit basic agent settings (personality, response style) |
| Agent Settings | `company-admin/04-agent-settings.md` | Operational agent settings (escalation, webhooks) |
| Knowledge Base | `company-admin/05-knowledge-base.md` | Knowledge management |
| File Manager | `company-admin/06-file-manager.md` | Document uploads |
| Conversations | `company-admin/07-conversations.md` | All conversations |
| Conversation Detail | `company-admin/08-conversation-detail.md` | Single conversation view |
| Team Management | `company-admin/09-team-management.md` | Support agents |
| Analytics | `company-admin/10-analytics.md` | Company analytics |
| Widget Customizer | `company-admin/11-widget-customizer.md` | Chat widget config |
| Integrations | `company-admin/12-integrations.md` | Channel integrations |
| Settings | `company-admin/13-settings.md` | Company settings |
| Billing | `company-admin/14-billing.md` | Subscription & billing |

#### Support Agent Workspace (5 pages)
| Page | File | Description |
|------|------|-------------|
| Inbox | `support-agent/01-inbox.md` | Conversation queue |
| Live Chat | `support-agent/02-live-chat.md` | Active conversation |
| Customer Profile | `support-agent/03-customer-profile.md` | Customer context |
| Canned Responses | `support-agent/04-canned-responses.md` | Response templates |
| My Settings | `support-agent/05-my-settings.md` | Personal preferences |

#### Shared Components (1 document)
| Document | File | Description |
|----------|------|-------------|
| Components Library | `components/00-components.md` | Reusable UI components |

**Total: 34 pages + 1 component library**

---

## Navigation Structure

### Master Admin Navigation

```
+-------------------------------------------------------------+
|  [Logo] Chat.buzzi.ai          [Search]    [?] [Bell] [MA]  |
+-------------------------------------------------------------+
|                                                             |
|  MAIN MENU                                                  |
|  ---------                                                  |
|  * Dashboard                                                |
|  * Companies                                                |
|  * Subscription Plans                                       |
|  * Analytics                                                |
|                                                             |
|  AGENTS                                                     |
|  ------                                                     |
|  * Packages                                                 |
|                                                             |
|  SYSTEM                                                     |
|  ------                                                     |
|  * Audit Logs                                               |
|  * Settings                                                 |
|                                                             |
+-------------------------------------------------------------+
```

### Company Admin Navigation

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] {Company Name}         [Search]    [?] [Bell] [CA] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MAIN MENU                                                  │
│  ─────────                                                  │
│  ● Dashboard                                                │
│  ● Agents                                                   │
│  ● Knowledge Base                                           │
│  ● Conversations                                            │
│                                                             │
│  TEAM                                                       │
│  ────                                                       │
│  ● Team Members                                             │
│  ● Analytics                                                │
│                                                             │
│  CONFIGURE                                                  │
│  ─────────                                                  │
│  ● Widget                                                   │
│  ● Integrations                                             │
│  ● Settings                                                 │
│  ● Billing                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Support Agent Navigation

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] {Company Name}    [Status: Online ▼]   [Bell] [SA] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WORKSPACE                                                  │
│  ─────────                                                  │
│  ● Inbox                    (12)                            │
│    └─ Waiting               (5)                             │
│    └─ Assigned to me        (7)                             │
│  ● All Conversations                                        │
│                                                             │
│  TOOLS                                                      │
│  ─────                                                      │
│  ● Canned Responses                                         │
│  ● My Settings                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

```
Mobile:       < 640px   (Single column, bottom navigation)
Tablet:       640-1024px (Collapsible sidebar)
Desktop:      1024-1440px (Fixed sidebar)
Large:        > 1440px   (Wide content area)
```

---

## Common Patterns

### 1. List Pages
- Search and filter bar at top
- Bulk actions when items selected
- Pagination or infinite scroll
- Empty state with call-to-action

### 2. Detail Pages
- Breadcrumb navigation
- Header with title and primary actions
- Tab navigation for sections
- Sticky action bar (mobile)

### 3. Forms
- Clear section grouping
- Inline validation
- Auto-save for long forms
- Confirmation for destructive actions

### 4. Modals
- Centered overlay
- Clear title and close button
- Primary action on right
- Escape to close

### 5. Notifications
- Toast for transient messages
- Inline alerts for persistent warnings
- Badge counts for unread items

---

## User Flows

### Flow 1: Company Registration
```
Login Page → Register Tab → Company Details → Email Verification →
Plan Selection → Payment → Dashboard
```

### Flow 2: Create First Agent
```
Dashboard (Empty State) → Create Agent → Agent Builder →
Configure Personality → Add Knowledge → Test Chat → Activate
```

### Flow 3: Human Escalation
```
AI Chat → Escalation Trigger → Queue (Waiting) →
Agent Accepts → Live Chat → Resolution → Handover to AI or Close
```

### Flow 4: Knowledge Base Setup
```
Knowledge Base → Create Category → Upload Files →
Processing Status → Assign to Agent → Test RAG
```

---

## Related Documents

### Architecture
- [Architecture Overview](../architecture-overview.md)
- [Auth & Multi-tenancy](../architecture-auth-multitenancy.md)
- [Chat Widget](../architecture-chat-widget.md)
- [HITL Architecture](../architecture-hitl.md)

### Requirements
- [Requirements Document](../requirement.v2.md)

---

## Document Index

### By User Role

**Master Admin:**
1. [Dashboard](./master-admin/01-dashboard.md)
2. [Companies List](./master-admin/02-companies-list.md)
3. [Company Details](./master-admin/03-company-details.md) - includes agent creation
4. [Subscription Plans](./master-admin/04-subscription-plans.md)
5. [Platform Analytics](./master-admin/05-platform-analytics.md)
6. [Audit Logs](./master-admin/06-audit-logs.md)
7. [System Settings](./master-admin/07-system-settings.md)
8. [Impersonation](./master-admin/08-impersonation.md)
9. [Agent Packages](./master-admin/09-agent-packages.md) - code package management
10. [Agent Configuration](./master-admin/10-agent-configuration.md) - advanced agent settings

**Company Admin:**
1. [Dashboard](./company-admin/01-dashboard.md)
2. [Agents List](./company-admin/02-agents-list.md) - view agents (created by Master Admin)
3. [Agent Editor](./company-admin/03-agent-editor.md) - basic settings only
4. [Agent Settings](./company-admin/04-agent-settings.md) - operational settings
5. [Knowledge Base](./company-admin/05-knowledge-base.md)
6. [File Manager](./company-admin/06-file-manager.md)
7. [Conversations](./company-admin/07-conversations.md)
8. [Conversation Detail](./company-admin/08-conversation-detail.md)
9. [Team Management](./company-admin/09-team-management.md)
10. [Analytics](./company-admin/10-analytics.md)
11. [Widget Customizer](./company-admin/11-widget-customizer.md)
12. [Integrations](./company-admin/12-integrations.md)
13. [Settings](./company-admin/13-settings.md)
14. [Billing](./company-admin/14-billing.md)

**Support Agent:**
1. [Inbox](./support-agent/01-inbox.md)
2. [Live Chat](./support-agent/02-live-chat.md)
3. [Customer Profile](./support-agent/03-customer-profile.md)
4. [Canned Responses](./support-agent/04-canned-responses.md)
5. [My Settings](./support-agent/05-my-settings.md)

**Shared:**
1. [Login](./shared/01-login.md)
2. [Register](./shared/02-register.md)
3. [Forgot Password](./shared/03-forgot-password.md)
4. [Accept Invitation](./shared/04-accept-invitation.md)

**Components:**
1. [Component Library](./components/00-components.md)
