# Step 19: Support Agent - Inbox

## Objective
Implement the support agent inbox for managing conversation queues, viewing assigned conversations, and handling customer requests.

---

## Prerequisites
- Step 18 completed
- Real-time infrastructure (from Step 23)
- Conversation data from database

---

## Reference Documents
- [UI: Inbox](../ui/support-agent/01-inbox.md)

---

## Tasks

### 19.1 Create Support Agent Layout

**Route:** `src/app/(support-agent)/layout.tsx`

**Features:**
- Sidebar navigation
- Status selector (Online/Busy/Away)
- Capacity indicator
- Notification bell

### 19.2 Create Inbox Page

**Route:** `src/app/(support-agent)/inbox/page.tsx`

**Layout:**
```
┌────────────────┬────────────────────────────────────────────────────────────────┐
│                │                                                                │
│  INBOX         │  Inbox                                        [↻] [⚙️]        │
│  ─────         │                                                                │
│  ● My Inbox (5)│  [All] [Waiting (2)] [Active (3)] [Resolved] [Starred]        │
│  ○ Unassigned  │                                                                │
│    (3)         │  🔍 Search conversations...                   [Filter ▼]      │
│                │                                                                │
│  QUICK ACCESS  │  ┌──────────────────────────────────────────────────────────┐ │
│  ───────────   │  │  Conversation cards list...                             │ │
│  ○ Starred     │  └──────────────────────────────────────────────────────────┘ │
│  ○ All Resolved│                                                                │
│                │                                                                │
│  ───────────   │                                                                │
│  ○ Canned      │                                                                │
│    Responses   │                                                                │
│  ○ My Settings │                                                                │
│                │                                                                │
└────────────────┴────────────────────────────────────────────────────────────────┘
```

### 19.3 Implement Status Selector

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Status: [● Online ▼]                                           │
│                                                                 │
│  ┌─────────────────────┐                                       │
│  │ ● Online            │  Available for new conversations      │
│  │ ◐ Busy              │  Won't receive new assignments        │
│  │ ○ Away              │  Temporarily unavailable              │
│  │ ⊘ Invisible         │  Appear offline but can still work   │
│  └─────────────────────┘                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Status Types:**
- Online: Can receive new assignments
- Busy: Working but no new assignments
- Away: Temporarily unavailable
- Invisible: Hidden from customers

### 19.4 Implement Sidebar Navigation

```
┌─────────────────────────┐
│                         │
│  INBOX                  │
│  ─────                  │
│  ● My Inbox        (5)  │
│  ○ Unassigned      (3)  │
│                         │
│  QUICK ACCESS           │
│  ───────────            │
│  ○ Starred         (2)  │
│  ○ All Resolved         │
│                         │
│  ─────────────────      │
│  ○ Canned Responses     │
│  ○ My Settings          │
│                         │
│  ─────────────────      │
│  Capacity: 3/5          │
│  [████████░░]           │
│                         │
└─────────────────────────┘
```

### 19.5 Implement Conversation Card

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⭐ John Doe                          Sales Bot      2m ago     │
│     "I need help choosing a plan"     ● Active                 │
│     🏷️ [VIP] [Sales]                                            │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│  [⭐ Star]  [🏷️ Tag]  [↗️ Transfer]  [✓ Resolve]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Card Elements:**
- Customer name (starred if important)
- Bot that handled
- Time since last message
- Status indicator
- Message preview
- Tags
- Quick action buttons on hover

### 19.6 Implement Filter Tabs

**Tabs:**
- All: All conversations in inbox
- Waiting: Customer waiting for response
- Active: Currently engaged
- Resolved: Recently closed
- Starred: Marked as important

### 19.7 Implement Unassigned Queue

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Unassigned Conversations (3)                    [Take Next]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Alex Turner                          Support Bot  3m ago│   │
│  │  "I can't complete my purchase"       🔴 Escalated      │   │
│  │  Waiting: 3 minutes                        [Take]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 19.8 Implement Filters Panel

```
┌─────────────────────────────────────────┐
│  Filters                            [×] │
├─────────────────────────────────────────┤
│                                         │
│  Status                                 │
│  ☑ Active                              │
│  ☑ Waiting                             │
│  ☐ Resolved                            │
│                                         │
│  Priority                               │
│  ☐ High only                           │
│  ☐ VIP customers only                  │
│                                         │
│  Bot                                    │
│  ┌─────────────────────────────────┐   │
│  │ All Bots                      ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Tags                                   │
│  ┌─────────────────────────────────┐   │
│  │ Select tags...                ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Date Range                             │
│  ┌─────────────────────────────────┐   │
│  │ Today                         ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  [Clear All]              [Apply]       │
└─────────────────────────────────────────┘
```

### 19.9 Implement Notification Bell

```
┌─────────────────────────────────────────┐
│                                         │
│  🔔 3                                   │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │  New message from John Doe      │    │
│  │  "Yes, I'd like to upgrade"     │    │
│  │  2 minutes ago                  │    │
│  │                                 │    │
│  │  ─────────────────────────────  │    │
│  │                                 │    │
│  │  New escalation                 │    │
│  │  Customer: Sarah Johnson        │    │
│  │  5 minutes ago                  │    │
│  │                                 │    │
│  │  [Mark All as Read]             │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 19.10 Create Inbox API Routes

**`src/app/api/agent/inbox/route.ts`:**
- GET: List assigned conversations

**`src/app/api/agent/inbox/unassigned/route.ts`:**
- GET: List unassigned conversations

**`src/app/api/agent/inbox/[conversationId]/assign/route.ts`:**
- POST: Assign conversation to self

**`src/app/api/agent/inbox/[conversationId]/star/route.ts`:**
- POST: Star/unstar conversation

**`src/app/api/agent/inbox/[conversationId]/resolve/route.ts`:**
- POST: Resolve conversation

**`src/app/api/agent/inbox/[conversationId]/transfer/route.ts`:**
- POST: Transfer to another agent

**`src/app/api/agent/status/route.ts`:**
- GET: Get current status
- PATCH: Update status

**`src/app/api/agent/notifications/route.ts`:**
- GET: List notifications
- PATCH: Mark as read

### 19.11 Create Inbox Components

**`src/components/support-agent/inbox/conversation-list.tsx`:**
- List of conversation cards
- Filter tabs
- Infinite scroll

**`src/components/support-agent/inbox/conversation-card.tsx`:**
- Customer info
- Status badge
- Quick actions

**`src/components/support-agent/inbox/sidebar.tsx`:**
- Navigation links
- Capacity indicator
- Status selector

**`src/components/support-agent/inbox/status-selector.tsx`:**
- Status dropdown
- Status update handler

**`src/components/support-agent/inbox/filter-panel.tsx`:**
- Filter options
- Apply/clear buttons

**`src/components/support-agent/inbox/notification-dropdown.tsx`:**
- Notification list
- Mark as read

**`src/components/support-agent/inbox/unassigned-queue.tsx`:**
- Unassigned list
- Take next button

---

## Data Models

### Agent Status
```typescript
interface AgentStatus {
  userId: string;
  status: 'online' | 'busy' | 'away' | 'invisible';
  lastActiveAt: Date;
  currentCapacity: number;
  maxCapacity: number;
}
```

### Inbox Conversation
```typescript
interface InboxConversation {
  id: string;
  customer: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isVip: boolean;
  };
  agent: {
    id: string;
    name: string;
    type: 'ai' | 'human';
  };
  status: 'active' | 'waiting' | 'resolved';
  lastMessage: {
    content: string;
    sender: 'customer' | 'agent';
    timestamp: Date;
  };
  tags: string[];
  isStarred: boolean;
  waitingTime: number | null;
  assignedAt: Date;
  createdAt: Date;
}
```

### Agent Notification
```typescript
interface AgentNotification {
  id: string;
  type: 'new_message' | 'new_escalation' | 'waiting_too_long' | 'assignment';
  title: string;
  body: string;
  conversationId: string | null;
  read: boolean;
  createdAt: Date;
}
```

---

## Real-time Features

- New message notifications
- Queue updates
- Status changes
- Typing indicators
- Capacity updates

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `J` / `K` | Navigate up/down |
| `Enter` | Open conversation |
| `S` | Toggle star |
| `E` | Mark as resolved |
| `T` | Transfer |
| `/` | Focus search |
| `?` | Show shortcuts |

---

## Validation Checklist

- [ ] My Inbox loads assigned conversations
- [ ] Unassigned queue loads correctly
- [ ] Status selector updates status
- [ ] Filter tabs work
- [ ] Search works
- [ ] Filters panel applies filters
- [ ] Star/unstar works
- [ ] Take conversation works
- [ ] Notifications display
- [ ] Real-time updates work
- [ ] Capacity indicator accurate

---

## File Structure

```
src/
├── app/
│   ├── (support-agent)/
│   │   ├── layout.tsx
│   │   └── inbox/
│   │       └── page.tsx
│   │
│   └── api/
│       └── agent/
│           ├── inbox/
│           │   ├── route.ts
│           │   ├── unassigned/
│           │   │   └── route.ts
│           │   └── [conversationId]/
│           │       ├── assign/
│           │       │   └── route.ts
│           │       ├── star/
│           │       │   └── route.ts
│           │       ├── resolve/
│           │       │   └── route.ts
│           │       └── transfer/
│           │           └── route.ts
│           ├── status/
│           │   └── route.ts
│           └── notifications/
│               └── route.ts
│
└── components/
    └── support-agent/
        └── inbox/
            ├── conversation-list.tsx
            ├── conversation-card.tsx
            ├── sidebar.tsx
            ├── status-selector.tsx
            ├── filter-panel.tsx
            ├── notification-dropdown.tsx
            └── unassigned-queue.tsx
```

---

## Next Step
[Step 20 - Support Agent Live Chat](./step-20-live-chat.md)

---

## Related Documentation
- [UI: Inbox](../ui/support-agent/01-inbox.md)
- [Step 23 - Real-time Communication](./step-23-realtime.md)
