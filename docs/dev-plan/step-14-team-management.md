# Step 14: Company Admin - Team Management

## Objective
Implement team member management including inviting users, managing roles, setting permissions, and handling team capacity for conversation routing.

---

## Prerequisites
- Step 13 completed
- Database schema with users and team_invitations tables
- Email service configured for invitations

---

## Reference Documents
- [UI: Team Management](../ui/company-admin/09-team-management.md)

---

## Tasks

### 14.1 Create Team Management Page

**Route:** `src/app/(company-admin)/team/page.tsx`

**Features:**
- Team members table
- Invite new members
- Role management
- Remove members

### 14.2 Implement Team Members Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Team Management                                               [+ Invite Member] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ Active Members (5)        Pending Invitations (2)                               │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ │ Member            │ Email                │ Role           │ Status │ Actions ││
│ ├───────────────────┼──────────────────────┼────────────────┼────────┼─────────┤│
│ │ [Avatar]          │                      │                │        │         ││
│ │ John Smith        │ john@acme.com        │ Admin          │ ●Online│ [⋮]     ││
│ │ (You)             │                      │                │        │         ││
│ │                   │                      │                │        │         ││
│ ├───────────────────┼──────────────────────┼────────────────┼────────┼─────────┤│
│ │ [Avatar]          │                      │                │        │         ││
│ │ Sarah Johnson     │ sarah@acme.com       │ Support Agent  │ ●Online│ [⋮]     ││
│ │                   │                      │ Capacity: 3/5  │        │         ││
│ │                   │                      │                │        │         ││
│ ├───────────────────┼──────────────────────┼────────────────┼────────┼─────────┤│
│ │ [Avatar]          │                      │                │        │         ││
│ │ Mike Chen         │ mike@acme.com        │ Support Agent  │ ○Away  │ [⋮]     ││
│ │                   │                      │ Capacity: 0/5  │        │         ││
│ │                   │                      │                │        │         ││
│ ├───────────────────┼──────────────────────┼────────────────┼────────┼─────────┤│
│ │ [Avatar]          │                      │                │        │         ││
│ │ Emily Brown       │ emily@acme.com       │ Admin          │ ○Offline│ [⋮]    ││
│ │                   │                      │                │        │         ││
│ │                   │                      │                │        │         ││
│ └───────────────────┴──────────────────────┴────────────────┴────────┴─────────┘│
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 14.3 Implement Pending Invitations Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Pending Invitations (2)                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ │ Email                    │ Role           │ Invited By    │ Expires  │ Actions│
│ ├──────────────────────────┼────────────────┼───────────────┼──────────┼────────┤
│ │ bob@acme.com             │ Support Agent  │ John Smith    │ 5 days   │ [⋮]    │
│ │ alice@acme.com           │ Admin          │ John Smith    │ 6 days   │ [⋮]    │
│ └──────────────────────────┴────────────────┴───────────────┴──────────┴────────┘
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 14.4 Implement Invite Member Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Invite Team Member                                          [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Email Address *                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ newmember@acme.com                                      │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Role *                                                          │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Support Agent                                         ▼ │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Role Descriptions:                                              │
│ ─────────────────                                               │
│                                                                 │
│ Admin                                                           │
│ Can manage agents, knowledge, settings, billing, and team       │
│                                                                 │
│ Support Agent                                                   │
│ Can handle conversations and use canned responses               │
│                                                                 │
│ ─────────────────────────────────────────────────────────────  │
│                                                                 │
│ Personal Message (optional)                                     │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Welcome to the team! Looking forward to working with    │    │
│ │ you.                                                    │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          [Cancel]  [Send Invitation]            │
└─────────────────────────────────────────────────────────────────┘
```

### 14.5 Implement Edit Member Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Team Member                                            [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│           [Avatar]                                              │
│           Sarah Johnson                                         │
│           sarah@acme.com                                        │
│           Member since: January 10, 2024                        │
│                                                                 │
│ Role *                                                          │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Support Agent                                         ▼ │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Agent Settings (for Support Agents)                             │
│ ───────────────────────────────────                             │
│                                                                 │
│ Max Concurrent Conversations                                    │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 5                                                     ▼ │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Auto-Assignment                                                 │
│ ☑ Receive automatic conversation assignments                   │
│                                                                 │
│ Assigned Agents                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ ☑ Support Bot                                           │    │
│ │ ☑ FAQ Bot                                               │    │
│ │ ☐ Sales Assistant                                       │    │
│ └─────────────────────────────────────────────────────────┘    │
│ Only receive escalations from selected agents                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          [Cancel]  [Save Changes]               │
└─────────────────────────────────────────────────────────────────┘
```

### 14.6 Implement Member Actions Menu

```
┌────────────────────────────┐
│  Edit Member               │
│  View Activity             │
├────────────────────────────┤
│  Change Role               │
│  Reset Password            │
├────────────────────────────┤
│  Deactivate                │
│  Remove from Team          │
└────────────────────────────┘
```

### 14.7 Implement Invitation Actions Menu

```
┌────────────────────────────┐
│  Resend Invitation         │
│  Copy Invitation Link      │
├────────────────────────────┤
│  Cancel Invitation         │
└────────────────────────────┘
```

### 14.8 Implement Remove Member Confirmation

```
┌─────────────────────────────────────────┐
│ Remove Team Member                  [×] │
├─────────────────────────────────────────┤
│                                         │
│ ⚠️ Are you sure you want to remove     │
│ Sarah Johnson from your team?           │
│                                         │
│ This will:                              │
│ • Revoke their access to the dashboard  │
│ • Unassign their active conversations   │
│ • Remove them from all teams            │
│                                         │
│ Their conversation history will be      │
│ preserved.                              │
│                                         │
│ Type "REMOVE" to confirm:               │
│ ┌─────────────────────────────────┐     │
│ │                                 │     │
│ └─────────────────────────────────┘     │
│                                         │
├─────────────────────────────────────────┤
│             [Cancel]  [Remove Member]   │
└─────────────────────────────────────────┘
```

### 14.9 Implement Team Roles & Permissions

**`src/lib/auth/permissions.ts`:**

```typescript
export const ROLES = {
  COMPANY_ADMIN: 'company_admin',
  SUPPORT_AGENT: 'support_agent',
} as const;

export const PERMISSIONS = {
  // Agents
  'agents.read': true,
  'agents.write': [ROLES.COMPANY_ADMIN],
  'agents.delete': [ROLES.COMPANY_ADMIN],

  // Knowledge
  'knowledge.read': true,
  'knowledge.write': [ROLES.COMPANY_ADMIN],
  'knowledge.delete': [ROLES.COMPANY_ADMIN],

  // Conversations
  'conversations.read': true,
  'conversations.handle': true,
  'conversations.export': [ROLES.COMPANY_ADMIN],

  // Team
  'team.read': [ROLES.COMPANY_ADMIN],
  'team.invite': [ROLES.COMPANY_ADMIN],
  'team.manage': [ROLES.COMPANY_ADMIN],

  // Settings
  'settings.read': [ROLES.COMPANY_ADMIN],
  'settings.write': [ROLES.COMPANY_ADMIN],

  // Billing
  'billing.read': [ROLES.COMPANY_ADMIN],
  'billing.write': [ROLES.COMPANY_ADMIN],

  // Widget
  'widget.read': [ROLES.COMPANY_ADMIN],
  'widget.write': [ROLES.COMPANY_ADMIN],

  // Analytics
  'analytics.read': true,
  'analytics.export': [ROLES.COMPANY_ADMIN],
} as const;

export function hasPermission(
  userRole: string,
  permission: keyof typeof PERMISSIONS
): boolean;
```

### 14.10 Implement Invitation Email

**`src/lib/email/templates/team-invitation.ts`:**

Email content:
- Company name
- Inviter name
- Role being assigned
- Personal message (if any)
- Accept invitation link
- Expiration notice

### 14.11 Implement Agent Capacity Display

```
┌─────────────────────────────────────────────────────────────────┐
│ Team Capacity Overview                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Online Agents: 2/4                    Total Capacity: 6/20      │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Agent             │ Status   │ Capacity │ Availability  │    │
│ ├───────────────────┼──────────┼──────────┼───────────────┤    │
│ │ Sarah Johnson     │ ● Online │ 3/5      │ Available     │    │
│ │ Mike Chen         │ ● Online │ 3/5      │ Available     │    │
│ │ Emily Brown       │ ○ Away   │ 0/5      │ Unavailable   │    │
│ │ Bob Wilson        │ ○ Offline│ 0/5      │ Offline       │    │
│ └───────────────────┴──────────┴──────────┴───────────────┘    │
│                                                                 │
│ Unassigned Conversations: 3                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 14.12 Create Team API Routes

**`src/app/api/company/team/route.ts`:**
- GET: List team members

**`src/app/api/company/team/[userId]/route.ts`:**
- GET: Get member details
- PATCH: Update member (role, settings)
- DELETE: Remove member

**`src/app/api/company/team/invitations/route.ts`:**
- GET: List pending invitations
- POST: Create new invitation

**`src/app/api/company/team/invitations/[invitationId]/route.ts`:**
- DELETE: Cancel invitation
- POST: Resend invitation

**`src/app/api/company/team/capacity/route.ts`:**
- GET: Get team capacity overview

---

## Data Models

### Team Member
```typescript
interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'company_admin' | 'support_agent';
  status: 'online' | 'away' | 'busy' | 'offline';
  settings: {
    maxConcurrentConversations: number;
    autoAssignment: boolean;
    assignedAgents: string[];
  };
  stats: {
    currentConversations: number;
    todayConversations: number;
    avgResponseTime: number;
  };
  lastActiveAt: Date;
  createdAt: Date;
}
```

### Team Invitation
```typescript
interface TeamInvitation {
  id: string;
  companyId: string;
  email: string;
  role: 'company_admin' | 'support_agent';
  invitedBy: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  message: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}
```

---

## Validation Checklist

- [ ] Team members list displays correctly
- [ ] Pending invitations show
- [ ] Invite member sends email
- [ ] Invitation link works
- [ ] Edit member saves changes
- [ ] Change role works
- [ ] Remove member works
- [ ] Resend invitation works
- [ ] Cancel invitation works
- [ ] Capacity display updates
- [ ] Permissions enforced correctly

---

## File Structure

```
src/
├── app/
│   ├── (company-admin)/
│   │   └── team/
│   │       └── page.tsx
│   │
│   └── api/
│       └── company/
│           └── team/
│               ├── route.ts
│               ├── capacity/
│               │   └── route.ts
│               ├── invitations/
│               │   ├── route.ts
│               │   └── [invitationId]/
│               │       └── route.ts
│               └── [userId]/
│                   └── route.ts
│
├── components/
│   └── company-admin/
│       └── team/
│           ├── team-members-table.tsx
│           ├── pending-invitations.tsx
│           ├── invite-member-modal.tsx
│           ├── edit-member-modal.tsx
│           ├── remove-member-modal.tsx
│           └── team-capacity.tsx
│
└── lib/
    ├── auth/
    │   └── permissions.ts
    └── email/
        └── templates/
            └── team-invitation.ts
```

---

## Next Step
[Step 15 - Company Analytics](./step-15-company-analytics.md)

---

## Related Documentation
- [UI: Team Management](../ui/company-admin/09-team-management.md)
- [Auth & Multi-tenancy Architecture](../architecture-auth-multitenancy.md)
