# Step 23: Real-time Communication

## Objective
Implement the real-time communication infrastructure including SSE streaming for web chat, channel integrations (WhatsApp, Telegram, Slack, Teams), webhook gateway, session management, and the Human-in-the-Loop (HITL) escalation system.

---

## Prerequisites
- Step 22 completed (AI Agent Framework)
- Step 19-21 completed (Support Agent interface)
- Redis configured for pub/sub
- Database schema with conversations, messages tables

---

## Reference Documents
- [Architecture: Realtime & Channels](../architecture-realtime-channels.md)
- [Architecture: Human-in-the-Loop](../architecture-hitl.md)

---

## Tasks

### 23.1 Implement SSE Streaming Infrastructure

**Architecture:**
```
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   Chat Widget    │          │    Next.js API   │          │   Agent Runner   │
│   (Browser)      │          │    Route         │          │                  │
└────────┬─────────┘          └────────┬─────────┘          └────────┬─────────┘
         │                             │                             │
         │  POST /api/chat/message     │                             │
         │────────────────────────────▶│                             │
         │                             │                             │
         │  GET /api/chat/stream       │                             │
         │  (SSE Connection)           │                             │
         │◀═══════════════════════════▶│                             │
         │                             │                             │
         │  event: thinking            │◀────────────────────────────│
         │◀════════════════════════════│                             │
         │                             │                             │
         │  event: delta               │◀────────────────────────────│
         │◀════════════════════════════│                             │
         │                             │                             │
         │  event: complete            │◀────────────────────────────│
         │◀════════════════════════════│                             │
```

**File:** `src/app/api/chat/[sessionId]/stream/route.ts`

```typescript
export async function GET(req: NextRequest, { params }) {
  const { sessionId } = params;

  // Validate session
  const session = await validateChatSession(sessionId);
  if (!session) {
    return new Response('Invalid session', { status: 401 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to session events
      const subscription = await subscribeToSession(sessionId);

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30000);

      // Handle events
      subscription.on('event', (event) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 23.2 Implement Session Management

**File:** `src/services/chat/session.ts`

**Session Flow:**
```
    INIT               ACTIVE              IDLE               CLOSED
     │                    │                  │                   │
     ▼                    ▼                  ▼                   ▼
┌─────────┐         ┌─────────┐        ┌─────────┐         ┌─────────┐
│ Widget  │────────▶│ Message │───────▶│ Timeout │────────▶│ Session │
│ Loaded  │         │ Exchange│        │ (30min) │         │ Ended   │
└─────────┘         └─────────┘        └─────────┘         └─────────┘
```

**API Routes:**

**`src/app/api/chat/session/route.ts`:**
- POST: Create new chat session

**Session Data:**
```typescript
interface ChatSession {
  sessionId: string;
  conversationId: string;
  companyId: string;
  agentId: string;
  customerId?: string;
  channel: 'web' | 'whatsapp' | 'telegram' | 'slack' | 'teams';
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}
```

### 23.3 Implement Webhook Gateway

**URL Pattern:**
```
/api/webhooks/{company_id}/{agent_id}/{channel}/{webhook_id}
```

**Route:** `src/app/api/webhooks/[companyId]/[agentId]/[channel]/[webhookId]/route.ts`

**Features:**
- Signature verification (HMAC-SHA256)
- Timestamp validation (prevent replay attacks)
- Rate limiting
- Message normalization
- Async message processing

```typescript
export async function POST(req: NextRequest, { params }) {
  const { companyId, agentId, channel, webhookId } = params;

  // 1. Validate webhook configuration
  const config = await validateWebhookConfig(companyId, agentId, channel, webhookId);

  // 2. Validate signature
  const body = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!validateSignature(channel, body, signature, config.webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Parse and normalize message
  const message = await parseChannelMessage(channel, JSON.parse(body));

  // 4. Process message asynchronously
  await processIncomingMessage({ companyId, agentId, channel, message, config });

  // 5. Return immediate acknowledgment
  return NextResponse.json({ status: 'ok' });
}
```

### 23.4 Implement Channel Adapters

**Directory:** `src/services/channels/`

**Unified Message Interface:**
```typescript
interface UnifiedMessage {
  externalId: string;
  senderId: string;
  senderName?: string;
  content: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document';
  attachments?: Attachment[];
  timestamp: Date;
  replyToId?: string;
  channelMetadata?: Record<string, unknown>;
}

interface ChannelAdapter {
  parseMessage(payload: unknown): Promise<UnifiedMessage | null>;
  sendMessage(config: ChannelConfig, recipientId: string, content: string): Promise<void>;
  downloadMedia(config: ChannelConfig, mediaId: string): Promise<Buffer>;
  validateSignature(payload: string, signature: string, secret: string): boolean;
}
```

**Adapters to Implement:**
1. `whatsapp.ts` - WhatsApp Business API
2. `telegram.ts` - Telegram Bot API
3. `slack.ts` - Slack Events API
4. `teams.ts` - Microsoft Teams Bot Framework
5. `messenger.ts` - Facebook Messenger
6. `custom.ts` - Custom webhook adapter

### 23.5 Implement WhatsApp Adapter

**File:** `src/services/channels/whatsapp.ts`

**Features:**
- Message parsing (text, image, audio, document, location)
- Media download from WhatsApp CDN
- Outbound message sending
- Webhook verification
- Template message support

### 23.6 Implement Telegram Adapter

**File:** `src/services/channels/telegram.ts`

**Features:**
- Message parsing
- Bot commands handling
- Inline keyboards
- Media handling
- Webhook setup

### 23.7 Implement Slack Adapter

**File:** `src/services/channels/slack.ts`

**Features:**
- Events API integration
- Interactive messages
- Slash commands
- Channel/DM support
- Thread replies

### 23.8 Implement Human-in-the-Loop (HITL) System

**Escalation Triggers:**
```typescript
interface EscalationRules {
  // Keyword-based triggers
  keywords: {
    enabled: boolean;
    words: string[];  // ['refund', 'lawsuit', 'urgent']
  };

  // Sentiment-based triggers
  sentiment: {
    enabled: boolean;
    threshold: number;  // -1 to 1
    consecutiveMessages: number;
  };

  // Confidence-based triggers
  confidence: {
    enabled: boolean;
    threshold: number;  // 0 to 1
  };

  // Explicit request
  explicitRequest: {
    enabled: boolean;
    phrases: string[];  // ['talk to human', 'real person']
  };

  // Conversation length
  conversationLength: {
    enabled: boolean;
    maxMessages: number;
  };
}
```

**Escalation Detector:** `src/services/escalation/detector.ts`

**Handover Service:** `src/services/handover/service.ts`
- `initiateEscalation()` - Start escalation process
- `assignToAgent()` - Assign to human agent
- `handBackToAI()` - Return to AI handling

### 23.9 Implement Conversation State Machine

```
┌───────────────────┐
│      ACTIVE       │  (AI handling)
│                   │
└─────────┬─────────┘
          │
          ├─────────────────────┬─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  WAITING_HUMAN   │  │    RESOLVED      │  │    ABANDONED     │
│  (In queue)      │  │  (Completed)     │  │  (Timeout)       │
└────────┬─────────┘  └──────────────────┘  └──────────────────┘
         │
         │ Agent accepts
         ▼
┌──────────────────┐
│   WITH_HUMAN     │  (Human agent active)
│                  │
└────────┬─────────┘
         │
         ├─────────────────────┐
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│  Hand back to AI │  │   RESOLVED       │
│  (Return ACTIVE) │  │  (Completed)     │
└──────────────────┘  └──────────────────┘
```

### 23.10 Implement AI Co-pilot Mode

**File:** `src/services/copilot/service.ts`

**Features:**
- Real-time suggestion generation
- Knowledge base-backed responses
- Multiple suggestion options
- Confidence scoring
- Source citation

```typescript
interface CopilotSuggestion {
  text: string;
  confidence: number;
  sources: string[];
}

export class CopilotService {
  async generateSuggestion(conversationId: string): Promise<CopilotSuggestion[]>;
  async streamSuggestion(conversationId: string): AsyncGenerator<string>;
}
```

### 23.11 Implement Real-time Notifications

**File:** `src/services/notifications/realtime.ts`

**Notification Types:**
```typescript
type AgentNotification =
  | { type: 'new_escalation'; escalation: Escalation }
  | { type: 'new_message'; conversationId: string; message: Message }
  | { type: 'queue_update'; queue: QueueStats }
  | { type: 'customer_typing'; conversationId: string }
  | { type: 'assignment'; conversationId: string };
```

**Pub/Sub Channels:**
- `agent:{agentId}:notifications` - Agent-specific notifications
- `agent:{agentId}:conversations` - Conversation updates
- `conversation:{conversationId}:events` - Real-time conversation events
- `company:{companyId}:queue` - Queue updates

### 23.12 Implement Rate Limiting

**File:** `src/services/rate-limit/index.ts`

**Multi-level Rate Limits:**
```typescript
const DEFAULT_LIMITS = {
  company: { limit: 1000, window: 60 },   // 1000 req/min per company
  session: { limit: 30, window: 60 },     // 30 req/min per session
  ip: { limit: 100, window: 60 },         // 100 req/min per IP
};
```

---

## API Routes

### Chat Session API
```
src/app/api/
├── chat/
│   ├── session/
│   │   └── route.ts              # POST: Create session
│   └── [sessionId]/
│       ├── message/
│       │   └── route.ts          # POST: Send message
│       ├── stream/
│       │   └── route.ts          # GET: SSE stream
│       └── typing/
│           └── route.ts          # POST: Typing indicator
```

### Webhook Gateway
```
src/app/api/
└── webhooks/
    └── [companyId]/
        └── [agentId]/
            └── [channel]/
                └── [webhookId]/
                    └── route.ts  # GET/POST: Webhook handler
```

### Agent Real-time API
```
src/app/api/
└── agent/
    ├── stream/
    │   └── route.ts              # GET: SSE for agent inbox
    └── conversations/
        └── [conversationId]/
            ├── send/
            │   └── route.ts      # POST: Send message as agent
            ├── typing/
            │   └── route.ts      # POST: Agent typing indicator
            └── handover/
                └── route.ts      # POST: Handover to AI/agent
```

---

## File Structure

```
src/
├── services/
│   ├── channels/
│   │   ├── index.ts              # Channel registry
│   │   ├── types.ts              # Unified message types
│   │   ├── whatsapp.ts           # WhatsApp adapter
│   │   ├── telegram.ts           # Telegram adapter
│   │   ├── slack.ts              # Slack adapter
│   │   ├── teams.ts              # Teams adapter
│   │   ├── messenger.ts          # Facebook Messenger adapter
│   │   └── custom.ts             # Custom webhook adapter
│   │
│   ├── chat/
│   │   ├── session.ts            # Session management
│   │   ├── message-handler.ts    # Message processing
│   │   └── typing.ts             # Typing indicators
│   │
│   ├── escalation/
│   │   ├── detector.ts           # Escalation detection
│   │   ├── rules.ts              # Escalation rules
│   │   └── types.ts              # Types
│   │
│   ├── handover/
│   │   ├── service.ts            # Handover management
│   │   └── queue.ts              # Queue management
│   │
│   ├── copilot/
│   │   └── service.ts            # AI co-pilot suggestions
│   │
│   ├── notifications/
│   │   ├── realtime.ts           # Real-time notifications
│   │   └── push.ts               # Push notifications
│   │
│   └── rate-limit/
│       └── index.ts              # Rate limiting
│
└── app/
    └── api/
        ├── chat/
        │   ├── session/
        │   │   └── route.ts
        │   └── [sessionId]/
        │       ├── message/
        │       │   └── route.ts
        │       ├── stream/
        │       │   └── route.ts
        │       └── typing/
        │           └── route.ts
        │
        ├── webhooks/
        │   └── [companyId]/
        │       └── [agentId]/
        │           └── [channel]/
        │               └── [webhookId]/
        │                   └── route.ts
        │
        └── agent/
            ├── stream/
            │   └── route.ts
            └── conversations/
                └── [conversationId]/
                    ├── send/
                    │   └── route.ts
                    ├── typing/
                    │   └── route.ts
                    └── handover/
                        └── route.ts
```

---

## Validation Checklist

- [ ] SSE streaming works reliably
- [ ] Session creation and validation works
- [ ] Webhook signature verification works
- [ ] WhatsApp integration sends/receives messages
- [ ] Telegram integration works
- [ ] Slack integration works
- [ ] Escalation detection triggers correctly
- [ ] Human handover flow works end-to-end
- [ ] AI co-pilot generates useful suggestions
- [ ] Real-time notifications reach agents
- [ ] Rate limiting prevents abuse
- [ ] Conversation state transitions correctly

---

## Next Step
[Step 24 - Chat Widget Development](./step-24-chat-widget.md)

---

## Related Documentation
- [Architecture: Realtime & Channels](../architecture-realtime-channels.md)
- [Architecture: Human-in-the-Loop](../architecture-hitl.md)
- [Step 19 - Support Agent Inbox](./step-19-support-inbox.md)
