# Architecture: Realtime & Channel Integrations

## Overview

This document details the architecture for real-time communication and channel integrations. The platform supports multiple messaging channels (WhatsApp, Telegram, Slack, etc.) through a unified webhook system and provides real-time web chat via Server-Sent Events (SSE).

---

## 1. Channel Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CHANNEL INTEGRATION ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL CHANNELS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ WhatsApp │  │ Telegram │  │  Slack   │  │  Teams   │  │ Custom Webhooks  │  │
│  │ Business │  │   Bot    │  │   App    │  │   Bot    │  │                  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │             │             │                  │            │
└───────┼─────────────┼─────────────┼─────────────┼──────────────────┼────────────┘
        │             │             │             │                  │
        ▼             ▼             ▼             ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            WEBHOOK GATEWAY                                       │
│                                                                                  │
│  URL Pattern: /api/webhooks/{company_id}/{agent_id}/{channel}/{webhook_id}      │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        VALIDATION LAYER                                  │   │
│  │  • Signature verification (HMAC-SHA256)                                  │   │
│  │  • Timestamp validation (prevent replay)                                 │   │
│  │  • Rate limiting                                                         │   │
│  │  • Company/Agent existence check                                         │   │
│  │  • Subscription status check                                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                           │
│                                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        MESSAGE NORMALIZER                                │   │
│  │  • Convert channel-specific format to unified format                     │   │
│  │  • Extract: sender, content, attachments, metadata                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE PROCESSOR                                     │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Session      │  │ Agent        │  │ Response     │  │ Channel            │  │
│  │ Management   │─▶│ Execution    │─▶│ Formatting   │─▶│ Sender             │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Webhook URL Structure

### 2.1 URL Pattern

```
https://chat.buzzi.ai/api/webhooks/{company_id}/{agent_id}/{channel}/{webhook_id}

Examples:
├── /api/webhooks/c_abc123/a_xyz789/whatsapp/wh_001
├── /api/webhooks/c_abc123/a_xyz789/telegram/wh_002
├── /api/webhooks/c_abc123/a_xyz789/slack/wh_003
└── /api/webhooks/c_abc123/a_xyz789/custom/wh_004
```

### 2.2 Route Handler

```typescript
// src/app/api/webhooks/[company_id]/[agent_id]/[channel]/[webhook_id]/route.ts

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: {
    company_id: string;
    agent_id: string;
    channel: string;
    webhook_id: string;
  };
}

// GET: Webhook verification (WhatsApp, Messenger)
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { channel } = params;

  switch (channel) {
    case 'whatsapp':
      return handleWhatsAppVerification(req, params);
    case 'messenger':
      return handleMessengerVerification(req, params);
    default:
      return NextResponse.json({ error: 'Not supported' }, { status: 405 });
  }
}

// POST: Incoming messages
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { company_id, agent_id, channel, webhook_id } = params;

  try {
    // 1. Validate webhook configuration
    const config = await validateWebhookConfig(company_id, agent_id, channel, webhook_id);
    if (!config) {
      return NextResponse.json({ error: 'Invalid webhook' }, { status: 404 });
    }

    // 2. Validate signature
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256') ??
                      req.headers.get('x-telegram-bot-api-secret-token') ??
                      req.headers.get('x-slack-signature');

    if (!validateSignature(channel, body, signature, config.webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Check subscription status
    const subscription = await checkSubscription(company_id);
    if (!subscription.valid) {
      // Return appropriate response based on channel
      return handleExpiredSubscription(channel, subscription.message);
    }

    // 4. Parse and normalize message
    const message = await parseChannelMessage(channel, JSON.parse(body));
    if (!message) {
      // Some webhooks are status updates, not messages
      return NextResponse.json({ status: 'ok' });
    }

    // 5. Process message asynchronously
    await processIncomingMessage({
      companyId: company_id,
      agentId: agent_id,
      channel,
      message,
      config,
    });

    // 6. Return immediate acknowledgment
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 3. Channel Adapters

### 3.1 Unified Message Interface

```typescript
// src/services/channels/types.ts

interface UnifiedMessage {
  // Identifiers
  externalId: string;           // Channel-specific message ID
  senderId: string;             // Channel-specific sender ID
  senderName?: string;

  // Content
  content: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';

  // Attachments
  attachments?: Attachment[];

  // Metadata
  timestamp: Date;
  replyToId?: string;           // If replying to a message
  channelMetadata?: Record<string, unknown>;
}

interface Attachment {
  type: 'image' | 'audio' | 'video' | 'document';
  url?: string;
  mediaId?: string;             // Channel-specific media ID
  mimeType: string;
  filename?: string;
  size?: number;
}

interface ChannelAdapter {
  // Parse incoming webhook to unified format
  parseMessage(payload: unknown): Promise<UnifiedMessage | null>;

  // Send response back to channel
  sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void>;

  // Download media from channel
  downloadMedia(config: ChannelConfig, mediaId: string): Promise<Buffer>;

  // Validate webhook signature
  validateSignature(payload: string, signature: string, secret: string): boolean;
}
```

### 3.2 WhatsApp Adapter

```typescript
// src/services/channels/whatsapp.ts

export class WhatsAppAdapter implements ChannelAdapter {
  async parseMessage(payload: WhatsAppWebhook): Promise<UnifiedMessage | null> {
    // Extract message from webhook payload
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Skip status updates
    if (value?.statuses) {
      return null;
    }

    const message = value?.messages?.[0];
    if (!message) {
      return null;
    }

    const contact = value?.contacts?.[0];

    // Handle different message types
    let content = '';
    let contentType: UnifiedMessage['contentType'] = 'text';
    const attachments: Attachment[] = [];

    switch (message.type) {
      case 'text':
        content = message.text.body;
        break;

      case 'image':
        contentType = 'image';
        content = message.image.caption ?? '';
        attachments.push({
          type: 'image',
          mediaId: message.image.id,
          mimeType: message.image.mime_type,
        });
        break;

      case 'audio':
        contentType = 'audio';
        attachments.push({
          type: 'audio',
          mediaId: message.audio.id,
          mimeType: message.audio.mime_type,
        });
        break;

      case 'document':
        contentType = 'document';
        content = message.document.caption ?? '';
        attachments.push({
          type: 'document',
          mediaId: message.document.id,
          mimeType: message.document.mime_type,
          filename: message.document.filename,
        });
        break;

      // ... more types
    }

    return {
      externalId: message.id,
      senderId: message.from,
      senderName: contact?.profile?.name,
      content,
      contentType,
      attachments,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      replyToId: message.context?.id,
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void> {
    const { phoneNumberId, accessToken } = config.credentials;

    await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientId,
          type: 'text',
          text: { body: content },
        }),
      }
    );
  }

  async downloadMedia(config: ChannelConfig, mediaId: string): Promise<Buffer> {
    const { accessToken } = config.credentials;

    // 1. Get media URL
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    const { url } = await mediaResponse.json();

    // 2. Download media
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    return Buffer.from(await response.arrayBuffer());
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }
}
```

### 3.3 Telegram Adapter

```typescript
// src/services/channels/telegram.ts

export class TelegramAdapter implements ChannelAdapter {
  async parseMessage(payload: TelegramUpdate): Promise<UnifiedMessage | null> {
    const message = payload.message ?? payload.edited_message;
    if (!message) {
      return null;
    }

    let content = message.text ?? message.caption ?? '';
    let contentType: UnifiedMessage['contentType'] = 'text';
    const attachments: Attachment[] = [];

    if (message.photo) {
      contentType = 'image';
      const photo = message.photo[message.photo.length - 1]; // Largest size
      attachments.push({
        type: 'image',
        mediaId: photo.file_id,
        mimeType: 'image/jpeg',
      });
    } else if (message.voice) {
      contentType = 'audio';
      attachments.push({
        type: 'audio',
        mediaId: message.voice.file_id,
        mimeType: message.voice.mime_type ?? 'audio/ogg',
      });
    } else if (message.document) {
      contentType = 'document';
      attachments.push({
        type: 'document',
        mediaId: message.document.file_id,
        mimeType: message.document.mime_type ?? 'application/octet-stream',
        filename: message.document.file_name,
      });
    }

    return {
      externalId: message.message_id.toString(),
      senderId: message.from.id.toString(),
      senderName: [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(' '),
      content,
      contentType,
      attachments,
      timestamp: new Date(message.date * 1000),
      replyToId: message.reply_to_message?.message_id?.toString(),
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void> {
    const { botToken } = config.credentials;

    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipientId,
          text: content,
          parse_mode: 'Markdown',
        }),
      }
    );
  }

  async downloadMedia(config: ChannelConfig, mediaId: string): Promise<Buffer> {
    const { botToken } = config.credentials;

    // 1. Get file path
    const fileResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${mediaId}`
    );
    const { result } = await fileResponse.json();

    // 2. Download file
    const response = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${result.file_path}`
    );

    return Buffer.from(await response.arrayBuffer());
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    // Telegram uses secret token in header
    return signature === secret;
  }
}
```

### 3.4 Channel Registry

```typescript
// src/services/channels/registry.ts

const adapters: Record<string, ChannelAdapter> = {
  whatsapp: new WhatsAppAdapter(),
  telegram: new TelegramAdapter(),
  slack: new SlackAdapter(),
  teams: new TeamsAdapter(),
  messenger: new MessengerAdapter(),
  instagram: new InstagramAdapter(),
  custom: new CustomWebhookAdapter(),
};

export function getChannelAdapter(channel: string): ChannelAdapter {
  const adapter = adapters[channel];
  if (!adapter) {
    throw new Error(`Unknown channel: ${channel}`);
  }
  return adapter;
}
```

---

## 4. Web Chat & SSE Streaming

### 4.1 SSE Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SSE STREAMING ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

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
         │                             │  Process message            │
         │                             │────────────────────────────▶│
         │                             │                             │
         │  event: thinking            │◀────────────────────────────│
         │◀════════════════════════════│  Thinking status            │
         │                             │                             │
         │  event: tool_call           │◀────────────────────────────│
         │◀════════════════════════════│  RAG search                 │
         │                             │                             │
         │  event: delta               │◀────────────────────────────│
         │◀════════════════════════════│  Token chunk                │
         │                             │                             │
         │  event: delta               │◀────────────────────────────│
         │◀════════════════════════════│  Token chunk                │
         │                             │                             │
         │  event: complete            │◀────────────────────────────│
         │◀════════════════════════════│  Final response             │
         │                             │                             │
```

### 4.2 SSE Event Types

```typescript
// src/services/streaming/types.ts

type SSEEvent =
  | { event: 'thinking'; data: ThinkingEvent }
  | { event: 'tool_call'; data: ToolCallEvent }
  | { event: 'delta'; data: DeltaEvent }
  | { event: 'complete'; data: CompleteEvent }
  | { event: 'error'; data: ErrorEvent }
  | { event: 'notification'; data: NotificationEvent };

interface ThinkingEvent {
  step: string;
  progress: number; // 0-1
}

interface ToolCallEvent {
  tool: string;
  status: 'executing' | 'completed' | 'failed';
  result?: unknown;
}

interface DeltaEvent {
  content: string;
}

interface CompleteEvent {
  content: string;
  metadata: {
    messageId: string;
    tokens: { input: number; output: number };
    sources?: string[];
    confidence?: number;
  };
}

interface ErrorEvent {
  code: string;
  message: string;
  retryable: boolean;
}

interface NotificationEvent {
  type: 'handover' | 'typing' | 'read';
  data: unknown;
}
```

### 4.3 SSE Endpoint Implementation

```typescript
// src/app/api/chat/[session_id]/stream/route.ts

import { NextRequest } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const { session_id } = params;

  // Validate session
  const session = await validateChatSession(session_id);
  if (!session) {
    return new Response('Invalid session', { status: 401 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to events for this session
      const subscription = await subscribeToSession(session_id);

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30000);

      // Handle events
      subscription.on('event', (event: SSEEvent) => {
        const data = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Close stream on complete or error
        if (event.event === 'complete' || event.event === 'error') {
          clearInterval(heartbeat);
          subscription.unsubscribe();
          controller.close();
        }
      });

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        subscription.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
```

### 4.4 Message Endpoint

```typescript
// src/app/api/chat/[session_id]/message/route.ts

export async function POST(
  req: NextRequest,
  { params }: { params: { session_id: string } }
) {
  const { session_id } = params;
  const { content, attachments } = await req.json();

  // Validate session
  const session = await validateChatSession(session_id);
  if (!session) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Check rate limits
  const rateLimit = await checkRateLimit(session.companyId, session_id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    );
  }

  // Create message record
  const message = await db.insert(messages).values({
    conversationId: session.conversationId,
    role: 'user',
    content,
    attachments: attachments ?? [],
  }).returning();

  // Update conversation
  await db.update(conversations)
    .set({
      messageCount: sql`message_count + 1`,
      lastMessageAt: new Date(),
    })
    .where(eq(conversations.id, session.conversationId));

  // Queue message for processing
  await processMessageQueue.add('process', {
    messageId: message[0].id,
    sessionId: session_id,
    companyId: session.companyId,
    agentId: session.agentId,
    conversationId: session.conversationId,
    content,
    attachments,
  });

  return NextResponse.json({
    messageId: message[0].id,
    status: 'processing',
  });
}
```

---

## 5. Session Management

### 5.1 Chat Session Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CHAT SESSION LIFECYCLE                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

    INIT               ACTIVE              IDLE               CLOSED
     │                    │                  │                   │
     ▼                    ▼                  ▼                   ▼
┌─────────┐         ┌─────────┐        ┌─────────┐         ┌─────────┐
│ Widget  │────────▶│ Message │───────▶│ Timeout │────────▶│ Session │
│ Loaded  │         │ Exchange│        │ (30min) │         │ Ended   │
└─────────┘         └─────────┘        └─────────┘         └─────────┘
     │                    │                  │
     │                    │                  │
     │  Creates session   │  Extends TTL     │  Can resume
     │  token & convo     │  on activity     │  within 24h
```

### 5.2 Session Token Management

```typescript
// src/services/chat/session.ts

interface ChatSession {
  sessionId: string;
  conversationId: string;
  companyId: string;
  agentId: string;
  customerId?: string;
  channel: 'web';
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

export async function createChatSession(
  companyId: string,
  agentId: string,
  customerInfo?: CustomerInfo
): Promise<{ sessionToken: string; session: ChatSession }> {
  // Verify agent is active
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.id, agentId),
      eq(agents.companyId, companyId),
      eq(agents.status, 'active')
    ),
  });

  if (!agent) {
    throw new Error('Agent not found or inactive');
  }

  // Create conversation
  const conversation = await db.insert(conversations).values({
    companyId,
    agentId,
    sessionToken: generateSecureToken(),
    channel: 'web',
    customerId: customerInfo?.id,
    customerName: customerInfo?.name,
    customerEmail: customerInfo?.email,
    status: 'active',
  }).returning();

  // Create session in Redis
  const session: ChatSession = {
    sessionId: conversation[0].sessionToken,
    conversationId: conversation[0].id,
    companyId,
    agentId,
    customerId: customerInfo?.id,
    channel: 'web',
    createdAt: new Date(),
    lastActivityAt: new Date(),
    expiresAt: addMinutes(new Date(), 30),
  };

  await redis.setex(
    `session:${session.sessionId}`,
    1800, // 30 minutes
    JSON.stringify(session)
  );

  return {
    sessionToken: session.sessionId,
    session,
  };
}

export async function validateChatSession(sessionId: string): Promise<ChatSession | null> {
  // Check Redis first
  const cached = await redis.get(`session:${sessionId}`);
  if (cached) {
    const session = JSON.parse(cached) as ChatSession;

    // Extend TTL on access
    await redis.expire(`session:${sessionId}`, 1800);

    return session;
  }

  // Fallback to database for resumed sessions
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.sessionToken, sessionId),
  });

  if (!conversation) {
    return null;
  }

  // Check if session can be resumed (within 24 hours)
  const hoursSinceLastMessage = differenceInHours(
    new Date(),
    conversation.lastMessageAt
  );

  if (hoursSinceLastMessage > 24) {
    return null;
  }

  // Recreate session in Redis
  const session: ChatSession = {
    sessionId,
    conversationId: conversation.id,
    companyId: conversation.companyId,
    agentId: conversation.agentId,
    customerId: conversation.customerId,
    channel: 'web',
    createdAt: conversation.startedAt,
    lastActivityAt: conversation.lastMessageAt,
    expiresAt: addMinutes(new Date(), 30),
  };

  await redis.setex(`session:${sessionId}`, 1800, JSON.stringify(session));

  return session;
}
```

---

## 6. Response Routing

### 6.1 Outbound Message Handler

```typescript
// src/services/channels/sender.ts

export async function sendResponse(
  conversationId: string,
  content: string,
  options?: SendOptions
): Promise<void> {
  // Load conversation with channel config
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      agent: {
        with: {
          channelConfigs: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const { channel, externalId } = conversation;

  // Web channel uses SSE (handled separately)
  if (channel === 'web') {
    return;
  }

  // Get channel adapter and config
  const adapter = getChannelAdapter(channel);
  const config = conversation.agent.channelConfigs.find(
    c => c.channel === channel
  );

  if (!config) {
    throw new Error(`No config for channel: ${channel}`);
  }

  // Send message
  await adapter.sendMessage(config, externalId, content, options);

  // Save outbound message
  await db.insert(messages).values({
    conversationId,
    role: 'assistant',
    content,
  });
}
```

---

## 7. Rate Limiting

### 7.1 Multi-Level Rate Limits

```typescript
// src/services/rate-limit/index.ts

interface RateLimitConfig {
  company: { limit: number; window: number };
  session: { limit: number; window: number };
  ip: { limit: number; window: number };
}

const DEFAULT_LIMITS: RateLimitConfig = {
  company: { limit: 1000, window: 60 },   // 1000 req/min per company
  session: { limit: 30, window: 60 },     // 30 req/min per session
  ip: { limit: 100, window: 60 },         // 100 req/min per IP
};

export async function checkRateLimit(
  companyId: string,
  sessionId: string,
  ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const results = await Promise.all([
    checkLimit(`ratelimit:company:${companyId}`, DEFAULT_LIMITS.company),
    checkLimit(`ratelimit:session:${sessionId}`, DEFAULT_LIMITS.session),
    checkLimit(`ratelimit:ip:${ip}`, DEFAULT_LIMITS.ip),
  ]);

  const blocked = results.find(r => !r.allowed);
  if (blocked) {
    return blocked;
  }

  // Increment counters
  await Promise.all([
    incrementCounter(`ratelimit:company:${companyId}`, DEFAULT_LIMITS.company.window),
    incrementCounter(`ratelimit:session:${sessionId}`, DEFAULT_LIMITS.session.window),
    incrementCounter(`ratelimit:ip:${ip}`, DEFAULT_LIMITS.ip.window),
  ]);

  return { allowed: true };
}

async function checkLimit(
  key: string,
  config: { limit: number; window: number }
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const count = await redis.get(key);
  const current = parseInt(count ?? '0');

  if (current >= config.limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl };
  }

  return { allowed: true };
}
```

---

## 8. Webhook Security

### 8.1 Signature Validation

```typescript
// src/services/webhooks/security.ts

export function validateWebhookSignature(
  channel: string,
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const adapter = getChannelAdapter(channel);
  return adapter.validateSignature(payload, signature, secret);
}

// Timestamp validation to prevent replay attacks
export function validateTimestamp(
  timestamp: string | number,
  maxAge: number = 300 // 5 minutes
): boolean {
  const messageTime = typeof timestamp === 'string'
    ? parseInt(timestamp)
    : timestamp;

  const now = Math.floor(Date.now() / 1000);
  const age = now - messageTime;

  return age >= 0 && age <= maxAge;
}
```

### 8.2 IP Allowlisting (Optional)

```typescript
// For high-security deployments
const CHANNEL_IP_RANGES: Record<string, string[]> = {
  whatsapp: [
    '157.240.0.0/16',   // Meta IP ranges
    '31.13.0.0/16',
    // ... more ranges
  ],
  telegram: [
    '149.154.160.0/20',
    '91.108.4.0/22',
    // ... more ranges
  ],
};

export function validateSourceIP(channel: string, ip: string): boolean {
  const ranges = CHANNEL_IP_RANGES[channel];
  if (!ranges) {
    return true; // No IP restriction for this channel
  }

  return ranges.some(range => ipRangeCheck(ip, range));
}
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Database Schema](./database-schema.md)
- [Chat Widget Architecture](./architecture-chat-widget.md)
- [Requirements Document](./requirement.v2.md)
