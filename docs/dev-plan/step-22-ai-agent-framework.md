# Step 22: AI Agent Framework

## Objective
Implement the core AI agent framework including the BaseAgent SDK, LLM integration, tool use system, conversation history management, and the pluggable agent runner service.

---

## Prerequisites
- Step 12 completed (Knowledge Base with RAG)
- Step 11 completed (Agent configuration)
- Database schema with agents, conversations, messages tables
- OpenAI/Anthropic API keys configured

---

## Reference Documents
- [Architecture: Agent Framework](../architecture-agent-framework.md)
- [Architecture: RAG & Knowledge](../architecture-rag-knowledge.md)

---

## Tasks

### 22.1 Implement BaseAgent SDK

**Directory:** `src/lib/agent-sdk/`

**Base Agent Class:**
```typescript
// src/lib/agent-sdk/base-agent.ts

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llm: LLMClient;
  protected rag: RAGService;
  protected history: HistoryService;
  protected tools: Tool[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.llm = new LLMClient(config.llmConfig);
    this.rag = new RAGService(config.ragConfig);
    this.history = new HistoryService(config.historyConfig);
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    // 1. Load conversation history
    // 2. Retrieve relevant knowledge (RAG)
    // 3. Build messages array
    // 4. Call LLM with tool use
    // 5. Process tool calls
    // 6. Save to history
    // 7. Return response
  }
}
```

### 22.2 Implement LLM Client

**File:** `src/lib/agent-sdk/llm-client.ts`

**Features:**
- Support for OpenAI and Anthropic
- Streaming responses
- Tool use handling
- Token counting
- Error handling with retries

```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: { input: number; output: number };
  latency: number;
}
```

### 22.3 Implement Tool System

**File:** `src/lib/agent-sdk/tools.ts`

**Built-in Tools:**
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: unknown) => Promise<ToolResult>;
}

// Built-in tools
const builtInTools = {
  ragSearch: {
    name: 'search_knowledge',
    description: 'Search the knowledge base for relevant information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },

  requestHumanHandover: {
    name: 'request_human_handover',
    description: 'Transfer conversation to a human agent',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['reason'],
    },
  },
};
```

### 22.4 Implement Conversation History Service

**File:** `src/lib/agent-sdk/history-service.ts`

**Features:**
- Redis-based caching for active conversations
- Database persistence for long-term storage
- Configurable history window
- Automatic summarization for long conversations

```typescript
interface HistoryService {
  get(conversationId: string): Promise<Message[]>;
  append(conversationId: string, messages: Message[]): Promise<void>;
  summarize(conversationId: string): Promise<string>;
  clear(conversationId: string): Promise<void>;
}
```

### 22.5 Implement RAG Integration

**File:** `src/lib/agent-sdk/rag-service.ts`

**Features:**
- Vector similarity search
- Source filtering by category
- Relevance threshold
- Source citation

```typescript
interface RAGService {
  search(options: {
    query: string;
    companyId: string;
    categoryIds?: string[];
    limit?: number;
    threshold?: number;
  }): Promise<RAGResult[]>;
}

interface RAGResult {
  content: string;
  similarity: number;
  source: {
    id: string;
    fileName: string;
    category: string;
  };
}
```

### 22.6 Implement Agent Runner Service

**File:** `src/services/agent-runner/runner.ts`

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT RUNNER SERVICE                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Request      │  │ Agent        │  │ Worker Pool            │ │
│  │ Queue        │→ │ Loader       │→ │ Manager                │ │
│  │ (BullMQ)     │  │ & Cache      │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│                                               │                  │
│                                               ▼                  │
│                            ┌──────────────────────────────────┐ │
│                            │  Execution Context               │ │
│                            │  • RAG Service                   │ │
│                            │  • History Service               │ │
│                            │  • LLM Client                    │ │
│                            └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 22.7 Implement Streaming Support

**File:** `src/lib/agent-sdk/streaming.ts`

**SSE Event Types:**
```typescript
type AgentStreamEvent =
  | { type: 'thinking'; step: string; progress: number }
  | { type: 'tool_call'; tool: string; status: 'executing' | 'completed' | 'failed' }
  | { type: 'delta'; content: string }
  | { type: 'complete'; content: string; metadata: ResponseMetadata }
  | { type: 'error'; code: string; message: string };
```

### 22.8 Create Agent Message Processing API

**`src/app/api/chat/[sessionId]/message/route.ts`:**
```typescript
// POST: Send message to agent
export async function POST(req, { params }) {
  const { sessionId } = params;
  const { content, attachments } = await req.json();

  // 1. Validate session
  // 2. Create message record
  // 3. Queue for processing
  // 4. Return message ID
}
```

**`src/app/api/chat/[sessionId]/stream/route.ts`:**
```typescript
// GET: SSE stream for responses
export async function GET(req, { params }) {
  // 1. Validate session
  // 2. Create SSE stream
  // 3. Subscribe to session events
  // 4. Forward events to client
}
```

### 22.9 Implement Agent Configuration Loader

**File:** `src/services/agent-runner/config-loader.ts`

**Features:**
- Load agent configuration from database
- Merge with default settings
- Validate configuration
- Cache configuration

```typescript
interface AgentConfig {
  agentId: string;
  companyId: string;

  // Prompts
  systemPrompt: string;
  personality?: string;

  // LLM
  llmConfig: {
    provider: 'openai' | 'anthropic';
    model: string;
    temperature: number;
    maxTokens: number;
  };

  // RAG
  ragEnabled: boolean;
  ragConfig: {
    maxResults: number;
    relevanceThreshold: number;
    categoryIds: string[];
  };

  // Tools
  enabledTools: string[];
  toolConfig: Record<string, unknown>;

  // History
  historyConfig: {
    maxMessages: number;
    ttl: number;
  };
}
```

### 22.10 Implement Metrics & Logging

**File:** `src/services/agent-runner/metrics.ts`

**Metrics:**
| Metric | Type | Description |
|--------|------|-------------|
| `agent.execution.duration` | Histogram | Time to process message |
| `agent.execution.success` | Counter | Successful executions |
| `agent.execution.error` | Counter | Failed executions |
| `agent.tokens.input` | Counter | Input tokens used |
| `agent.tokens.output` | Counter | Output tokens used |
| `agent.tools.calls` | Counter | Tool invocations |
| `agent.rag.queries` | Counter | RAG searches performed |

---

## Data Models

### Agent Context
```typescript
interface AgentContext {
  // Identifiers
  conversationId: string;
  companyId: string;
  agentId: string;
  requestId: string;

  // Message
  message: string;
  attachments?: Attachment[];

  // Customer info
  customerId?: string;
  customerName?: string;
  customerMetadata?: Record<string, unknown>;

  // Channel info
  channel: 'web' | 'whatsapp' | 'telegram' | 'slack' | 'teams';

  // Timestamps
  timestamp: Date;
}
```

### Agent Response
```typescript
interface AgentResponse {
  content: string;
  metadata?: {
    confidence?: number;
    sources?: string[];
    toolsUsed?: string[];
    shouldEscalate?: boolean;
    escalationReason?: string;
    tokensUsed?: { input: number; output: number };
  };
}
```

---

## Message Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE PROCESSING FLOW                       │
└─────────────────────────────────────────────────────────────────┘

1. INCOMING MESSAGE
   POST /api/chat/{session_id}/message
   { "content": "What's your return policy?" }

                      │
                      ▼

2. SESSION VALIDATION
   ┌─────────────────────────────────────────┐
   │ • Validate session token                │
   │ • Load conversation context             │
   │ • Check subscription limits             │
   └─────────────────────────────────────────┘

                      │
                      ▼

3. CONTEXT BUILDING
   ┌─────────────────────────────────────────┐
   │ • Load conversation history (Redis)     │
   │ • Build customer context                │
   │ • Prepare system prompt                 │
   │ • Set tool availability                 │
   └─────────────────────────────────────────┘

                      │
                      ▼

4. RAG SEARCH (if enabled)
   ┌─────────────────────────────────────────┐
   │ • Generate embedding for query          │
   │ • Search Qdrant for similar content     │
   │ • Filter by relevance threshold         │
   │ • Format RAG context                    │
   └─────────────────────────────────────────┘

                      │
                      ▼

5. LLM CALL
   ┌─────────────────────────────────────────┐
   │ • Build messages array                  │
   │ • Include tools if enabled              │
   │ • Stream response                       │
   │ • Handle tool calls recursively         │
   └─────────────────────────────────────────┘

                      │
                      ▼

6. POST-PROCESSING
   ┌─────────────────────────────────────────┐
   │ • Save message to database              │
   │ • Update conversation history           │
   │ • Update usage metrics                  │
   │ • Check escalation conditions           │
   └─────────────────────────────────────────┘
```

---

## Implementation Components

### SDK Files
```
src/lib/agent-sdk/
├── index.ts                 # Main exports
├── base-agent.ts           # BaseAgent class
├── llm-client.ts           # LLM integration
├── tools.ts                # Tool system
├── history-service.ts      # Conversation history
├── rag-service.ts          # RAG integration
├── streaming.ts            # SSE streaming
└── types.ts                # Type definitions
```

### Service Files
```
src/services/agent-runner/
├── runner.ts               # Main runner service
├── config-loader.ts        # Agent config loader
├── message-processor.ts    # Message processing logic
├── tool-executor.ts        # Tool execution
├── metrics.ts              # Metrics collection
└── types.ts                # Service types
```

### API Routes
```
src/app/api/
├── chat/
│   └── [sessionId]/
│       ├── message/
│       │   └── route.ts    # POST: Send message
│       ├── stream/
│       │   └── route.ts    # GET: SSE stream
│       └── history/
│           └── route.ts    # GET: Conversation history
```

---

## Error Handling

### Error Types
```typescript
class AgentExecutionError extends Error {
  code: 'TIMEOUT' | 'LLM_ERROR' | 'TOOL_ERROR' | 'CONFIG_ERROR';
  retryable: boolean;
}

class RateLimitError extends Error {
  retryAfter: number;
}

class ContextLimitError extends Error {
  tokensUsed: number;
  maxTokens: number;
}
```

### Retry Strategy
- LLM API errors: 3 retries with exponential backoff
- Tool execution errors: 2 retries
- Rate limit: Wait for retry-after header
- Context limit: Summarize history and retry

---

## Validation Checklist

- [ ] BaseAgent processes messages correctly
- [ ] LLM client works with OpenAI and Anthropic
- [ ] Tool execution works properly
- [ ] RAG search returns relevant results
- [ ] Conversation history is maintained
- [ ] Streaming works end-to-end
- [ ] Error handling covers edge cases
- [ ] Metrics are being collected
- [ ] Token usage is tracked correctly
- [ ] Agent configuration loads properly

---

## File Structure

```
src/
├── lib/
│   └── agent-sdk/
│       ├── index.ts
│       ├── base-agent.ts
│       ├── llm-client.ts
│       ├── tools.ts
│       ├── history-service.ts
│       ├── rag-service.ts
│       ├── streaming.ts
│       └── types.ts
│
├── services/
│   └── agent-runner/
│       ├── runner.ts
│       ├── config-loader.ts
│       ├── message-processor.ts
│       ├── tool-executor.ts
│       └── metrics.ts
│
└── app/
    └── api/
        └── chat/
            └── [sessionId]/
                ├── message/
                │   └── route.ts
                ├── stream/
                │   └── route.ts
                └── history/
                    └── route.ts
```

---

## Next Step
[Step 23 - Real-time Communication](./step-23-realtime.md)

---

## Related Documentation
- [Architecture: Agent Framework](../architecture-agent-framework.md)
- [Architecture: RAG & Knowledge](../architecture-rag-knowledge.md)
- [Step 12 - Knowledge Base](./step-12-knowledge-base.md)
