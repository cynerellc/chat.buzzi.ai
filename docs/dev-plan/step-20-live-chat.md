# Step 20: Support Agent - Live Chat

## Objective
Implement the real-time live chat interface for support agents to communicate with customers, view AI summaries, and manage conversation flow.

---

## Prerequisites
- Step 19 completed
- Real-time communication infrastructure
- Message history in database

---

## Reference Documents
- [UI: Live Chat](../ui/support-agent/02-live-chat.md)

---

## Tasks

### 20.1 Create Live Chat Page

**Route:** `src/app/(support-agent)/inbox/[conversationId]/page.tsx`

**Layout:**
```
┌────────────────┬────────────────────────────────┬────────────────────────┐
│                │                                │                        │
│  Conversations │  Chat Messages                 │  Customer Info Panel   │
│  ─────────────│                                │                        │
│  [Mini-list]  │  [Message Thread]              │  [Customer Details]    │
│               │                                │  [AI Summary]          │
│               │  [Input Area]                  │  [Quick Actions]       │
│               │                                │                        │
│               │  [Action Bar]                  │                        │
│               │                                │                        │
└────────────────┴────────────────────────────────┴────────────────────────┘
```

### 20.2 Implement Conversation Header

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  John Doe                                          [⭐] [⋮]     │
│  ● Online • Started 10 minutes ago                              │
│  Via: Website Widget                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Header More Menu (⋮):**
- View Customer Profile
- View Conversation History
- Transfer to Agent
- Return to AI
- Add Tag
- Add Note
- Mark as Spam
- Block Customer

### 20.3 Implement Message Types

**AI Bot Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Sales Bot                                                   │
│                                                                 │
│  Hi! I'm your sales assistant. How can I help you today?       │
│                                                                 │
│  [Quick Reply 1] [Quick Reply 2]                                │
│                                                                 │
│                                                    10:30 AM     │
└─────────────────────────────────────────────────────────────────┘
```

**Customer Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                    [Avatar] 👤   │
│                                                                 │
│                    I need help choosing a plan for my team      │
│                                                                 │
│                                                    10:31 AM     │
└─────────────────────────────────────────────────────────────────┘
```

**Agent Message (You):**
```
┌─────────────────────────────────────────────────────────────────┐
│  👤 You                                                         │
│                                                                 │
│  Hi John, I'm Sarah from sales. I can help you find the        │
│  perfect plan for your team.                                    │
│                                                                 │
│                                           10:33 AM  ✓✓ Read    │
└─────────────────────────────────────────────────────────────────┘
```

**System Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ─────────────── You joined the conversation ──────────────    │
│                                                    10:33 AM     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Message with Attachment:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                    [Avatar] 👤   │
│                                                                 │
│                    Here's a screenshot of the error             │
│                                                                 │
│                    ┌─────────────────────────┐                  │
│                    │  [📷 Image Preview]     │                  │
│                    │  screenshot.png         │                  │
│                    │  245 KB                 │                  │
│                    └─────────────────────────┘                  │
│                                                                 │
│                                                    10:35 AM     │
└─────────────────────────────────────────────────────────────────┘
```

### 20.4 Implement Message Input Area

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [📎] [😊] Type a message...                      [⌘] [Send]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Toolbar:**
- 📎 Attach file
- 😊 Emoji picker
- ⌘ Canned responses
- Send button

### 20.5 Implement Customer Info Panel

```
┌─────────────────────────────────────────┐
│  Customer Info                      [×] │
├─────────────────────────────────────────┤
│                                         │
│           [Avatar]                      │
│           John Doe                      │
│           john@example.com              │
│           +1 (555) 123-4567             │
│                                         │
│  🏷️ [VIP] [Sales Lead]                  │
│                                         │
│  [View Full Profile]                    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  AI Summary                             │
│  ───────────                            │
│  Customer is looking for a team plan.   │
│  Has 10 employees. Interested in        │
│  Professional tier. Budget-conscious.   │
│                                         │
│  Sentiment: 😊 Positive                 │
│  Intent: Product Selection              │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Knowledge Used                         │
│  ──────────────                         │
│  📄 Pricing Guide                       │
│  📄 Team Plans Overview                 │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Quick Actions                          │
│  ─────────────                          │
│  [📧 Send Pricing PDF]                  │
│  [📅 Schedule Demo]                     │
│  [🎫 Create Support Ticket]             │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Previous Conversations                 │
│  ──────────────────────                 │
│  Jan 15 - Pricing inquiry (Resolved)    │
│  Jan 10 - Account question (Resolved)   │
│                                         │
└─────────────────────────────────────────┘
```

### 20.6 Implement Typing Indicators

**Customer Typing:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  John is typing...                                              │
│  ●●●                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Read Receipts:**
- ✓ Sent
- ✓✓ Delivered
- ✓✓ (blue) Read

### 20.7 Implement Action Bar

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [🤖 Return to AI]   [📝 Add Note]   [✓ Resolve]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 20.8 Implement Add Note Modal

```
┌─────────────────────────────────────────┐
│  Add Internal Note                  [×] │
├─────────────────────────────────────────┤
│                                         │
│  This note is only visible to your      │
│  team, not the customer.                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Customer interested in Pro plan │    │
│  │ for 10 users. Will follow up    │    │
│  │ with discount offer.            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ☑ Pin to conversation                 │
│                                         │
├─────────────────────────────────────────┤
│                [Cancel]  [Add Note]     │
└─────────────────────────────────────────┘
```

### 20.9 Implement Resolve Conversation Modal

```
┌─────────────────────────────────────────┐
│  Resolve Conversation               [×] │
├─────────────────────────────────────────┤
│                                         │
│  Resolution Status                      │
│  ○ Resolved - Issue fixed              │
│  ● Resolved - Customer satisfied       │
│  ○ Unresolved - Customer left          │
│  ○ Spam/Invalid                        │
│                                         │
│  Send closing message:                  │
│  ☑ Enabled                             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Thanks for chatting with us!    │    │
│  │ If you have more questions,     │    │
│  │ feel free to reach out.         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ☑ Send satisfaction survey            │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel]  [Resolve]        │
└─────────────────────────────────────────┘
```

### 20.10 Implement Transfer Modal

```
┌─────────────────────────────────────────┐
│  Transfer Conversation              [×] │
├─────────────────────────────────────────┤
│                                         │
│  Select Agent                           │
│                                         │
│  Online Agents                          │
│  ┌─────────────────────────────────┐    │
│  │ ● Bob Wilson (2/5 active)      ○ │   │
│  │ ● Alice Chen (3/5 active)      ○ │   │
│  └─────────────────────────────────┘    │
│                                         │
│  Away                                   │
│  ┌─────────────────────────────────┐    │
│  │ ○ Tom Harris (Unavailable)     ○ │   │
│  └─────────────────────────────────┘    │
│                                         │
│  Transfer Note (visible to agent)       │
│  ┌─────────────────────────────────┐    │
│  │ Customer needs technical help   │    │
│  │ with API integration.           │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│             [Cancel]  [Transfer]        │
└─────────────────────────────────────────┘
```

### 20.11 Implement Canned Responses Picker

```
┌─────────────────────────────────────────────────────────────────┐
│  Canned Responses                                           [×] │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Search responses...                                         │
│                                                                 │
│  Recently Used                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /greeting - Welcome greeting                           │   │
│  │  Hi {name}! Thanks for reaching out. How can I help?    │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /pricing - Pricing information                         │   │
│  │  Our pricing starts at $49/month. Would you like...     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Categories                                                     │
│  [All] [Greetings] [Sales] [Support] [Closings]                │
│                                                                 │
│  [View All Responses →]                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 20.12 Create Live Chat API Routes

**`src/app/api/agent/conversations/[conversationId]/route.ts`:**
- GET: Get conversation with messages

**`src/app/api/agent/conversations/[conversationId]/messages/route.ts`:**
- GET: List messages (paginated)
- POST: Send message

**`src/app/api/agent/conversations/[conversationId]/notes/route.ts`:**
- GET: List notes
- POST: Add note

**`src/app/api/agent/conversations/[conversationId]/resolve/route.ts`:**
- POST: Resolve conversation

**`src/app/api/agent/conversations/[conversationId]/transfer/route.ts`:**
- POST: Transfer to agent or AI

**`src/app/api/agent/conversations/[conversationId]/typing/route.ts`:**
- POST: Send typing indicator

**`src/app/api/agent/conversations/[conversationId]/read/route.ts`:**
- POST: Mark messages as read

### 20.13 Create Live Chat Components

**`src/components/support-agent/chat/chat-container.tsx`:**
- Main chat layout
- Message thread
- Input area

**`src/components/support-agent/chat/message-thread.tsx`:**
- Scrollable message list
- Auto-scroll on new message
- Load more (infinite scroll up)

**`src/components/support-agent/chat/message-bubble.tsx`:**
- Different styles for sender type
- Timestamp
- Read receipts

**`src/components/support-agent/chat/message-input.tsx`:**
- Text input
- Toolbar buttons
- Send button

**`src/components/support-agent/chat/customer-info-panel.tsx`:**
- Customer details
- AI summary
- Quick actions
- History

**`src/components/support-agent/chat/typing-indicator.tsx`:**
- Animated dots
- Customer name

**`src/components/support-agent/chat/emoji-picker.tsx`:**
- Emoji categories
- Search
- Recent emojis

**`src/components/support-agent/chat/attachment-picker.tsx`:**
- File upload
- Image preview
- Knowledge files

**`src/components/support-agent/chat/canned-responses-picker.tsx`:**
- Search
- Categories
- Recent
- Insert

**`src/components/support-agent/chat/resolve-modal.tsx`:**
- Resolution status
- Closing message
- Survey option

**`src/components/support-agent/chat/transfer-modal.tsx`:**
- Agent list
- Transfer note

**`src/components/support-agent/chat/note-modal.tsx`:**
- Note input
- Pin option

---

## Data Models

### Chat Message
```typescript
interface ChatMessage {
  id: string;
  conversationId: string;
  sender: {
    type: 'customer' | 'ai_agent' | 'human_agent' | 'system';
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  content: string;
  contentType: 'text' | 'image' | 'file' | 'quick_reply';
  attachments: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  metadata: {
    quickReplies?: string[];
    knowledgeSource?: string;
  };
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: Date;
}
```

### Conversation Note
```typescript
interface ConversationNote {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
}
```

### AI Summary
```typescript
interface AISummary {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  knowledgeUsed: {
    id: string;
    title: string;
  }[];
  suggestedActions: string[];
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Cmd+K` | Canned responses |
| `Cmd+E` | Emoji picker |
| `Cmd+Shift+A` | Attach file |
| `Esc` | Back to inbox |

---

## Validation Checklist

- [ ] Message thread loads correctly
- [ ] Messages send in real-time
- [ ] Typing indicators work
- [ ] Read receipts update
- [ ] Attachments upload/display
- [ ] Emoji picker works
- [ ] Canned responses insert
- [ ] Customer info displays
- [ ] AI summary shows
- [ ] Notes add/display
- [ ] Resolve works
- [ ] Transfer works
- [ ] Return to AI works

---

## File Structure

```
src/
├── app/
│   ├── (support-agent)/
│   │   └── inbox/
│   │       └── [conversationId]/
│   │           └── page.tsx
│   │
│   └── api/
│       └── agent/
│           └── conversations/
│               └── [conversationId]/
│                   ├── route.ts
│                   ├── messages/
│                   │   └── route.ts
│                   ├── notes/
│                   │   └── route.ts
│                   ├── resolve/
│                   │   └── route.ts
│                   ├── transfer/
│                   │   └── route.ts
│                   ├── typing/
│                   │   └── route.ts
│                   └── read/
│                       └── route.ts
│
└── components/
    └── support-agent/
        └── chat/
            ├── chat-container.tsx
            ├── message-thread.tsx
            ├── message-bubble.tsx
            ├── message-input.tsx
            ├── customer-info-panel.tsx
            ├── typing-indicator.tsx
            ├── emoji-picker.tsx
            ├── attachment-picker.tsx
            ├── canned-responses-picker.tsx
            ├── resolve-modal.tsx
            ├── transfer-modal.tsx
            └── note-modal.tsx
```

---

## Next Step
[Step 21 - Support Agent Profile & Responses](./step-21-profile-responses.md)

---

## Related Documentation
- [UI: Live Chat](../ui/support-agent/02-live-chat.md)
- [Step 23 - Real-time Communication](./step-23-realtime.md)
