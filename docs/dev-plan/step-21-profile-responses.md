# Step 21: Support Agent - Profile & Canned Responses

## Objective
Implement support agent personal settings, canned responses management, and profile customization.

---

## Prerequisites
- Step 20 completed
- User profile infrastructure
- Authentication system

---

## Reference Documents
- [UI: Canned Responses](../ui/support-agent/04-canned-responses.md)
- [UI: My Settings](../ui/support-agent/05-my-settings.md)

---

## Tasks

### 21.1 Create Canned Responses Page

**Route:** `src/app/(support-agent)/responses/page.tsx`

**Layout:**
```
┌────────────────┬────────────────────────────────────────────────────────────────┐
│                │                                                                │
│  INBOX         │  Canned Responses                            [+ New Response]  │
│  ─────         │                                                                │
│  ○ My Inbox    │  🔍 Search responses...                       [All ▼]         │
│  ○ Unassigned  │                                                                │
│                │  [All] [My Responses] [Team] [Favorites]                      │
│  QUICK ACCESS  │                                                                │
│  ───────────   │  ┌──────────────────────────────────────────────────────────┐ │
│  ○ Starred     │  │  Greetings                                          [▼]  │ │
│  ○ All Resolved│  │  ─────────                                               │ │
│                │  │  [Response cards...]                                     │ │
│  ───────────   │  │                                                          │ │
│  ● Canned      │  │  Sales                                              [▼]  │ │
│    Responses   │  │  ─────                                                   │ │
│  ○ My Settings │  │  [Response cards...]                                     │ │
│                │  └──────────────────────────────────────────────────────────┘ │
│                │                                                                │
└────────────────┴────────────────────────────────────────────────────────────────┘
```

### 21.2 Implement Response Card

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  /shortcut                                         [★/☆] [⋮]    │
│  Response Title                                                 │
│  ───────────────────────────────────────────────────────────── │
│  Preview of the response content truncated at two lines...     │
│  This is the second line of the preview text.                  │
│                                                                 │
│  Tags: [Greeting] [General]                    Used: 234 times │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Card Actions Menu (⋮):**
- Edit Response
- Duplicate
- Add to Favorites
- Copy to Clipboard
- Delete

### 21.3 Implement Create/Edit Response Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Create Canned Response                                     [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Title *                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Welcome Greeting                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Shortcut *                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ /greeting                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Type "/" followed by a short keyword. Must be unique.         │
│                                                                 │
│  Response Content *                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Hi {name}! 👋                                           │   │
│  │                                                         │   │
│  │ Thanks for reaching out. How can I help you today?      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [B] [I] [Link] [Emoji]                    {x} Insert Variable  │
│                                                                 │
│  Category                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Greetings                                             ▼ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tags                                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Greeting ×] [Welcome ×] + Add tag                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Visibility                                                     │
│  ○ Personal (only visible to me)                               │
│  ● Team (visible to all agents)                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          [Cancel]  [Save Response]              │
└─────────────────────────────────────────────────────────────────┘
```

### 21.4 Implement Variable Picker

```
┌─────────────────────────────────────────┐
│  Insert Variable                    [×] │
├─────────────────────────────────────────┤
│                                         │
│  Customer Information                   │
│  ─────────────────────                  │
│  {name}         Customer's name         │
│  {firstName}    First name only         │
│  {email}        Email address           │
│                                         │
│  Agent Information                      │
│  ─────────────────                      │
│  {agentName}    Your name               │
│  {agentEmail}   Your email              │
│                                         │
│  Company Information                    │
│  ───────────────────                    │
│  {company}      Company name            │
│  {website}      Company website         │
│                                         │
│  Conversation                           │
│  ────────────                           │
│  {ticketId}     Reference number        │
│                                         │
└─────────────────────────────────────────┘
```

### 21.5 Implement Categories Management

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Categories                                                     │
│  ──────────                                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📁 Greetings                                    (5)    │   │
│  │  📁 Sales                                        (8)    │   │
│  │  📁 Support                                     (12)    │   │
│  │  📁 Technical                                    (6)    │   │
│  │  📁 Closings                                     (4)    │   │
│  │  📁 Follow-up                                    (3)    │   │
│  │  📁 Uncategorized                                (7)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [+ Add Category]                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 21.6 Implement Import/Export

```
┌─────────────────────────────────────────────────────────────────┐
│  Import/Export                                              [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Import Responses                                               │
│  ────────────────                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │      📄 Drop file here or click to browse               │   │
│  │         Supported: CSV, JSON (max 5MB)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Download Template]                                            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Export Responses                                               │
│  ────────────────                                               │
│                                                                 │
│  [Export as CSV]  [Export as JSON]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 21.7 Create Agent Settings Page

**Route:** `src/app/(support-agent)/settings/page.tsx`

**Tabs:**
- Profile
- Notifications
- Chat
- Security

### 21.8 Implement Profile Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Profile Information                                                │
│  ───────────────────                                                │
│                                                                     │
│  Profile Photo                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Current Avatar Preview]                                   │   │
│  │  [Upload New Photo]  [Remove]                               │   │
│  │  JPG, PNG or GIF. Max 2MB.                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Display Name *                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Sarah Johnson                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Email (locked)                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ sarah@acme.com                               [🔒 Locked]    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Job Title                                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Support Agent                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Regional Settings                                                  │
│  ─────────────────                                                  │
│  Timezone: [America/New_York (EST) ▼]                              │
│  Date Format: [MM/DD/YYYY ▼]                                       │
│  Time Format: ○ 12-hour  ● 24-hour                                 │
│  Language: [English (US) ▼]                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.9 Implement Notifications Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Desktop Notifications                                              │
│  ─────────────────────                                              │
│                                                                     │
│  ☑ Enable browser notifications                                    │
│                                                                     │
│  Notify me about:                                                   │
│  ☑ New conversation assigned                                       │
│  ☑ New message in active conversation                              │
│  ☑ Customer waiting too long (>5 min)                              │
│  ☐ All new messages                                                │
│                                                                     │
│  [Test Notification]                                                │
│                                                                     │
│  Sound Notifications                                                │
│  ───────────────────                                                │
│                                                                     │
│  ☑ Play sound for new messages                                     │
│  Notification Sound: [Chime ▼]                                     │
│  Volume: Quiet ─────────●───────────── Loud (50%)                  │
│  [🔊 Preview Sound]                                                 │
│                                                                     │
│  Email Notifications                                                │
│  ───────────────────                                                │
│                                                                     │
│  ☐ Daily summary of activity                                       │
│  ☐ Weekly performance report                                       │
│  ☑ Important system announcements                                  │
│                                                                     │
│  Do Not Disturb                                                     │
│  ───────────────                                                    │
│                                                                     │
│  ☐ Enable Do Not Disturb schedule                                  │
│  Schedule: From [22:00] To [08:00]                                 │
│  During DND: ○ Mute all  ● Show badge only                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.10 Implement Chat Settings Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Chat Behavior                                                      │
│  ──────────────                                                     │
│                                                                     │
│  Max Concurrent Conversations: [5 ▼]                               │
│  ☑ Auto-Accept Assignments                                         │
│                                                                     │
│  Typing & Sending                                                   │
│  ────────────────                                                   │
│                                                                     │
│  Send Message Shortcut:                                             │
│  ● Enter to send, Shift+Enter for new line                         │
│  ○ Cmd+Enter to send, Enter for new line                           │
│                                                                     │
│  ☑ Show typing indicator to customers                              │
│  ☑ Enable emoji auto-complete                                      │
│  ☐ Enable markdown preview                                         │
│                                                                     │
│  Quick Responses                                                    │
│  ───────────────                                                    │
│                                                                     │
│  Default Greeting:                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Hi! I'm {agentName}. How can I help you today?              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ☐ Auto-send greeting when joining conversation                    │
│                                                                     │
│  Default Closing:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Thanks for chatting! Feel free to reach out anytime.        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Appearance                                                         │
│  ──────────                                                         │
│                                                                     │
│  Theme: ○ Light  ○ Dark  ● System                                  │
│  ☐ Use compact message view                                        │
│  Font Size: Small ──────────●───────────── Large (14px)            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.11 Implement Security Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Password                                                           │
│  ────────                                                           │
│                                                                     │
│  Current Password: [••••••••••]                                    │
│  New Password: [                ]                                  │
│  Confirm New Password: [        ]                                  │
│                                                                     │
│  Password Requirements:                                             │
│  ☑ At least 8 characters                                          │
│  ☐ Contains uppercase letter                                       │
│  ☐ Contains lowercase letter                                       │
│  ☐ Contains number                                                 │
│                                                                     │
│  [Update Password]                                                  │
│                                                                     │
│  Two-Factor Authentication                                          │
│  ─────────────────────────                                          │
│                                                                     │
│  Status: ✓ Enabled                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📱 Authenticator App                                       │   │
│  │  Added: January 10, 2024                      [Manage]      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Add Backup Method]                                                │
│                                                                     │
│  Recovery Codes: 8 codes remaining                                  │
│  [View Codes]  [Generate New Codes]                                 │
│                                                                     │
│  Active Sessions                                                    │
│  ───────────────                                                    │
│                                                                     │
│  🖥️ Chrome on macOS           Current                              │
│  📱 Mobile App (iOS)          [Sign Out]                           │
│                                                                     │
│  [Sign Out All Other Sessions]                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.12 Create API Routes

**Canned Responses:**

**`src/app/api/agent/responses/route.ts`:**
- GET: List responses
- POST: Create response

**`src/app/api/agent/responses/[responseId]/route.ts`:**
- GET: Get response
- PATCH: Update response
- DELETE: Delete response

**`src/app/api/agent/responses/[responseId]/favorite/route.ts`:**
- POST: Toggle favorite

**`src/app/api/agent/responses/categories/route.ts`:**
- GET: List categories
- POST: Create category

**`src/app/api/agent/responses/import/route.ts`:**
- POST: Import responses

**`src/app/api/agent/responses/export/route.ts`:**
- GET: Export responses

**Agent Settings:**

**`src/app/api/agent/profile/route.ts`:**
- GET: Get profile
- PATCH: Update profile

**`src/app/api/agent/profile/avatar/route.ts`:**
- POST: Upload avatar
- DELETE: Remove avatar

**`src/app/api/agent/settings/route.ts`:**
- GET: Get all settings
- PATCH: Update settings

**`src/app/api/agent/security/password/route.ts`:**
- POST: Update password

**`src/app/api/agent/security/2fa/route.ts`:**
- GET: Get 2FA status
- POST: Enable 2FA
- DELETE: Disable 2FA

**`src/app/api/agent/security/sessions/route.ts`:**
- GET: List sessions
- DELETE: Sign out session

### 21.13 Create Components

**Canned Responses:**

**`src/components/support-agent/responses/response-list.tsx`:**
- List by category
- Filter tabs
- Search

**`src/components/support-agent/responses/response-card.tsx`:**
- Preview
- Actions menu
- Favorite toggle

**`src/components/support-agent/responses/response-modal.tsx`:**
- Create/edit form
- Variable picker
- Preview

**`src/components/support-agent/responses/variable-picker.tsx`:**
- Variable list
- Insert on click

**`src/components/support-agent/responses/import-export-modal.tsx`:**
- File upload
- Export buttons

**Agent Settings:**

**`src/components/support-agent/settings/profile-tab.tsx`:**
- Avatar upload
- Profile form
- Regional settings

**`src/components/support-agent/settings/notifications-tab.tsx`:**
- Notification toggles
- Sound settings
- DND schedule

**`src/components/support-agent/settings/chat-tab.tsx`:**
- Chat behavior
- Quick responses
- Appearance

**`src/components/support-agent/settings/security-tab.tsx`:**
- Password form
- 2FA management
- Sessions list

---

## Data Models

### Canned Response
```typescript
interface CannedResponse {
  id: string;
  companyId: string;
  createdBy: string;
  title: string;
  shortcut: string;
  content: string;
  category: string;
  tags: string[];
  visibility: 'personal' | 'team';
  isFavorite: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Agent Settings
```typescript
interface AgentSettings {
  userId: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
    jobTitle: string | null;
  };
  regional: {
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    language: string;
  };
  notifications: {
    browserEnabled: boolean;
    notifyNewAssignment: boolean;
    notifyNewMessage: boolean;
    notifyWaitingTooLong: boolean;
    notifyAllMessages: boolean;
    soundEnabled: boolean;
    soundType: string;
    soundVolume: number;
    emailDailySummary: boolean;
    emailWeeklyReport: boolean;
    emailAnnouncements: boolean;
    dndEnabled: boolean;
    dndStart: string;
    dndEnd: string;
    dndMode: 'mute_all' | 'badge_only';
  };
  chat: {
    maxConcurrent: number;
    autoAccept: boolean;
    sendShortcut: 'enter' | 'cmd_enter';
    showTyping: boolean;
    emojiAutocomplete: boolean;
    markdownPreview: boolean;
    defaultGreeting: string;
    autoSendGreeting: boolean;
    defaultClosing: string;
    theme: 'light' | 'dark' | 'system';
    compactMode: boolean;
    fontSize: number;
  };
}
```

---

## Validation Checklist

**Canned Responses:**
- [ ] List responses with categories
- [ ] Create response with shortcut
- [ ] Edit response
- [ ] Delete response
- [ ] Favorite toggle works
- [ ] Search works
- [ ] Filter tabs work
- [ ] Variable insertion works
- [ ] Import/export works

**Settings:**
- [ ] Profile updates save
- [ ] Avatar upload works
- [ ] Notifications toggles save
- [ ] Sound preview works
- [ ] Chat settings save
- [ ] Password update works
- [ ] 2FA setup works
- [ ] Sessions list/logout works

---

## File Structure

```
src/
├── app/
│   ├── (support-agent)/
│   │   ├── responses/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   │
│   └── api/
│       └── agent/
│           ├── responses/
│           │   ├── route.ts
│           │   ├── categories/
│           │   │   └── route.ts
│           │   ├── import/
│           │   │   └── route.ts
│           │   ├── export/
│           │   │   └── route.ts
│           │   └── [responseId]/
│           │       ├── route.ts
│           │       └── favorite/
│           │           └── route.ts
│           ├── profile/
│           │   ├── route.ts
│           │   └── avatar/
│           │       └── route.ts
│           ├── settings/
│           │   └── route.ts
│           └── security/
│               ├── password/
│               │   └── route.ts
│               ├── 2fa/
│               │   └── route.ts
│               └── sessions/
│                   └── route.ts
│
└── components/
    └── support-agent/
        ├── responses/
        │   ├── response-list.tsx
        │   ├── response-card.tsx
        │   ├── response-modal.tsx
        │   ├── variable-picker.tsx
        │   └── import-export-modal.tsx
        └── settings/
            ├── profile-tab.tsx
            ├── notifications-tab.tsx
            ├── chat-tab.tsx
            └── security-tab.tsx
```

---

## Next Step
[Step 22 - AI Agent Framework](./step-22-ai-agent-framework.md)

---

## Related Documentation
- [UI: Canned Responses](../ui/support-agent/04-canned-responses.md)
- [UI: My Settings](../ui/support-agent/05-my-settings.md)
