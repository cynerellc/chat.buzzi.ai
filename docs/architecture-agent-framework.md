# Architecture: Pluggable Agent Framework

## Overview

This document details the architecture of the Pluggable Agent Framework - a system that allows custom agent logic to be dynamically loaded and executed in a secure, sandboxed environment. This enables maximum flexibility while maintaining platform stability and tenant isolation.

---

## 1. Design Philosophy

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Zero Cold Starts** | Agents respond instantly through warm worker pools |
| **High Density** | Thousands of agents run on shared infrastructure |
| **Strict Isolation** | V8 Isolates prevent cross-tenant data access |
| **Hot-Swappable** | Agent code updates without service restart |
| **Inheritance-Based** | All agents extend a feature-rich `BaseAgent` |

### 1.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        AGENT FRAMEWORK ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────────┐
                            │  Incoming        │
                            │  Message         │
                            └────────┬─────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE ROUTER                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ Identify Agent  │─▶│ Validate Tenant │─▶│ Check Subscription & Limits    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AGENT RUNNER SERVICE                                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        WORKER POOL                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐   │   │
│  │  │  Worker 1    │  │  Worker 2    │  │  Worker 3    │  │  Worker N  │   │   │
│  │  │  (V8 Isolate)│  │  (V8 Isolate)│  │  (V8 Isolate)│  │            │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                           │
│                      ┌──────────────┴──────────────┐                           │
│                      ▼                              ▼                           │
│            ┌──────────────────┐          ┌──────────────────┐                  │
│            │  Package Cache   │          │   Context        │                  │
│            │  (Local + Redis) │          │   Injector       │                  │
│            └──────────────────┘          └──────────────────┘                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
          ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
          │    Qdrant    │  │    Redis     │  │     LLM      │
          │   (RAG)      │  │  (History)   │  │   (Claude)   │
          └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 2. Agent Package Structure

### 2.1 Package Layout

```
agent-packages/
└── company_{company_id}_{agent_name}_v{version}.zip
    ├── index.js              # Entry point (compiled)
    ├── index.js.map          # Source map (optional)
    ├── package.json          # Metadata & dependencies
    ├── config.schema.json    # Configuration schema
    └── tools/                # Custom tools
        ├── search-inventory.js
        └── create-ticket.js
```

### 2.2 Package Manifest (package.json)

```json
{
  "name": "@company/sales-agent",
  "version": "1.2.0",
  "main": "index.js",
  "buzzi": {
    "agentType": "sales",
    "minBaseVersion": "2.0.0",
    "capabilities": ["rag", "tools", "file_upload"],
    "allowedHosts": ["api.crm.company.com"],
    "timeout": 30000,
    "maxMemory": "128MB"
  },
  "dependencies": {
    "@buzzi/base-agent": "^2.0.0"
  }
}
```

### 2.3 Agent Implementation

```typescript
// src/agents/sales-agent/index.ts
import { BaseAgent, AgentContext, AgentResponse, Tool } from '@buzzi/base-agent';

export default class SalesAgent extends BaseAgent {
  // Custom tools
  protected tools: Tool[] = [
    {
      name: 'check_inventory',
      description: 'Check product inventory levels',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product SKU' },
        },
        required: ['productId'],
      },
      execute: async (params) => this.checkInventory(params.productId),
    },
    {
      name: 'create_quote',
      description: 'Create a sales quote for the customer',
      parameters: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          discount: { type: 'number' },
        },
        required: ['items'],
      },
      execute: async (params) => this.createQuote(params),
    },
  ];

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    // Pre-processing: Extract intent
    const intent = await this.classifyIntent(context.message);

    // Custom logic for specific intents
    if (intent === 'pricing_request') {
      return this.handlePricingRequest(context);
    }

    if (intent === 'discount_negotiation' && !context.customerMetadata?.isVip) {
      // Limit discount offers for non-VIP customers
      context.systemPromptAddition = `
        Customer is not a VIP. Maximum discount allowed is 10%.
        Do not offer discounts above this threshold.
      `;
    }

    // Delegate to base agent for standard processing
    return super.processMessage(context);
  }

  private async checkInventory(productId: string): Promise<ToolResult> {
    // Allowlisted external API call
    const response = await this.fetch('https://api.crm.company.com/inventory', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });

    return {
      success: true,
      data: await response.json(),
    };
  }

  private async createQuote(params: QuoteParams): Promise<ToolResult> {
    // Create quote in CRM
    // ...
  }

  private async handlePricingRequest(context: AgentContext): Promise<AgentResponse> {
    // Custom pricing logic
    // ...
  }
}
```

---

## 3. Base Agent SDK

### 3.1 BaseAgent Class

```typescript
// @buzzi/base-agent/src/base-agent.ts

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

  /**
   * Main entry point for message processing
   * Override this method to customize agent behavior
   */
  async processMessage(context: AgentContext): Promise<AgentResponse> {
    // 1. Load conversation history
    const history = await this.history.get(context.conversationId);

    // 2. Retrieve relevant knowledge (RAG)
    let ragContext = '';
    if (this.config.ragEnabled) {
      const ragResults = await this.rag.search({
        query: context.message,
        companyId: context.companyId,
        categoryIds: this.config.knowledgeCategoryIds,
        limit: this.config.ragConfig.maxResults,
        threshold: this.config.ragConfig.relevanceThreshold,
      });
      ragContext = this.formatRagResults(ragResults);
    }

    // 3. Build messages array
    const messages = this.buildMessages({
      systemPrompt: this.config.systemPrompt,
      systemPromptAddition: context.systemPromptAddition,
      ragContext,
      history,
      userMessage: context.message,
      attachments: context.attachments,
    });

    // 4. Call LLM with tool use
    const response = await this.llm.chat({
      messages,
      tools: this.getAvailableTools(),
      temperature: this.config.llmConfig.temperature,
      maxTokens: this.config.llmConfig.maxTokens,
      stream: true,
    });

    // 5. Process tool calls if any
    const finalResponse = await this.processToolCalls(response, context);

    // 6. Save to history
    await this.history.append(context.conversationId, [
      { role: 'user', content: context.message },
      { role: 'assistant', content: finalResponse.content },
    ]);

    // 7. Emit metrics
    this.emitMetrics({
      conversationId: context.conversationId,
      tokens: response.usage,
      latency: response.latency,
      toolsUsed: response.toolCalls?.map(t => t.name) ?? [],
    });

    return finalResponse;
  }

  /**
   * RAG search - override to customize retrieval
   */
  protected async ragSearch(query: string): Promise<RAGResult[]> {
    return this.rag.search({
      query,
      companyId: this.config.companyId,
      categoryIds: this.config.knowledgeCategoryIds,
    });
  }

  /**
   * Secure fetch - only allowed hosts
   */
  protected async fetch(url: string, options?: RequestInit): Promise<Response> {
    const hostname = new URL(url).hostname;
    if (!this.config.allowedHosts.includes(hostname)) {
      throw new Error(`Host not allowed: ${hostname}`);
    }
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(this.config.fetchTimeout),
    });
  }

  /**
   * Get available tools (base + custom)
   */
  protected getAvailableTools(): Tool[] {
    const baseTools = [
      this.config.ragEnabled && ragSearchTool,
      // ... other base tools
    ].filter(Boolean);

    return [...baseTools, ...this.tools];
  }

  // ... more methods
}
```

### 3.2 Context Types

```typescript
// @buzzi/base-agent/src/types.ts

export interface AgentContext {
  // Identifiers
  conversationId: string;
  companyId: string;
  agentId: string;

  // Message
  message: string;
  attachments?: Attachment[];

  // Customer info
  customerId?: string;
  customerName?: string;
  customerMetadata?: Record<string, unknown>;

  // Channel info
  channel: 'web' | 'whatsapp' | 'telegram' | 'slack' | 'teams' | 'custom';
  channelMetadata?: Record<string, unknown>;

  // Injected context
  systemPromptAddition?: string;

  // Request metadata
  requestId: string;
  timestamp: Date;
}

export interface AgentResponse {
  content: string;
  metadata?: {
    confidence?: number;
    sources?: string[];
    toolsUsed?: string[];
    shouldEscalate?: boolean;
    escalationReason?: string;
  };
}

export interface AgentConfig {
  // Identity
  agentId: string;
  companyId: string;

  // Package
  packageUrl?: string;
  packageHash?: string;

  // Prompts
  systemPrompt: string;
  personality?: string;

  // LLM
  llmConfig: {
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

  // Security
  allowedHosts: string[];
  fetchTimeout: number;

  // History
  historyConfig: {
    maxMessages: number;
    ttl: number;
  };
}
```

---

## 4. Agent Runner Service

### 4.1 Runner Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT RUNNER SERVICE                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MAIN PROCESS                                        │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────────┐│
│  │  Request Queue   │  │  Package Loader  │  │  Worker Pool Manager           ││
│  │  (BullMQ)        │  │  & Cache         │  │                                ││
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────┬─────────────────┘│
│           │                     │                            │                  │
│           │                     │                            │                  │
│           └─────────────────────┴────────────────────────────┘                  │
│                                     │                                           │
│                                     │ spawn / communicate                       │
│                                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         WORKER THREAD POOL                               │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Worker Thread 1                                                    │ │   │
│  │  │  ┌────────────────────────────────────────────────────────────┐   │ │   │
│  │  │  │  V8 Isolate (Agent A)                                       │   │ │   │
│  │  │  │  ─────────────────────                                      │   │ │   │
│  │  │  │  • Loaded: SalesAgent v1.2                                  │   │ │   │
│  │  │  │  • Memory: 64MB / 128MB limit                               │   │ │   │
│  │  │  │  • CPU Time: 2.3s / 30s limit                               │   │ │   │
│  │  │  └────────────────────────────────────────────────────────────┘   │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Worker Thread 2                                                    │ │   │
│  │  │  ┌────────────────────────────────────────────────────────────┐   │ │   │
│  │  │  │  V8 Isolate (Agent B)                                       │   │ │   │
│  │  │  │  ...                                                        │   │ │   │
│  │  │  └────────────────────────────────────────────────────────────┘   │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  ... (N workers based on CPU cores)                                     │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Runner Implementation

```typescript
// src/services/agent-runner/runner.ts
import { Worker } from 'worker_threads';
import { Queue, Worker as BullWorker } from 'bullmq';

export class AgentRunnerService {
  private workerPool: WorkerPool;
  private packageCache: PackageCache;
  private queue: Queue;

  constructor(config: RunnerConfig) {
    this.workerPool = new WorkerPool({
      minWorkers: config.minWorkers ?? 4,
      maxWorkers: config.maxWorkers ?? 16,
      idleTimeout: config.idleTimeout ?? 60000,
    });

    this.packageCache = new PackageCache({
      localCachePath: config.cachePath,
      redisClient: config.redis,
      maxSize: config.maxCacheSize,
    });

    this.queue = new Queue('agent-messages', {
      connection: config.redis,
    });
  }

  async processMessage(
    agentId: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    // 1. Load agent configuration
    const agent = await this.loadAgentConfig(agentId);

    // 2. Ensure package is cached (if agent has custom package)
    const packagePath = agent.packageUrl
      ? await this.packageCache.ensure(
          agent.agentId,
          agent.packageUrl,
          agent.packageHash
        )
      : this.defaultPackagePath;

    // 3. Acquire worker from pool
    const worker = await this.workerPool.acquire();

    try {
      // 4. Execute in sandboxed environment
      const response = await this.executeInWorker(worker, {
        packagePath,
        config: agent,
        context,
      });

      return response;
    } finally {
      // 5. Release worker back to pool
      this.workerPool.release(worker);
    }
  }

  private async executeInWorker(
    worker: Worker,
    payload: WorkerPayload
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Agent execution timeout'));
      }, payload.config.timeout ?? 30000);

      worker.once('message', (result) => {
        clearTimeout(timeout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.response);
        }
      });

      worker.postMessage(payload);
    });
  }
}
```

### 4.3 Worker Thread Implementation

```typescript
// src/services/agent-runner/worker.ts
import { parentPort } from 'worker_threads';
import ivm from 'isolated-vm';

parentPort?.on('message', async (payload: WorkerPayload) => {
  try {
    const response = await executeAgent(payload);
    parentPort?.postMessage({ response });
  } catch (error) {
    parentPort?.postMessage({ error: error.message });
  }
});

async function executeAgent(payload: WorkerPayload): Promise<AgentResponse> {
  // Create V8 Isolate with memory limit
  const isolate = new ivm.Isolate({
    memoryLimit: payload.config.maxMemory ?? 128,
  });

  try {
    // Create context with restricted globals
    const context = await isolate.createContext();
    const jail = context.global;

    // Inject safe globals
    await jail.set('console', createSafeConsole());
    await jail.set('fetch', createSafeFetch(payload.config.allowedHosts));
    await jail.set('setTimeout', createSafeTimeout());

    // Inject platform APIs
    await jail.set('__buzzi__', {
      rag: createRagProxy(payload.context.companyId),
      history: createHistoryProxy(payload.context.conversationId),
      llm: createLLMProxy(),
      emit: createEventEmitter(),
    });

    // Load and compile agent code
    const code = await fs.readFile(payload.packagePath, 'utf-8');
    const script = await isolate.compileScript(code);
    await script.run(context);

    // Execute agent
    const AgentClass = await jail.get('default');
    const agent = await AgentClass.create(payload.config);
    const response = await agent.processMessage(payload.context);

    return response;
  } finally {
    isolate.dispose();
  }
}

function createSafeFetch(allowedHosts: string[]) {
  return async (url: string, options?: RequestInit) => {
    const hostname = new URL(url).hostname;
    if (!allowedHosts.includes(hostname)) {
      throw new Error(`Fetch to ${hostname} not allowed`);
    }
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000),
    });
  };
}
```

---

## 5. Package Management

### 5.1 Package Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PACKAGE UPLOAD FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Master Admin │────▶│   Upload     │────▶│  Validate    │────▶│   Store      │
│   Dashboard  │     │   Package    │     │   Package    │     │   Package    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                │
                     ┌──────────────────────────┴───────────────────────────┐
                     │                    VALIDATION                         │
                     │  1. Verify package structure                          │
                     │  2. Check dependencies (allowlist)                    │
                     │  3. Static analysis for dangerous patterns            │
                     │  4. Verify BaseAgent inheritance                      │
                     │  5. Test execution in sandbox                         │
                     │  6. Calculate content hash                            │
                     └──────────────────────────────────────────────────────┘
```

### 5.2 Package Validation

```typescript
// src/services/package-validator.ts

export class PackageValidator {
  private allowedDependencies = new Set([
    '@buzzi/base-agent',
    'zod',
    'lodash-es',
    // ... approved list
  ]);

  private dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /child_process/,
    /fs\./,
    /require\s*\(/,
    /import\s*\(/,
    /__proto__/,
    /constructor\s*\[/,
  ];

  async validate(packagePath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Structure validation
    const structure = await this.validateStructure(packagePath);
    if (!structure.valid) {
      errors.push(...structure.errors);
    }

    // 2. Package.json validation
    const packageJson = await this.loadPackageJson(packagePath);
    const depsResult = this.validateDependencies(packageJson);
    errors.push(...depsResult.errors);

    // 3. Static code analysis
    const codeResult = await this.analyzeCode(packagePath);
    errors.push(...codeResult.errors);
    warnings.push(...codeResult.warnings);

    // 4. Inheritance check
    const inheritanceResult = await this.checkInheritance(packagePath);
    if (!inheritanceResult.valid) {
      errors.push('Agent must extend BaseAgent');
    }

    // 5. Sandbox test
    if (errors.length === 0) {
      const sandboxResult = await this.testInSandbox(packagePath);
      if (!sandboxResult.success) {
        errors.push(`Sandbox test failed: ${sandboxResult.error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      hash: await this.calculateHash(packagePath),
    };
  }

  private async analyzeCode(packagePath: string): Promise<AnalysisResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const files = await glob(`${packagePath}/**/*.js`);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');

      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(content)) {
          errors.push(`Dangerous pattern found in ${file}: ${pattern}`);
        }
      }
    }

    return { errors, warnings };
  }
}
```

### 5.3 Package Cache

```typescript
// src/services/package-cache.ts

export class PackageCache {
  private localCache: Map<string, CacheEntry> = new Map();
  private redis: Redis;
  private storagePath: string;

  async ensure(
    agentId: string,
    packageUrl: string,
    expectedHash: string
  ): Promise<string> {
    const cacheKey = `${agentId}:${expectedHash}`;

    // 1. Check local memory cache
    const local = this.localCache.get(cacheKey);
    if (local && local.hash === expectedHash) {
      local.lastAccess = Date.now();
      return local.path;
    }

    // 2. Check local filesystem
    const localPath = path.join(this.storagePath, cacheKey);
    if (await this.verifyLocalFile(localPath, expectedHash)) {
      this.localCache.set(cacheKey, {
        path: localPath,
        hash: expectedHash,
        lastAccess: Date.now(),
      });
      return localPath;
    }

    // 3. Download from storage
    const downloadPath = await this.download(packageUrl, localPath);

    // 4. Verify hash
    const actualHash = await this.calculateHash(downloadPath);
    if (actualHash !== expectedHash) {
      await fs.unlink(downloadPath);
      throw new Error('Package hash mismatch');
    }

    // 5. Extract package
    const extractPath = await this.extract(downloadPath);

    // 6. Update cache
    this.localCache.set(cacheKey, {
      path: extractPath,
      hash: expectedHash,
      lastAccess: Date.now(),
    });

    return extractPath;
  }

  // Periodic cleanup of least recently used entries
  async cleanup(maxAge: number = 3600000) {
    const now = Date.now();

    for (const [key, entry] of this.localCache) {
      if (now - entry.lastAccess > maxAge) {
        this.localCache.delete(key);
        await fs.rm(entry.path, { recursive: true });
      }
    }
  }
}
```

---

## 6. Execution Flow

### 6.1 Complete Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE MESSAGE FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

1. INCOMING MESSAGE
   ─────────────────
   POST /api/chat/{session_id}/message
   { "content": "What's your return policy?" }

                        │
                        ▼

2. SESSION VALIDATION
   ──────────────────
   ┌─────────────────────────────────────────┐
   │ • Validate session token                │
   │ • Load conversation context             │
   │ • Check company subscription            │
   │ • Verify usage limits                   │
   └─────────────────────────────────────────┘

                        │
                        ▼

3. AGENT ROUTING
   ─────────────
   ┌─────────────────────────────────────────┐
   │ • Identify agent from session           │
   │ • Load agent configuration              │
   │ • Check agent status (active)           │
   │ • Acquire from worker pool              │
   └─────────────────────────────────────────┘

                        │
                        ▼

4. CONTEXT BUILDING
   ────────────────
   ┌─────────────────────────────────────────┐
   │ • Load conversation history (Redis)     │
   │ • Build customer context                │
   │ • Prepare system prompt                 │
   │ • Set tool availability                 │
   └─────────────────────────────────────────┘

                        │
                        ▼

5. AGENT EXECUTION (Sandboxed)
   ──────────────────────────
   ┌─────────────────────────────────────────┐
   │ • Load agent package into isolate       │
   │ • Inject context                        │
   │ • Execute processMessage()              │
   │   └── RAG search (if enabled)           │
   │   └── Build LLM messages                │
   │   └── Call LLM with tools               │
   │   └── Process tool calls                │
   │   └── Generate response                 │
   └─────────────────────────────────────────┘

                        │
                        ▼

6. RESPONSE STREAMING
   ──────────────────
   ┌─────────────────────────────────────────┐
   │ SSE Events:                             │
   │   event: thinking                       │
   │   event: tool_call                      │
   │   event: delta (response chunks)        │
   │   event: complete                       │
   └─────────────────────────────────────────┘

                        │
                        ▼

7. POST-PROCESSING
   ───────────────
   ┌─────────────────────────────────────────┐
   │ • Save message to database              │
   │ • Update conversation history           │
   │ • Update usage metrics                  │
   │ • Check escalation conditions           │
   │ • Release worker to pool                │
   └─────────────────────────────────────────┘
```

### 6.2 Streaming Implementation

```typescript
// src/api/chat/stream.ts

export async function streamAgentResponse(
  context: AgentContext,
  agent: Agent
): AsyncGenerator<SSEEvent> {
  const runner = new AgentRunnerService();

  // Stream events from agent execution
  const eventStream = runner.processMessageStream(agent.id, context);

  for await (const event of eventStream) {
    switch (event.type) {
      case 'thinking':
        yield {
          event: 'thinking',
          data: JSON.stringify({
            step: event.step,
            progress: event.progress,
          }),
        };
        break;

      case 'tool_call':
        yield {
          event: 'tool_call',
          data: JSON.stringify({
            tool: event.toolName,
            status: event.status,
          }),
        };
        break;

      case 'delta':
        yield {
          event: 'delta',
          data: JSON.stringify({
            content: event.content,
          }),
        };
        break;

      case 'complete':
        yield {
          event: 'complete',
          data: JSON.stringify({
            content: event.fullContent,
            metadata: event.metadata,
          }),
        };
        break;

      case 'error':
        yield {
          event: 'error',
          data: JSON.stringify({
            message: event.message,
            code: event.code,
          }),
        };
        break;
    }
  }
}
```

---

## 7. Security Model

### 7.1 Sandbox Restrictions

| Resource | Restriction |
|----------|-------------|
| **Memory** | 128MB limit per isolate |
| **CPU Time** | 30s maximum execution |
| **Network** | Allowlist-only external calls |
| **Filesystem** | No access |
| **Child Processes** | Blocked |
| **Native Modules** | Blocked |
| **Global Objects** | Restricted (no `process`, `require`) |

### 7.2 Allowed APIs in Sandbox

```typescript
// Globals available inside agent sandbox
const sandboxGlobals = {
  // Safe standard globals
  console: SafeConsole,
  JSON: JSON,
  Math: Math,
  Date: Date,
  Promise: Promise,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Map: Map,
  Set: Set,
  RegExp: RegExp,

  // Platform APIs (proxied)
  fetch: SafeFetch,           // Allowlisted hosts only
  setTimeout: SafeTimeout,     // Max 30s
  clearTimeout: clearTimeout,

  // Buzzi SDK
  BaseAgent: BaseAgent,
  Tool: Tool,
  RAGService: RAGServiceProxy,
  HistoryService: HistoryServiceProxy,
  LLMClient: LLMClientProxy,
};
```

---

## 8. Monitoring & Observability

### 8.1 Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agent.execution.duration` | Histogram | Time to process message |
| `agent.execution.success` | Counter | Successful executions |
| `agent.execution.error` | Counter | Failed executions |
| `agent.memory.usage` | Gauge | Memory per isolate |
| `agent.worker.pool_size` | Gauge | Active workers |
| `agent.worker.queue_depth` | Gauge | Pending requests |
| `agent.cache.hit` | Counter | Package cache hits |
| `agent.cache.miss` | Counter | Package cache misses |

### 8.2 Logging

```typescript
// Structured logging for agent execution
logger.info('Agent execution started', {
  agentId: agent.id,
  companyId: context.companyId,
  conversationId: context.conversationId,
  requestId: context.requestId,
  channel: context.channel,
});

logger.info('Agent execution completed', {
  agentId: agent.id,
  requestId: context.requestId,
  duration: performance.now() - startTime,
  tokensUsed: response.metadata?.tokens,
  toolsUsed: response.metadata?.toolsUsed,
});
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Database Schema](./database-schema.md)
- [RAG & Knowledge Architecture](./architecture-rag-knowledge.md)
- [Requirements Document](./requirement.v2.md)
