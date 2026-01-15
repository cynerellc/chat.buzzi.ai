/**
 * ADK Executor - Google Agent Development Kit Integration
 *
 * This module provides ADK-based execution for chatbot packages:
 * - Converts @buzzi-ai/agent-sdk packages to ADK LlmAgent
 * - Native multi-agent support via ADK sub-agents
 * - Tool conversion from LangChain/SDK to ADK FunctionTool
 * - Streaming execution with event mapping
 */

import { LlmAgent, FunctionTool, Runner, InMemorySessionService, StreamingMode } from "@google/adk";
import type { Session, BaseTool, Event } from "@google/adk";
import { Type } from "@google/genai";
import type { Content, Schema } from "@google/genai";

import { RAGService } from "../rag/service";
import { HistoryService } from "./history-service";
import { registerOpenAILlm } from "../adk/openai-llm";
import { registerGeminiLlm } from "../adk/gemini-llm";

import type {
  AgentContext,
  AgentStreamEvent,
  AgentResponse,
  RAGSource,
  AgentResponseMetadata,
} from "../types";

import type { AgentListItem } from "@/lib/db/schema/chatbots";

import type {
  BuzziAgentPackage,
  Tool,
  LangChainTool,
  AgentContext as SDKAgentContext,
} from "@buzzi-ai/agent-sdk";

import { getPackage } from "@/chatbot-packages/registry";
import { loadPackage } from "@/lib/packages";
import { profiler } from "@/lib/profiler";

// Register LLM providers with ADK at module load
registerOpenAILlm();
registerGeminiLlm();

// ============================================================================
// Constants
// ============================================================================

const APP_NAME = "buzzi-chatbot";
const DEFAULT_USER_ID = "default";

// ============================================================================
// Types
// ============================================================================

export interface AdkExecutorOptions {
  /** Chatbot ID (for RAG and history) */
  chatbotId: string;
  /** Company ID (for RAG filtering) */
  companyId: string;
  /** Package ID (for loading package code) */
  packageId: string;
  /** Agent configuration from database */
  agentConfig: {
    systemPrompt: string;
    modelId: string;
    /** Model settings object (temperature, top_p, etc.) */
    modelSettings: Record<string, unknown>;
    knowledgeBaseEnabled: boolean;
    knowledgeCategories: string[];
    /** Min relevance score for RAG results (0.05-0.95, default 0.3) */
    knowledgeThreshold?: number;
  };
  /** Full agents list config for multi-agent routing */
  agentsListConfig?: AgentListItem[];
}

export interface ExecuteMessageOptions {
  /** The user message */
  message: string;
  /** Conversation/session ID */
  sessionId: string;
  /** Context for tools (includes variables, etc.) */
  context: AgentContext;
}

// ============================================================================
// Tool Conversion Utilities
// ============================================================================

/**
 * Check if a tool is a LangChain tool
 */
function isLangChainTool(tool: Tool | LangChainTool): tool is LangChainTool {
  return "invoke" in tool && typeof tool.invoke === "function";
}

/**
 * Convert SDK tool parameter type to Google Schema Type
 */
function convertParamType(type: string): Type {
  switch (type) {
    case "number":
      return Type.NUMBER;
    case "integer":
      return Type.INTEGER;
    case "boolean":
      return Type.BOOLEAN;
    case "object":
      return Type.OBJECT;
    case "array":
      return Type.ARRAY;
    case "string":
    default:
      return Type.STRING;
  }
}

/**
 * Convert SDK Tool parameters to Google Schema format
 */
function convertToGoogleSchema(tool: Tool): Schema {
  const properties: Record<string, Schema> = {};

  for (const [key, param] of Object.entries(tool.parameters.properties)) {
    const propSchema: Schema = {
      type: convertParamType(param.type),
      description: param.description,
    };

    // Handle enums
    if (param.enum && param.enum.length > 0) {
      propSchema.enum = param.enum;
    }

    properties[key] = propSchema;
  }

  return {
    type: Type.OBJECT,
    properties,
    required: tool.parameters.required || [],
  };
}

/**
 * Convert LangChain tool Zod schema to Google Schema format
 */
function convertZodToGoogleSchema(zodSchema: unknown): Schema | undefined {
  if (!zodSchema) return undefined;

  // Try to extract shape from Zod schema
  const schema = zodSchema as { shape?: Record<string, unknown>; _def?: { shape?: () => Record<string, unknown> } };

  let shapeObj: Record<string, unknown> | undefined;

  if (schema.shape) {
    shapeObj = schema.shape;
  } else if (schema._def?.shape) {
    shapeObj = schema._def.shape();
  }

  if (!shapeObj) return undefined;

  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [key, fieldDef] of Object.entries(shapeObj)) {
    const field = fieldDef as { _def?: { typeName?: string; description?: string; innerType?: unknown } };
    const typeName = field._def?.typeName;
    const description = field._def?.description;

    let schemaType: Type = Type.STRING;

    if (typeName === "ZodNumber") {
      schemaType = Type.NUMBER;
    } else if (typeName === "ZodBoolean") {
      schemaType = Type.BOOLEAN;
    } else if (typeName === "ZodArray") {
      schemaType = Type.ARRAY;
    } else if (typeName === "ZodObject") {
      schemaType = Type.OBJECT;
    }

    // Check if optional
    if (typeName !== "ZodOptional") {
      required.push(key);
    }

    properties[key] = {
      type: schemaType,
      description: description,
    };
  }

  return {
    type: Type.OBJECT,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Convert SDK Tool to ADK FunctionTool using JSON Schema
 */
function sdkToolToAdkTool(tool: Tool, context: AgentContext): FunctionTool<Schema> {
  const schema = convertToGoogleSchema(tool);

  return new FunctionTool<Schema>({
    name: tool.name,
    description: tool.description,
    parameters: schema,
    execute: async (params: unknown) => {
      const result = await tool.execute(params as Record<string, unknown>, context as unknown as SDKAgentContext);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || "Tool execution failed");
    },
  });
}

/**
 * Convert LangChain tool to ADK FunctionTool
 */
function langChainToolToAdkTool(tool: LangChainTool, context: AgentContext): FunctionTool<Schema | undefined> {
  const schema = convertZodToGoogleSchema(tool.schema);

  return new FunctionTool<Schema | undefined>({
    name: tool.name,
    description: tool.description,
    parameters: schema,
    execute: async (params: unknown) => {
      // LangChain tools accept args and a config object
      const result = await tool.invoke(params, {
        configurable: { agentContext: context },
      });
      return result;
    },
  });
}

/**
 * Convert tools to ADK FunctionTool array
 */
function convertToolsToAdk(
  tools: (Tool | LangChainTool)[],
  context: AgentContext
): BaseTool[] {
  return tools.map((tool) => {
    if (isLangChainTool(tool)) {
      return langChainToolToAdkTool(tool, context);
    }
    return sdkToolToAdkTool(tool, context);
  });
}

// ============================================================================
// Knowledge Base Tool
// ============================================================================

/**
 * JSON Schema for knowledge base search parameters
 */
const knowledgeBaseSearchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    query: {
      type: Type.STRING,
      description: "The search query to find relevant information",
    },
  },
  required: ["query"],
};

/**
 * Build knowledge base usage instructions for system prompts.
 * These are GENERIC instructions about HOW to use the tool.
 * Business-specific instructions about WHEN to use it should be
 * configured in the agent's system prompt field by the user.
 *
 * @param categories - The knowledge categories this agent has access to
 */
function buildKnowledgeBaseInstructions(categories?: string[]): string {
  const categoryList = categories && categories.length > 0
    ? categories.map(c => `"${c}"`).join(", ")
    : "all available categories";

  return `

## Knowledge Base Tool

You have access to the \`search_knowledge_base\` tool to retrieve information from the knowledge base.

**Available categories**: ${categoryList}

**How to use**:
- Call \`search_knowledge_base\` with a descriptive query string
- The tool searches across your available knowledge categories and returns relevant information
- Results include content snippets with source references

**Best practices**:
- Search FIRST when the user's question might be answered by documented information
- Use specific, descriptive search queries (e.g., "return policy for electronics" not just "policy")
- If results are found, incorporate them into your response and cite the source
- If no relevant results are found, inform the user and offer alternative assistance
- Prefer searching over asking clarifying questions when the answer might be in the knowledge base`;
}

/**
 * Create a knowledge base search tool for ADK
 */
function createKnowledgeBaseTool(
  ragService: RAGService,
  companyId: string,
  categories?: string[]
): FunctionTool<Schema> {
  return new FunctionTool<Schema>({
    name: "search_knowledge_base",
    description: "Search the company's knowledge base for relevant information. Use this tool to find product details, pricing, policies, or other documented information.",
    parameters: knowledgeBaseSearchSchema,
    execute: async (params: unknown) => {
      const { query } = params as { query: string };
      const results = await ragService.searchWithContext({
        query,
        companyId,
        categories,
      });
      return results.formattedContext || "No relevant information found.";
    },
  });
}

// ============================================================================
// Session Adapter
// ============================================================================

/**
 * Session adapter that bridges HistoryService with ADK's SessionService
 */
class HistorySessionAdapter {
  private sessionService: InMemorySessionService;
  private historyService: HistoryService;

  constructor(historyService: HistoryService) {
    this.sessionService = new InMemorySessionService();
    this.historyService = historyService;
  }

  async getOrCreateSession(sessionId: string): Promise<Session> {
    // Try to get existing session from in-memory service
    try {
      const existing = await this.sessionService.getSession({
        appName: APP_NAME,
        userId: DEFAULT_USER_ID,
        sessionId,
      });
      if (existing) {
        return existing;
      }
    } catch {
      // Session doesn't exist, create it
    }

    // Load history from HistoryService
    const historyMessages = await this.historyService.getForLLM(sessionId);

    // Convert to ADK events/content format
    // Note: ADK sessions store state, not content history directly
    // The history is managed through events in the session

    // Create session with empty state (history is managed separately)
    const session = await this.sessionService.createSession({
      appName: APP_NAME,
      userId: DEFAULT_USER_ID,
      sessionId,
      state: {
        historyLoaded: true,
        messageCount: historyMessages.length,
      },
    });

    return session;
  }

  getSessionService(): InMemorySessionService {
    return this.sessionService;
  }
}

// ============================================================================
// ADK Executor Class
// ============================================================================

export class AdkExecutor {
  private options: AdkExecutorOptions;
  private rag: RAGService;
  private history: HistoryService;
  private pkg: BuzziAgentPackage | null = null;
  private sessionAdapter: HistorySessionAdapter;

  // Caching for performance optimization
  private cachedAgent: LlmAgent | null = null;
  private cachedRunner: Runner | null = null;
  private cachedContext: AgentContext | null = null;
  private ragServiceCache: Map<string, RAGService> = new Map();

  // Tool messages cache: toolName -> { executing, completed }
  private toolMessagesCache: Map<string, { executing?: string; completed?: string }> = new Map();

  constructor(options: AdkExecutorOptions) {
    this.options = options;

    // Initialize RAG service
    this.rag = new RAGService({
      enabled: options.agentConfig.knowledgeBaseEnabled,
      maxResults: 5,
      relevanceThreshold: options.agentConfig.knowledgeThreshold ?? 0.3,
      categories: options.agentConfig.knowledgeCategories.length > 0
        ? options.agentConfig.knowledgeCategories
        : undefined,
    });

    // Initialize history service
    this.history = new HistoryService({
      maxMessages: 50,
      ttlSeconds: 86400,
      enableSummarization: true,
    });

    // Initialize session adapter
    this.sessionAdapter = new HistorySessionAdapter(this.history);
  }

  /**
   * Initialize the executor by loading the package
   * First tries static registry, then falls back to dynamic loader
   */
  async initialize(): Promise<boolean> {
    const initSpan = profiler.startSpan("executor_init", "executor", {
      packageId: this.options.packageId,
    });

    try {
      // Try static registry first (for built-in/sample packages)
      const registrySpan = profiler.startSpan("executor_registry_lookup", "executor");
      this.pkg = getPackage(this.options.packageId);
      registrySpan.end({ found: !!this.pkg });

      // If not found, try dynamic loader (for packages in storage)
      if (!this.pkg) {
        console.log(`[AdkExecutor] Package ${this.options.packageId} not in registry, trying dynamic loader...`);
        const dynamicSpan = profiler.startSpan("executor_dynamic_load", "executor");
        this.pkg = await loadPackage(this.options.packageId);
        dynamicSpan.end({ found: !!this.pkg });
      }

      if (!this.pkg) {
        console.error(`[AdkExecutor] Failed to load package ${this.options.packageId}`);
        return false;
      }

      return true;
    } finally {
      initSpan.end();
    }
  }

  /**
   * Check if this is a multi-agent package
   */
  private isMultiAgentPackage(): boolean {
    if (!this.options.agentsListConfig || this.options.agentsListConfig.length <= 1) {
      return false;
    }
    return this.options.agentsListConfig.some((a) => a.agent_type === "supervisor");
  }

  /**
   * Get worker agents from configuration
   */
  private getWorkerAgents(): AgentListItem[] {
    if (!this.options.agentsListConfig) return [];
    return this.options.agentsListConfig.filter((a) => a.agent_type === "worker");
  }

  /**
   * Get or create a RAGService from pool (avoids duplicate instances)
   */
  private getOrCreateRagService(categories: string[], threshold?: number): RAGService {
    const thresholdValue = threshold ?? 0.3;
    const cacheKey = categories.length > 0
      ? `${categories.slice().sort().join(",")}_${thresholdValue}`
      : `__default__${thresholdValue}`;

    let service = this.ragServiceCache.get(cacheKey);
    if (!service) {
      service = new RAGService({
        enabled: true,
        maxResults: 5,
        relevanceThreshold: thresholdValue,
        categories: categories.length > 0 ? categories : undefined,
      });
      this.ragServiceCache.set(cacheKey, service);
    }
    return service;
  }

  /**
   * Get or create cached ADK agent
   */
  private getOrCreateAdkAgent(context: AgentContext): LlmAgent {
    if (this.cachedAgent && this.cachedContext === context) {
      return this.cachedAgent;
    }

    this.cachedAgent = this.createAdkAgent(context);
    this.cachedContext = context;
    return this.cachedAgent;
  }

  /**
   * Get or create cached Runner
   */
  private getOrCreateRunner(context: AgentContext): Runner {
    if (this.cachedRunner && this.cachedContext === context) {
      return this.cachedRunner;
    }

    const adkAgent = this.getOrCreateAdkAgent(context);
    this.cachedRunner = new Runner({
      appName: APP_NAME,
      agent: adkAgent,
      sessionService: this.sessionAdapter.getSessionService(),
    });
    return this.cachedRunner;
  }

  /**
   * Invalidate cached agent and runner (call when config changes)
   */
  invalidateCache(): void {
    this.cachedAgent = null;
    this.cachedRunner = null;
    this.cachedContext = null;
  }

  /**
   * Cache tool messages for SSE notifications
   */
  private cacheToolMessages(tools: (Tool | LangChainTool)[]): void {
    for (const tool of tools) {
      // Check for toolExecutingMessage and toolCompletedMessage on the tool object
      // These can be on SDK tools or LangChain tools with Object.assign'd properties
      const toolWithMessages = tool as Tool & {
        toolExecutingMessage?: string;
        toolCompletedMessage?: string;
      };

      if (toolWithMessages.toolExecutingMessage || toolWithMessages.toolCompletedMessage) {
        console.log(`[AdkExecutor] Caching tool messages for "${tool.name}":`, {
          executing: toolWithMessages.toolExecutingMessage,
          completed: toolWithMessages.toolCompletedMessage,
        });
        this.toolMessagesCache.set(tool.name, {
          executing: toolWithMessages.toolExecutingMessage,
          completed: toolWithMessages.toolCompletedMessage,
        });
      }
    }
  }

  /**
   * Create ADK LlmAgent from package and configuration
   */
  private createAdkAgent(context: AgentContext): LlmAgent {
    const createAgentSpan = profiler.startSpan("executor_create_agent", "executor");

    if (!this.pkg) {
      createAgentSpan.end();
      throw new Error("Package not loaded. Call initialize() first.");
    }

    const isMultiAgent = this.isMultiAgentPackage();

    // Get tools from the main agent
    const toolsSpan = profiler.startSpan("executor_get_tools", "executor");
    const buzziTools = this.pkg.mainAgent.getTools(context as unknown as SDKAgentContext);
    toolsSpan.end({ toolCount: buzziTools.length });

    const convertSpan = profiler.startSpan("executor_convert_tools", "executor");
    const adkTools: BaseTool[] = convertToolsToAdk(buzziTools, context);
    convertSpan.end();

    // Cache tool messages for SSE notifications
    this.cacheToolMessages(buzziTools);

    // Add knowledge base tool if enabled
    if (this.rag.isEnabled()) {
      adkTools.push(
        createKnowledgeBaseTool(
          this.rag,
          this.options.companyId,
          this.options.agentConfig.knowledgeCategories.length > 0
            ? this.options.agentConfig.knowledgeCategories
            : undefined
        )
      );
      // Add default messages for knowledge base tool
      this.toolMessagesCache.set("search_knowledge_base", {
        executing: "Searching knowledge base...",
        completed: "Knowledge retrieved",
      });
    }

    if (isMultiAgent) {
      // Create sub-agents for workers
      const subAgents = this.createSubAgents(context);

      // Build supervisor system prompt with routing guidance
      // Also add KB instructions if enabled (with available categories)
      let supervisorPrompt = this.buildSupervisorSystemPrompt();
      if (this.rag.isEnabled()) {
        const categories = this.options.agentConfig.knowledgeCategories;
        supervisorPrompt += buildKnowledgeBaseInstructions(categories);
      }

      // Get temperature from modelSettings
      const supervisorTemp = typeof this.options.agentConfig.modelSettings.temperature === "number"
        ? this.options.agentConfig.modelSettings.temperature
        : 0.7;

      const supervisor = new LlmAgent({
        name: "supervisor",
        model: this.options.agentConfig.modelId,
        instruction: supervisorPrompt,
        tools: adkTools,
        subAgents,
        generateContentConfig: {
          temperature: supervisorTemp,
        },
      });

      // WORKAROUND: Fix ADK bug where rootAgent is not updated when sub-agents are added
      // ADK's setParentAgentForSubAgents() sets parentAgent but not rootAgent on sub-agents.
      // This causes transfer_to_agent to fail when a worker tries to transfer to a sibling,
      // because getAgentByName uses rootAgent.findAgent() which only searches descendants.
      // Without this fix, salesman.rootAgent = salesman (not supervisor), so it can't find accounts.
      this.fixSubAgentRootReferences(supervisor);

      createAgentSpan.end({ mode: "multi-agent", subAgentCount: subAgents.length });
      return supervisor;
    } else {
      // Single agent mode
      // Get temperature from modelSettings
      const singleAgentTemp = typeof this.options.agentConfig.modelSettings.temperature === "number"
        ? this.options.agentConfig.modelSettings.temperature
        : 0.7;

      // Augment system prompt with KB instructions if knowledge base is enabled
      // Include the available categories so the agent knows what it can search
      const singleAgentPrompt = this.rag.isEnabled()
        ? this.options.agentConfig.systemPrompt + buildKnowledgeBaseInstructions(this.options.agentConfig.knowledgeCategories)
        : this.options.agentConfig.systemPrompt;

      const agent = new LlmAgent({
        name: "main",
        model: this.options.agentConfig.modelId,
        instruction: singleAgentPrompt,
        tools: adkTools,
        generateContentConfig: {
          temperature: singleAgentTemp,
        },
      });

      createAgentSpan.end({ mode: "single-agent" });
      return agent;
    }
  }

  /**
   * Create sub-agents for multi-agent packages
   */
  private createSubAgents(context: AgentContext): LlmAgent[] {
    const workers = this.getWorkerAgents();
    if (!this.pkg) return [];

    return workers.map((worker) => {
      // Find the BuzziAgent for this worker
      const buzziWorker = this.pkg!.getAgent(worker.agent_identifier);

      console.log(`[AdkExecutor] Creating sub-agent "${worker.agent_identifier}":`, {
        found: !!buzziWorker,
        packageAgentIds: this.pkg!.getAllAgents().map(a => a.agentId),
      });

      // Get tools for this worker
      const workerTools: BaseTool[] = [];
      if (buzziWorker) {
        const buzziTools = buzziWorker.getTools(context as unknown as SDKAgentContext);
        console.log(`[AdkExecutor] Worker "${worker.agent_identifier}" tools:`, buzziTools.map(t => t.name));
        workerTools.push(...convertToolsToAdk(buzziTools, context));
        // Cache worker tool messages for SSE notifications
        this.cacheToolMessages(buzziTools);
      } else {
        console.warn(`[AdkExecutor] Worker agent "${worker.agent_identifier}" not found in package`);
      }

      // Check if this worker has knowledge base enabled
      const workerHasKb = worker.knowledge_base_enabled === true &&
        worker.knowledge_categories &&
        worker.knowledge_categories.length > 0;

      // Add knowledge base tool if this worker has KB enabled (using pooled RAGService)
      if (workerHasKb) {
        const workerRag = this.getOrCreateRagService(worker.knowledge_categories!, worker.knowledge_threshold);
        workerTools.push(
          createKnowledgeBaseTool(workerRag, this.options.companyId, worker.knowledge_categories)
        );
        // Cache tool messages for worker KB tool
        this.toolMessagesCache.set("search_knowledge_base", {
          executing: "Searching knowledge base...",
          completed: "Knowledge retrieved",
        });
      }

      // Determine description for routing
      // ADK uses the description to decide when to delegate to this sub-agent
      const routingDescription = this.getWorkerRoutingDescription(worker);

      // Get temperature from model_settings or use default
      const workerModelSettings = worker.model_settings ?? { temperature: 0.7 };
      const workerTemperature = typeof workerModelSettings.temperature === "number"
        ? workerModelSettings.temperature
        : 0.7;

      // Augment system prompt with KB instructions if this worker has KB enabled
      // Include this worker's specific categories so it knows what it can search
      const workerPrompt = workerHasKb
        ? worker.default_system_prompt + buildKnowledgeBaseInstructions(worker.knowledge_categories)
        : worker.default_system_prompt;

      return new LlmAgent({
        name: worker.agent_identifier,
        description: routingDescription,
        model: worker.default_model_id || this.options.agentConfig.modelId,
        instruction: workerPrompt,
        tools: workerTools,
        generateContentConfig: {
          temperature: workerTemperature,
        },
      });
    });
  }

  /**
   * Fix rootAgent references on all sub-agents recursively.
   *
   * ADK Bug: When sub-agents are created before being added to a parent,
   * their `rootAgent` is set to themselves in the constructor. When the parent
   * calls `setParentAgentForSubAgents()`, it sets `parentAgent` but never
   * updates `rootAgent`. This breaks `getAgentByName()` which uses
   * `rootAgent.findAgent()` to locate agents for transfer.
   *
   * This method walks the agent tree and fixes all rootAgent references
   * to point to the actual root (supervisor).
   */
  private fixSubAgentRootReferences(rootAgent: LlmAgent): void {
    const fixRecursively = (agent: LlmAgent) => {
      // TypeScript doesn't allow direct assignment to readonly property,
      // but we need to fix ADK's bug. Use Object.defineProperty.
      if (agent.rootAgent !== rootAgent) {
        Object.defineProperty(agent, 'rootAgent', {
          value: rootAgent,
          writable: false,
          configurable: true,
        });
      }

      // Recursively fix sub-agents
      for (const subAgent of agent.subAgents) {
        if (subAgent instanceof LlmAgent) {
          fixRecursively(subAgent);
        }
      }
    };

    // Fix all sub-agents of the root
    for (const subAgent of rootAgent.subAgents) {
      if (subAgent instanceof LlmAgent) {
        fixRecursively(subAgent);
      }
    }
  }

  /**
   * Get routing description for a worker agent
   */
  private getWorkerRoutingDescription(worker: AgentListItem): string {
    // Combine available info into a routing description
    const parts: string[] = [];

    // Use routing_prompt first (this is the "Duties" field in UI)
    if (worker.routing_prompt) {
      parts.push(worker.routing_prompt);
    } else if (worker.designation) {
      parts.push(worker.designation);
    }

    if (worker.name && parts.length === 0) {
      parts.push(`Named: ${worker.name}`);
    }

    // Add knowledge categories as specialization hints
    if (worker.knowledge_categories && worker.knowledge_categories.length > 0) {
      parts.push(`Expertise in: ${worker.knowledge_categories.join(", ")}`);
    }

    return parts.join(". ") || `Agent: ${worker.agent_identifier}`;
  }

  /**
   * Build supervisor system prompt.
   *
   * ADK handles multi-agent routing natively using sub-agent descriptions.
   * Each worker's description (set via getWorkerRoutingDescription()) includes:
   * - routing_prompt (labeled "Duties" in UI)
   * - designation (e.g., "Sales Specialist")
   * - knowledge_categories (expertise areas)
   *
   * ADK uses these descriptions to determine when to delegate control.
   * Removing manual routing instructions reduces token count and improves latency.
   *
   * @see getWorkerRoutingDescription() for description construction
   */
  private buildSupervisorSystemPrompt(): string {
    return this.options.agentConfig.systemPrompt;
  }

  /**
   * Process a message with streaming (main entry point)
   */
  async *processMessageStream(
    options: ExecuteMessageOptions
  ): AsyncGenerator<AgentStreamEvent> {
    const streamSpan = profiler.startSpan("executor_process_stream", "streaming", {
      sessionId: options.sessionId,
    });
    const startTime = performance.now();
    const sources: RAGSource[] = [];
    const toolsUsed: string[] = [];
    const contentBuffer: string[] = []; // Use array for efficient string building

    try {
      // Ensure package is loaded
      if (!this.pkg) {
        yield {
          type: "thinking",
          data: { step: "Loading agent package...", progress: 0.1 },
          timestamp: Date.now(),
        };

        if (!(await this.initialize())) {
          yield {
            type: "error",
            data: {
              code: "PACKAGE_LOAD_ERROR",
              message: "Failed to load agent package",
              retryable: true,
            },
            timestamp: Date.now(),
          };
          streamSpan.end({ error: "PACKAGE_LOAD_ERROR" });
          return;
        }
      }

    

      // Detailed timing for ADK executor internals
      const adkTimings: Record<string, number> = {};
      const adkStart = performance.now();
      let adkStepStart = performance.now();

      // Get or create session
      const sessionSpan = profiler.startSpan("executor_session_load", "context");
      await this.sessionAdapter.getOrCreateSession(options.sessionId);
      sessionSpan.end();
      adkTimings.sessionLoad = performance.now() - adkStepStart;
      adkStepStart = performance.now();

      // Get cached runner (creates agent internally if needed)
      const runnerSpan = profiler.startSpan("executor_get_runner", "executor");
      const runner = this.getOrCreateRunner(options.context);
      runnerSpan.end();
      adkTimings.runnerCreate = performance.now() - adkStepStart;
      adkStepStart = performance.now();

      // Track current agent for smart transfer notifications
      let currentAgentId: string | null = null;

      // =========================================================================
      // Early Escalation Detection
      // Check if the user is explicitly requesting human assistance BEFORE
      // running through multi-agent routing. This prevents routing loops and
      // duplicate transfer notifications for clear escalation requests.
      // =========================================================================
      const escalationKeywords = [
        /\b(talk|speak|chat)\s+(to|with)\s+(a\s+)?(real\s+)?(human|person|agent|representative|rep|somebody|someone)\b/i,
        /\b(want|need|require|get)\s+(a\s+)?(human|real\s+person|real\s+agent|live\s+agent)\b/i,
        /\bnot\s+(an?\s+)?ai\b/i,
        /\breal\s+(human|person)\s+please\b/i,
        /\bhuman\s+(agent|support|help)\s*(please)?\b/i,
        /\bconnect\s+(me\s+)?(to|with)\s+(a\s+)?human\b/i,
        /\btransfer\s+(me\s+)?(to\s+)?(a\s+)?human\b/i,
        /\bescalate\s+(to\s+)?(a\s+)?human\b/i,
      ];

      const messageNormalized = options.message.toLowerCase();
      const isExplicitEscalationRequest = escalationKeywords.some(pattern => pattern.test(messageNormalized));

      if (isExplicitEscalationRequest) {
        console.log(`[AdkExecutor] Detected explicit human escalation request: "${options.message.substring(0, 50)}..."`);

        // Find the primary agent info for the escalation event
        const agentsList = this.options.agentsListConfig || [];
        const primaryAgent = agentsList.find((a) => a.agent_type === "supervisor") || agentsList[0];
        const agentName = primaryAgent?.name || "Assistant";
        const agentId = primaryAgent?.agent_identifier || "main";

        // Emit human escalation event immediately - bypass multi-agent routing
        yield {
          type: "human_escalation",
          data: {
            reason: "Customer explicitly requested human assistance",
            urgency: "high",
            initiatingAgentId: agentId,
            initiatingAgentName: agentName,
          },
          timestamp: Date.now(),
        };

        streamSpan.end({ earlyEscalation: true });
        return; // Exit early - don't process through agents
      }

      // Prepare user message
      // Use unknown cast to handle @google/genai version mismatch
      const newMessage = {
        role: "user",
        parts: [{ text: options.message }],
      } as unknown as Content;

      // Run the agent with SSE streaming mode for real-time token streaming
      const llmSpan = profiler.startSpan("llm_inference", "llm", {
        modelId: this.options.agentConfig.modelId,
      });
      let tokenCount = 0;
      let firstTokenTime: number | null = null;
      const llmCallStart = performance.now();

      for await (const event of runner.runAsync({
        userId: DEFAULT_USER_ID,
        sessionId: options.sessionId,
        newMessage: newMessage as unknown as Parameters<typeof runner.runAsync>[0]["newMessage"],
        runConfig: {
          streamingMode: StreamingMode.SSE,
        },
      })) {
        // Map ADK events to AgentStreamEvent
        const adkEvent = event as Event;

        // Check for text content
        if (adkEvent.content?.parts) {
          for (const part of adkEvent.content.parts) {
            if ("text" in part && part.text) {
              // Track time to first token
              if (!firstTokenTime) {
                firstTokenTime = performance.now() - llmCallStart;
              }
              contentBuffer.push(part.text);
              tokenCount++;
              yield {
                type: "delta",
                data: { content: part.text },
                timestamp: Date.now(),
              };
            }

            // Check for function calls
            if ("functionCall" in part && part.functionCall) {
              const funcCall = part.functionCall;

              // Filter out internal ADK transfer mechanism - NOT a user-visible tool
              // ADK handles multi-agent transfers natively via EventActions.transferToAgent
              if (funcCall.name === "transfer_to_agent" || funcCall.name === "transferToAgent") {
                console.debug(`[AdkExecutor] Internal transfer call: ${JSON.stringify(funcCall.args)}`);
                continue; // Skip - actual transfer handled via EventActions below
              }

              const toolName = funcCall.name || "unknown";
              toolsUsed.push(toolName);

              // Start tool profiling span
              profiler.startSpan(`tool:${toolName}`, "tool");

              // Look up custom notification message from tool definition
              const toolMessages = this.toolMessagesCache.get(toolName);

              yield {
                type: "tool_call",
                data: {
                  toolName,
                  status: "executing",
                  notification: toolMessages?.executing,
                  arguments: funcCall.args,
                },
                timestamp: Date.now(),
              };
            }

            // Check for function responses
            if ("functionResponse" in part && part.functionResponse) {
              const funcResp = part.functionResponse;

              // Also filter transfer tool responses
              if (funcResp.name === "transfer_to_agent" || funcResp.name === "transferToAgent") {
                continue;
              }

              const toolName = funcResp.name || "unknown";

              // End tool profiling span
              profiler.getActiveSpan(`tool:${toolName}`)?.end();

              // Check for human escalation request
              if (toolName === "request_human_handover") {
                const response = funcResp.response as { action?: string; reason?: string; urgency?: string } | undefined;
                if (response?.action === "escalate") {
                  // Emit human escalation event and signal to stop processing
                  yield {
                    type: "human_escalation",
                    data: {
                      reason: response.reason || "Customer requested human assistance",
                      urgency: response.urgency || "medium",
                      initiatingAgentId: currentAgentId || undefined,
                      initiatingAgentName: currentAgentId
                        ? this.options.agentsListConfig?.find((a) => a.agent_identifier === currentAgentId)?.name
                        : undefined,
                    },
                    timestamp: Date.now(),
                  };
                  // Return early - don't continue processing after escalation
                  return;
                }
              }

              // Look up custom notification message from tool definition
              const toolMessages = this.toolMessagesCache.get(toolName);

              yield {
                type: "tool_call",
                data: {
                  toolName,
                  status: "completed",
                  notification: toolMessages?.completed,
                  result: { success: true, data: funcResp.response },
                },
                timestamp: Date.now(),
              };
            }
          }
        }

        // Check for agent transfer (sub-agent delegation) - smart notification
        if (adkEvent.actions?.transferToAgent && adkEvent.actions.transferToAgent !== adkEvent.author) {
          const targetAgentId = adkEvent.actions.transferToAgent;

          // Only emit notification if agent actually changed
          if (targetAgentId !== currentAgentId) {
            const previousAgentId = currentAgentId;
            currentAgentId = targetAgentId;

            // Look up agent details from config
            const targetAgent = this.options.agentsListConfig?.find(
              (a) => a.agent_identifier === targetAgentId
            );

            // Look up previous agent details
            const previousAgent = previousAgentId
              ? this.options.agentsListConfig?.find(
                  (a) => a.agent_identifier === previousAgentId
                )
              : null;

            yield {
              type: "notification",
              data: {
                message: `${targetAgent?.name || targetAgentId} has joined`,
                targetAgentId: targetAgentId,
                targetAgentName: targetAgent?.name || targetAgentId,
                targetAgentDesignation: targetAgent?.designation,
                targetAgentAvatarUrl: targetAgent?.avatar_url,
                previousAgentId: previousAgentId,
                previousAgentName: previousAgent?.name,
                previousAgentAvatarUrl: previousAgent?.avatar_url,
                level: "info",
              },
              timestamp: Date.now(),
            };
          }
        }
      }

      // End LLM inference span
      const llmTotalTime = performance.now() - llmCallStart;
      adkTimings.llmInference = llmTotalTime;
      adkTimings.timeToFirstToken = firstTokenTime ?? llmTotalTime;
      llmSpan.end({ tokenCount, toolsUsed: toolsUsed.length });

      // Build full content from buffer
      const fullContent = contentBuffer.join("");

      // Save to history
      const historyStart = performance.now();
      const historySpan = profiler.startSpan("executor_history_save", "db");
      await this.history.append(options.sessionId, [
        { role: "user", content: options.message },
        { role: "assistant", content: fullContent },
      ]);
      historySpan.end();
      adkTimings.historySave = performance.now() - historyStart;
      adkTimings.total = performance.now() - adkStart;

      // Print detailed ADK timing report if profiler enabled
      if (process.env.ENABLE_PROFILER === "true") {
        console.log("\n[AdkExecutor] Detailed Timing Breakdown:");
        console.log("─".repeat(50));
        for (const [key, value] of Object.entries(adkTimings)) {
          const pct = ((value / adkTimings.total) * 100).toFixed(1);
          console.log(`  ${key.padEnd(25)} ${value.toFixed(2).padStart(10)}ms (${pct.padStart(5)}%)`);
        }
        console.log(`  ${"tokenCount".padEnd(25)} ${String(tokenCount).padStart(10)}`);
        console.log("─".repeat(50));
      }

      // Emit complete event
      const processingTimeMs = performance.now() - startTime;

      yield {
        type: "complete",
        data: {
          content: fullContent,
          metadata: {
            sources: sources.length > 0 ? sources : undefined,
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            processingTimeMs,
            modelId: this.options.agentConfig.modelId,
          },
        },
        timestamp: Date.now(),
      };

      streamSpan.end({ success: true, processingTimeMs, tokenCount });
    } catch (error) {
      console.error("[AdkExecutor] Streaming error:", error);

      yield {
        type: "error",
        data: {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "An error occurred",
          retryable: true,
        },
        timestamp: Date.now(),
      };

      streamSpan.end({ error: true });
    }
  }

  /**
   * Process a message (non-streaming)
   */
  async processMessage(options: ExecuteMessageOptions): Promise<AgentResponse> {
    let fullContent = "";
    let metadata: AgentResponseMetadata = {};

    for await (const event of this.processMessageStream(options)) {
      if (event.type === "delta") {
        fullContent += (event.data as { content: string }).content;
      } else if (event.type === "complete") {
        const completeData = event.data as { content: string; metadata: AgentResponseMetadata };
        fullContent = completeData.content;
        metadata = completeData.metadata;
      } else if (event.type === "error") {
        return {
          content: "I apologize, but I'm having trouble processing your request. Please try again.",
          metadata: { processingTimeMs: metadata.processingTimeMs || 0 },
        };
      }
    }

    return {
      content: fullContent,
      metadata,
    };
  }

  /**
   * Get package info
   */
  getPackageInfo(): { packageId: string; packageType: string; agentCount: number } | null {
    if (!this.pkg) return null;

    const metadata = this.pkg.getMetadata();
    return {
      packageId: metadata.packageId,
      packageType: metadata.packageType,
      agentCount: metadata.agentCount,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAdkExecutor(options: AdkExecutorOptions): AdkExecutor {
  return new AdkExecutor(options);
}
