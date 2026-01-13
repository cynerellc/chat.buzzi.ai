# Architecture: Human-in-the-Loop (HITL)

## Overview

This document details the Human-in-the-Loop (HITL) architecture that enables seamless handover between AI agents and human support staff. The system supports escalation triggers, real-time notifications, co-pilot mode, and complete conversation continuity.

---

## 1. HITL Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         HUMAN-IN-THE-LOOP ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌───────────────────┐
                              │    Customer       │
                              │    (Widget/App)   │
                              └─────────┬─────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CONVERSATION ROUTER                                   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     is_human_agent = false                               │   │
│  │                     ─────────────────────                                │   │
│  │                              │                                           │   │
│  │                   ┌──────────┴──────────┐                               │   │
│  │                   │                      │                               │   │
│  │                   ▼                      ▼                               │   │
│  │        ┌──────────────────┐   ┌──────────────────┐                      │   │
│  │        │    AI Agent      │   │  Escalation      │                      │   │
│  │        │    Processing    │──▶│  Detector        │                      │   │
│  │        └──────────────────┘   └────────┬─────────┘                      │   │
│  │                                         │                                │   │
│  │                              ┌──────────┴──────────┐                    │   │
│  │                              │  Trigger Detected?  │                    │   │
│  │                              └──────────┬──────────┘                    │   │
│  │                                         │                                │   │
│  │                          Yes ┌──────────┴──────────┐ No                 │   │
│  │                              ▼                      ▼                    │   │
│  │                   ┌──────────────────┐   ┌──────────────────┐           │   │
│  │                   │  Queue for       │   │  Send AI         │           │   │
│  │                   │  Human Agent     │   │  Response        │           │   │
│  │                   └──────────────────┘   └──────────────────┘           │   │
│  │                              │                                           │   │
│  └──────────────────────────────┼───────────────────────────────────────────┘   │
│                                 │                                               │
│  ┌──────────────────────────────┼───────────────────────────────────────────┐   │
│  │                     is_human_agent = true                                │   │
│  │                     ────────────────────                                 │   │
│  │                              │                                           │   │
│  │                              ▼                                           │   │
│  │                   ┌──────────────────┐                                   │   │
│  │                   │  Human Support   │                                   │   │
│  │                   │  Agent Inbox     │                                   │   │
│  │                   └──────────────────┘                                   │   │
│  │                              │                                           │   │
│  │           ┌──────────────────┼──────────────────┐                       │   │
│  │           ▼                  ▼                   ▼                       │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │   │
│  │  │ Direct Response │ │ AI Co-pilot     │ │ Handover to AI  │            │   │
│  │  │                 │ │ Suggestions     │ │                 │            │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘            │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Escalation Triggers

### 2.1 Trigger Types

```typescript
// src/services/escalation/types.ts

interface EscalationRules {
  // Keyword-based triggers
  keywords: {
    enabled: boolean;
    words: string[];
    caseSensitive: boolean;
  };

  // Sentiment-based triggers
  sentiment: {
    enabled: boolean;
    threshold: number;  // -1 to 1, trigger if below
    consecutiveMessages: number;
  };

  // Confidence-based triggers
  confidence: {
    enabled: boolean;
    threshold: number;  // 0 to 1, trigger if below
  };

  // Explicit request
  explicitRequest: {
    enabled: boolean;
    phrases: string[];  // "talk to human", "speak to agent"
  };

  // Time/count based
  conversationLength: {
    enabled: boolean;
    maxMessages: number;  // Escalate after N messages without resolution
  };

  // Business rules
  customRules: CustomRule[];
}

interface CustomRule {
  name: string;
  condition: string;  // JSON logic or simple expression
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// Default rules
const DEFAULT_ESCALATION_RULES: EscalationRules = {
  keywords: {
    enabled: true,
    words: ['refund', 'cancel', 'lawsuit', 'lawyer', 'urgent', 'emergency'],
    caseSensitive: false,
  },
  sentiment: {
    enabled: true,
    threshold: -0.5,
    consecutiveMessages: 2,
  },
  confidence: {
    enabled: true,
    threshold: 0.3,
  },
  explicitRequest: {
    enabled: true,
    phrases: [
      'talk to human',
      'speak to agent',
      'real person',
      'human agent',
      'customer service',
      'representative',
    ],
  },
  conversationLength: {
    enabled: true,
    maxMessages: 10,
  },
  customRules: [],
};
```

### 2.2 Escalation Detector

```typescript
// src/services/escalation/detector.ts

interface EscalationResult {
  shouldEscalate: boolean;
  reason?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  triggers: string[];
}

export class EscalationDetector {
  constructor(private rules: EscalationRules) {}

  async detect(
    message: string,
    context: ConversationContext
  ): Promise<EscalationResult> {
    const triggers: string[] = [];
    let maxPriority: EscalationResult['priority'] = 'low';

    // 1. Check explicit request
    if (this.rules.explicitRequest.enabled) {
      const match = this.checkExplicitRequest(message);
      if (match) {
        triggers.push(`explicit_request:${match}`);
        maxPriority = 'high';
      }
    }

    // 2. Check keywords
    if (this.rules.keywords.enabled) {
      const keywords = this.checkKeywords(message);
      if (keywords.length > 0) {
        triggers.push(...keywords.map(k => `keyword:${k}`));
        maxPriority = this.upgradePriority(maxPriority, 'medium');
      }
    }

    // 3. Check sentiment
    if (this.rules.sentiment.enabled) {
      const sentiment = await this.analyzeSentiment(message);
      if (this.checkSentimentTrigger(sentiment, context)) {
        triggers.push(`sentiment:${sentiment.toFixed(2)}`);
        maxPriority = this.upgradePriority(maxPriority, 'medium');
      }
    }

    // 4. Check AI confidence (from last response)
    if (this.rules.confidence.enabled && context.lastAiConfidence !== undefined) {
      if (context.lastAiConfidence < this.rules.confidence.threshold) {
        triggers.push(`low_confidence:${context.lastAiConfidence.toFixed(2)}`);
        maxPriority = this.upgradePriority(maxPriority, 'low');
      }
    }

    // 5. Check conversation length
    if (this.rules.conversationLength.enabled) {
      if (context.messageCount >= this.rules.conversationLength.maxMessages) {
        triggers.push(`long_conversation:${context.messageCount}`);
        maxPriority = this.upgradePriority(maxPriority, 'low');
      }
    }

    // 6. Check custom rules
    for (const rule of this.rules.customRules) {
      if (this.evaluateCustomRule(rule, message, context)) {
        triggers.push(`custom:${rule.name}`);
        maxPriority = this.upgradePriority(maxPriority, rule.priority);
      }
    }

    return {
      shouldEscalate: triggers.length > 0,
      reason: triggers.length > 0 ? triggers.join(', ') : undefined,
      priority: maxPriority,
      triggers,
    };
  }

  private checkExplicitRequest(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    for (const phrase of this.rules.explicitRequest.phrases) {
      if (lowerMessage.includes(phrase.toLowerCase())) {
        return phrase;
      }
    }
    return null;
  }

  private checkKeywords(message: string): string[] {
    const found: string[] = [];
    const processedMessage = this.rules.keywords.caseSensitive
      ? message
      : message.toLowerCase();

    for (const word of this.rules.keywords.words) {
      const processedWord = this.rules.keywords.caseSensitive
        ? word
        : word.toLowerCase();

      if (processedMessage.includes(processedWord)) {
        found.push(word);
      }
    }
    return found;
  }

  private async analyzeSentiment(message: string): Promise<number> {
    // Use sentiment analysis model
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Analyze the sentiment of the following message. Return only a number between -1 (very negative) and 1 (very positive).',
        },
        { role: 'user', content: message },
      ],
      temperature: 0,
    });

    return parseFloat(response.choices[0].message.content ?? '0');
  }

  private checkSentimentTrigger(
    currentSentiment: number,
    context: ConversationContext
  ): boolean {
    if (currentSentiment >= this.rules.sentiment.threshold) {
      return false;
    }

    // Check consecutive negative messages
    const recentSentiments = context.recentSentiments ?? [];
    const negativeSentiments = [...recentSentiments, currentSentiment]
      .slice(-this.rules.sentiment.consecutiveMessages)
      .filter(s => s < this.rules.sentiment.threshold);

    return negativeSentiments.length >= this.rules.sentiment.consecutiveMessages;
  }
}
```

---

## 3. Handover Flow

### 3.1 State Transitions

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONVERSATION STATE MACHINE                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌───────────────────┐
                              │      ACTIVE       │
                              │  (AI handling)    │
                              └─────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │  WAITING_HUMAN   │ │    RESOLVED      │ │    ABANDONED     │
         │  (In queue)      │ │  (Completed)     │ │  (Timeout)       │
         └────────┬─────────┘ └──────────────────┘ └──────────────────┘
                  │
                  │ Agent accepts
                  ▼
         ┌──────────────────┐
         │   WITH_HUMAN     │
         │  (Agent active)  │
         └────────┬─────────┘
                  │
         ┌────────┴─────────┐
         │                  │
         ▼                  ▼
┌──────────────────┐ ┌──────────────────┐
│  Hand back to AI │ │   RESOLVED       │
│  (Return ACTIVE) │ │  (Completed)     │
└──────────────────┘ └──────────────────┘
```

### 3.2 Handover Service

```typescript
// src/services/handover/service.ts

export class HandoverService {
  async initiateEscalation(
    conversationId: string,
    reason: string,
    priority: string
  ): Promise<void> {
    // 1. Update conversation status
    await db.update(conversations)
      .set({
        status: 'waiting_human',
        isHumanAgent: false,  // Not yet assigned
      })
      .where(eq(conversations.id, conversationId));

    // 2. Create escalation record
    const escalation = await db.insert(escalations).values({
      conversationId,
      reason,
      priority,
      status: 'pending',
      createdAt: new Date(),
    }).returning();

    // 3. Find available agents
    const availableAgents = await this.findAvailableAgents(conversationId);

    // 4. Send notifications
    await this.notifyAgents(availableAgents, escalation[0]);

    // 5. Send customer notification
    await this.notifyCustomer(conversationId, {
      type: 'escalation_started',
      message: 'Connecting you with a support agent...',
      estimatedWait: await this.estimateWaitTime(conversationId),
    });
  }

  async assignToAgent(
    conversationId: string,
    agentUserId: string
  ): Promise<void> {
    // 1. Verify agent can handle this conversation
    const canHandle = await this.verifyAgentAccess(conversationId, agentUserId);
    if (!canHandle) {
      throw new Error('Agent does not have access to this conversation');
    }

    // 2. Update conversation
    await db.update(conversations)
      .set({
        status: 'with_human',
        isHumanAgent: true,
        assignedAgentId: agentUserId,
      })
      .where(eq(conversations.id, conversationId));

    // 3. Update escalation
    await db.update(escalations)
      .set({
        status: 'assigned',
        assignedTo: agentUserId,
        assignedAt: new Date(),
      })
      .where(eq(escalations.conversationId, conversationId));

    // 4. Notify customer
    const agent = await db.query.users.findFirst({
      where: eq(users.id, agentUserId),
    });

    await this.notifyCustomer(conversationId, {
      type: 'agent_joined',
      message: `${agent?.name ?? 'A support agent'} has joined the conversation.`,
      agentName: agent?.name,
      agentAvatar: agent?.avatarUrl,
    });

    // 5. Log event
    await this.logHandoverEvent(conversationId, 'assigned', { agentUserId });
  }

  async handBackToAI(
    conversationId: string,
    agentUserId: string,
    summary?: string
  ): Promise<void> {
    // 1. Verify current agent
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (conversation?.assignedAgentId !== agentUserId) {
      throw new Error('Not assigned to this conversation');
    }

    // 2. Add handover summary as context
    if (summary) {
      await db.insert(messages).values({
        conversationId,
        role: 'system',
        content: `[Agent Handover Summary] ${summary}`,
      });
    }

    // 3. Update conversation
    await db.update(conversations)
      .set({
        status: 'active',
        isHumanAgent: false,
        assignedAgentId: null,
      })
      .where(eq(conversations.id, conversationId));

    // 4. Update escalation
    await db.update(escalations)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolution: 'handed_back',
      })
      .where(eq(escalations.conversationId, conversationId));

    // 5. Notify customer
    await this.notifyCustomer(conversationId, {
      type: 'ai_resumed',
      message: 'You are now chatting with our AI assistant.',
    });
  }

  private async findAvailableAgents(conversationId: string): Promise<User[]> {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      return [];
    }

    // Find support agents in the company who have access to this agent
    const agents = await db.query.users.findMany({
      where: and(
        eq(users.companyId, conversation.companyId),
        eq(users.role, 'support_agent'),
        eq(users.isActive, true)
      ),
    });

    // Filter by agent-specific permissions
    return agents.filter(agent => {
      const permissions = agent.permissions as UserPermissions;
      const agentAccess = permissions?.agents?.[conversation.agentId];
      return agentAccess?.includes('read');
    });
  }

  private async notifyAgents(agents: User[], escalation: Escalation): Promise<void> {
    // Real-time notification via WebSocket/SSE
    for (const agent of agents) {
      await pubsub.publish(`agent:${agent.id}:notifications`, {
        type: 'new_escalation',
        escalation: {
          id: escalation.id,
          conversationId: escalation.conversationId,
          reason: escalation.reason,
          priority: escalation.priority,
          customerName: escalation.customerName,
          createdAt: escalation.createdAt,
        },
      });
    }

    // Also send push notification if available
    await this.sendPushNotifications(agents, escalation);
  }
}
```

---

## 4. Support Agent Inbox

### 4.1 Inbox Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SUPPORT AGENT INBOX                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌────────────────────────┐  ┌───────────────────────────────────────────────┐ │
│  │      QUEUE VIEW        │  │              CONVERSATION VIEW                 │ │
│  │                        │  │                                                │ │
│  │  ┌──────────────────┐  │  │  ┌──────────────────────────────────────────┐ │ │
│  │  │ Waiting (5)      │  │  │  │  Header: Customer Info + Actions         │ │ │
│  │  │ ───────────────  │  │  │  ├──────────────────────────────────────────┤ │ │
│  │  │ • John D. (2m)   │◀─┼──│  │                                          │ │ │
│  │  │ • Sarah M. (5m)  │  │  │  │  Message History                         │ │ │
│  │  │ • ...            │  │  │  │  • AI messages                           │ │ │
│  │  └──────────────────┘  │  │  │  • Customer messages                     │ │ │
│  │                        │  │  │  • System events                         │ │ │
│  │  ┌──────────────────┐  │  │  │                                          │ │ │
│  │  │ My Active (3)    │  │  │  ├──────────────────────────────────────────┤ │ │
│  │  │ ───────────────  │  │  │  │  AI Co-pilot Suggestions                 │ │ │
│  │  │ • Mike T.        │◀─┼──│  │  ┌────────────────────────────────────┐  │ │ │
│  │  │ • Lisa K.        │  │  │  │  │ Suggested: "Based on our policy..." │  │ │ │
│  │  │ • ...            │  │  │  │  └────────────────────────────────────┘  │ │ │
│  │  └──────────────────┘  │  │  ├──────────────────────────────────────────┤ │ │
│  │                        │  │  │  Input Area                              │ │ │
│  │  ┌──────────────────┐  │  │  │  • Message composer                     │ │ │
│  │  │ Recently Closed  │  │  │  │  • Quick actions                        │ │ │
│  │  │ ───────────────  │  │  │  │  • Hand back to AI                      │ │ │
│  │  │ • ...            │  │  │  └──────────────────────────────────────────┘ │ │
│  │  └──────────────────┘  │  │                                                │ │
│  │                        │  └───────────────────────────────────────────────┘ │
│  └────────────────────────┘                                                     │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                          CUSTOMER CONTEXT PANEL                            │ │
│  │  • Customer info        • Previous conversations       • Notes             │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Real-time Updates

```typescript
// src/services/inbox/realtime.ts

export class InboxRealtimeService {
  private subscriptions: Map<string, Set<WebSocket>> = new Map();

  async subscribeAgent(agentId: string, ws: WebSocket): Promise<void> {
    // Subscribe to agent's notification channel
    const channels = [
      `agent:${agentId}:notifications`,
      `agent:${agentId}:conversations`,
    ];

    for (const channel of channels) {
      await this.subscribe(channel, ws);
    }

    // Get initial data
    const initialData = await this.getInitialInboxData(agentId);
    ws.send(JSON.stringify({ type: 'initial', data: initialData }));
  }

  async broadcastConversationUpdate(
    conversationId: string,
    event: ConversationEvent
  ): Promise<void> {
    // Get all agents who should receive this update
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) return;

    // Broadcast to assigned agent
    if (conversation.assignedAgentId) {
      await pubsub.publish(
        `agent:${conversation.assignedAgentId}:conversations`,
        { conversationId, event }
      );
    }

    // Broadcast to queue watchers if unassigned
    if (!conversation.assignedAgentId) {
      const eligibleAgents = await this.getEligibleAgents(conversation);
      for (const agent of eligibleAgents) {
        await pubsub.publish(
          `agent:${agent.id}:notifications`,
          { type: 'queue_update', conversationId, event }
        );
      }
    }
  }

  private async getInitialInboxData(agentId: string): Promise<InboxData> {
    const agent = await db.query.users.findFirst({
      where: eq(users.id, agentId),
    });

    if (!agent) throw new Error('Agent not found');

    // Get queue (waiting conversations)
    const queue = await db.query.conversations.findMany({
      where: and(
        eq(conversations.companyId, agent.companyId!),
        eq(conversations.status, 'waiting_human'),
        isNull(conversations.assignedAgentId)
      ),
      orderBy: asc(conversations.lastMessageAt),
    });

    // Get assigned conversations
    const assigned = await db.query.conversations.findMany({
      where: and(
        eq(conversations.assignedAgentId, agentId),
        eq(conversations.status, 'with_human')
      ),
      orderBy: desc(conversations.lastMessageAt),
    });

    // Get recent closed
    const closed = await db.query.conversations.findMany({
      where: and(
        eq(conversations.assignedAgentId, agentId),
        eq(conversations.status, 'resolved')
      ),
      orderBy: desc(conversations.resolvedAt),
      limit: 20,
    });

    return {
      queue: await this.enrichConversations(queue),
      assigned: await this.enrichConversations(assigned),
      closed: await this.enrichConversations(closed),
    };
  }
}
```

---

## 5. AI Co-pilot Mode

### 5.1 Suggestion Generation

```typescript
// src/services/copilot/service.ts

export class CopilotService {
  async generateSuggestion(
    conversationId: string,
    agentId: string
  ): Promise<CopilotSuggestion> {
    // Load conversation context
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        messages: {
          orderBy: desc(messages.createdAt),
          limit: 20,
        },
        agent: true,
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Get last customer message
    const lastCustomerMessage = conversation.messages
      .reverse()
      .find(m => m.role === 'user');

    if (!lastCustomerMessage) {
      return { suggestions: [] };
    }

    // Search knowledge base
    const ragResults = await ragService.search({
      query: lastCustomerMessage.content,
      companyId: conversation.companyId,
      limit: 3,
    });

    // Generate suggestions
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an AI co-pilot helping a support agent respond to a customer.

Based on the conversation history and knowledge base results, generate 2-3 suggested responses.
Each suggestion should be:
- Professional and empathetic
- Directly addressing the customer's concern
- Based on the provided knowledge base information when relevant

Format: Return a JSON array of suggestion objects with "text" and "confidence" (0-1) fields.`,
        },
        {
          role: 'user',
          content: `
Conversation history:
${this.formatHistory(conversation.messages)}

Knowledge base results:
${this.formatRagResults(ragResults)}

Customer's last message: "${lastCustomerMessage.content}"

Generate suggested responses:`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const suggestions = JSON.parse(
      response.choices[0].message.content ?? '{"suggestions":[]}'
    );

    return {
      suggestions: suggestions.suggestions.map((s: any) => ({
        text: s.text,
        confidence: s.confidence,
        sources: ragResults.map(r => r.source.fileName),
      })),
    };
  }

  async streamSuggestion(
    conversationId: string,
    agentId: string
  ): AsyncGenerator<string> {
    // Stream suggestion as agent types
    // ... implementation
  }
}
```

### 5.2 Co-pilot UI Component

```typescript
// src/components/inbox/CopilotPanel.tsx

export function CopilotPanel({ conversationId }: { conversationId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch suggestions when new customer message arrives
  useEffect(() => {
    const unsubscribe = subscribeToConversation(conversationId, (event) => {
      if (event.type === 'new_message' && event.message.role === 'user') {
        fetchSuggestions();
      }
    });

    return unsubscribe;
  }, [conversationId]);

  const fetchSuggestions = async () => {
    setLoading(true);
    const result = await copilotService.generateSuggestion(conversationId);
    setSuggestions(result.suggestions);
    setLoading(false);
  };

  const applySuggestion = (suggestion: Suggestion) => {
    // Insert into message composer
    onApply(suggestion.text);
  };

  return (
    <div className="copilot-panel">
      <div className="copilot-header">
        <SparklesIcon />
        <span>AI Suggestions</span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : suggestions.length > 0 ? (
        <div className="suggestions-list">
          {suggestions.map((suggestion, i) => (
            <div
              key={i}
              className="suggestion-card"
              onClick={() => applySuggestion(suggestion)}
            >
              <p className="suggestion-text">{suggestion.text}</p>
              <div className="suggestion-meta">
                <span className="confidence">
                  {Math.round(suggestion.confidence * 100)}% confident
                </span>
                {suggestion.sources.length > 0 && (
                  <span className="sources">
                    Based on: {suggestion.sources.join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-suggestions">
          Suggestions will appear when the customer sends a message.
        </p>
      )}
    </div>
  );
}
```

---

## 6. Internal Notes

### 6.1 Notes System

```typescript
// src/services/notes/service.ts

export class NotesService {
  async addNote(
    conversationId: string,
    userId: string,
    content: string
  ): Promise<ConversationNote> {
    const note = await db.insert(conversationNotes).values({
      conversationId,
      userId,
      content,
      createdAt: new Date(),
    }).returning();

    // Notify other agents viewing this conversation
    await pubsub.publish(`conversation:${conversationId}:notes`, {
      type: 'note_added',
      note: note[0],
    });

    return note[0];
  }

  async getNotes(conversationId: string): Promise<ConversationNote[]> {
    return db.query.conversationNotes.findMany({
      where: eq(conversationNotes.conversationId, conversationId),
      with: {
        user: {
          columns: { name: true, avatarUrl: true },
        },
      },
      orderBy: asc(conversationNotes.createdAt),
    });
  }
}
```

---

## 7. Metrics & Analytics

### 7.1 HITL Metrics

```typescript
// src/services/analytics/hitl-metrics.ts

interface HITLMetrics {
  // Volume
  totalEscalations: number;
  escalationRate: number;  // % of conversations escalated

  // Timing
  averageWaitTime: number;  // Time until agent accepts
  averageHandleTime: number;  // Time with human agent
  averageFirstResponseTime: number;

  // Outcomes
  resolutionRate: number;
  handBackToAiRate: number;
  customerSatisfaction: number;

  // Triggers
  escalationsByReason: Record<string, number>;
}

export async function getHITLMetrics(
  companyId: string,
  dateRange: DateRange
): Promise<HITLMetrics> {
  const escalations = await db.query.escalations.findMany({
    where: and(
      eq(escalations.companyId, companyId),
      gte(escalations.createdAt, dateRange.start),
      lte(escalations.createdAt, dateRange.end)
    ),
  });

  const totalConversations = await db
    .select({ count: count() })
    .from(conversations)
    .where(and(
      eq(conversations.companyId, companyId),
      gte(conversations.createdAt, dateRange.start)
    ));

  // Calculate metrics
  const escalationRate = escalations.length / totalConversations[0].count;

  const waitTimes = escalations
    .filter(e => e.assignedAt)
    .map(e => differenceInSeconds(e.assignedAt!, e.createdAt));
  const averageWaitTime = mean(waitTimes);

  const handleTimes = escalations
    .filter(e => e.resolvedAt && e.assignedAt)
    .map(e => differenceInSeconds(e.resolvedAt!, e.assignedAt!));
  const averageHandleTime = mean(handleTimes);

  // Group by reason
  const escalationsByReason = groupBy(escalations, 'reason');
  const reasonCounts = Object.fromEntries(
    Object.entries(escalationsByReason).map(([reason, items]) => [
      reason,
      items.length,
    ])
  );

  return {
    totalEscalations: escalations.length,
    escalationRate,
    averageWaitTime,
    averageHandleTime,
    averageFirstResponseTime: 0, // Calculate from messages
    resolutionRate: escalations.filter(e => e.resolution === 'resolved').length / escalations.length,
    handBackToAiRate: escalations.filter(e => e.resolution === 'handed_back').length / escalations.length,
    customerSatisfaction: 0, // From feedback
    escalationsByReason: reasonCounts,
  };
}
```

---

## 8. Configuration

### 8.1 Agent-Level HITL Settings

```typescript
// In agent configuration
interface AgentHITLConfig {
  // Enable/disable HITL
  enabled: boolean;

  // Escalation rules (see section 2)
  escalationRules: EscalationRules;

  // Queue settings
  queue: {
    maxWaitTime: number;  // Auto-message after this time
    waitTimeMessage: string;
    offlineMessage: string;
  };

  // Business hours (for human availability)
  businessHours: {
    enabled: boolean;
    timezone: string;
    schedule: WeeklySchedule;
    outsideHoursMessage: string;
    outsideHoursAction: 'queue' | 'ai_only' | 'message';
  };

  // Co-pilot settings
  copilot: {
    enabled: boolean;
    autoSuggest: boolean;
    suggestOnNewMessage: boolean;
  };
}
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Database Schema](./database-schema.md)
- [Agent Framework Architecture](./architecture-agent-framework.md)
- [Realtime & Channels Architecture](./architecture-realtime-channels.md)
- [Requirements Document](./requirement.v2.md)
