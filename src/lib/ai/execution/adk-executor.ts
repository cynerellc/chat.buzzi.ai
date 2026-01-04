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

// Register OpenAI LLM with ADK at module load
registerOpenAILlm();

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
    temperature: number;
    knowledgeBaseEnabled: boolean;
    knowledgeCategories: string[];
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
      relevanceThreshold: 0.3,
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
    // Try static registry first (for built-in/sample packages)
    this.pkg = getPackage(this.options.packageId);

    // If not found, try dynamic loader (for packages in storage)
    if (!this.pkg) {
      console.log(`[AdkExecutor] Package ${this.options.packageId} not in registry, trying dynamic loader...`);
      this.pkg = await loadPackage(this.options.packageId);
    }

    if (!this.pkg) {
      console.error(`[AdkExecutor] Failed to load package ${this.options.packageId}`);
      return false;
    }

    return true;
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
  private getOrCreateRagService(categories: string[]): RAGService {
    const cacheKey = categories.length > 0
      ? categories.slice().sort().join(",")
      : "__default__";

    let service = this.ragServiceCache.get(cacheKey);
    if (!service) {
      service = new RAGService({
        enabled: true,
        maxResults: 5,
        relevanceThreshold: 0.3,
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
      // SDK tools have toolExecutingMessage and toolCompletedMessage
      const sdkTool = tool as Tool;
      if (sdkTool.toolExecutingMessage || sdkTool.toolCompletedMessage) {
        this.toolMessagesCache.set(tool.name, {
          executing: sdkTool.toolExecutingMessage,
          completed: sdkTool.toolCompletedMessage,
        });
      }
    }
  }

  /**
   * Create ADK LlmAgent from package and configuration
   */
  private createAdkAgent(context: AgentContext): LlmAgent {
    if (!this.pkg) {
      throw new Error("Package not loaded. Call initialize() first.");
    }

    const isMultiAgent = this.isMultiAgentPackage();

    // Get tools from the main agent
    const buzziTools = this.pkg.mainAgent.getTools(context as unknown as SDKAgentContext);
    const adkTools: BaseTool[] = convertToolsToAdk(buzziTools, context);

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
      const supervisorPrompt = this.buildSupervisorSystemPrompt();

      const supervisor = new LlmAgent({
        name: "supervisor",
        model: this.options.agentConfig.modelId,
        instruction: supervisorPrompt,
        tools: adkTools,
        subAgents,
        generateContentConfig: {
          temperature: this.options.agentConfig.temperature / 100,
        },
      });

      // WORKAROUND: Fix ADK bug where rootAgent is not updated when sub-agents are added
      // ADK's setParentAgentForSubAgents() sets parentAgent but not rootAgent on sub-agents.
      // This causes transfer_to_agent to fail when a worker tries to transfer to a sibling,
      // because getAgentByName uses rootAgent.findAgent() which only searches descendants.
      // Without this fix, salesman.rootAgent = salesman (not supervisor), so it can't find accounts.
      this.fixSubAgentRootReferences(supervisor);

      return supervisor;
    } else {
      // Single agent mode
      return new LlmAgent({
        name: "main",
        model: this.options.agentConfig.modelId,
        instruction: this.options.agentConfig.systemPrompt,
        tools: adkTools,
        generateContentConfig: {
          temperature: this.options.agentConfig.temperature / 100,
        },
      });
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

      // Get tools for this worker
      const workerTools: BaseTool[] = [];
      if (buzziWorker) {
        const buzziTools = buzziWorker.getTools(context as unknown as SDKAgentContext);
        workerTools.push(...convertToolsToAdk(buzziTools, context));
        // Cache worker tool messages for SSE notifications
        this.cacheToolMessages(buzziTools);
      }

      // Add knowledge base tool if this worker has KB enabled (using pooled RAGService)
      if (worker.knowledge_categories && worker.knowledge_categories.length > 0) {
        const workerRag = this.getOrCreateRagService(worker.knowledge_categories);
        workerTools.push(
          createKnowledgeBaseTool(workerRag, this.options.companyId, worker.knowledge_categories)
        );
      }

      // Determine description for routing
      // ADK uses the description to decide when to delegate to this sub-agent
      const routingDescription = this.getWorkerRoutingDescription(worker);

      return new LlmAgent({
        name: worker.agent_identifier,
        description: routingDescription,
        model: worker.default_model_id || this.options.agentConfig.modelId,
        instruction: worker.default_system_prompt,
        tools: workerTools,
        generateContentConfig: {
          temperature: (worker.default_temperature ?? 70) / 100,
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
   * Build supervisor system prompt with routing guidance
   */
  private buildSupervisorSystemPrompt(): string {
    const basePrompt = this.options.agentConfig.systemPrompt;
    const workers = this.getWorkerAgents();

    if (workers.length === 0) return basePrompt;

    const routingSection = `

## Multi-Agent Routing

You are a supervisor agent that coordinates with specialized agents. Each agent has specific expertise:

${workers.map((w) => `- **${w.name}** (${w.agent_identifier}): ${w.routing_prompt || w.designation || "General support"}`).join("\n")}

When a customer's request matches an agent's specialty, delegate to them. Handle general greetings and simple queries yourself.`;

    return basePrompt + routingSection;
  }

  /**
   * Process a message with streaming (main entry point)
   */
  async *processMessageStream(
    options: ExecuteMessageOptions
  ): AsyncGenerator<AgentStreamEvent> {
    const startTime = performance.now();
    const sources: RAGSource[] = [];
    const toolsUsed: string[] = [];
    let fullContent = "";

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
          return;
        }
      }

    

      // Get or create session
      await this.sessionAdapter.getOrCreateSession(options.sessionId);

   

      // Get cached runner (creates agent internally if needed)
      const runner = this.getOrCreateRunner(options.context);

      // Track current agent for smart transfer notifications
      let currentAgentId: string | null = null;

      // Prepare user message
      // Use unknown cast to handle @google/genai version mismatch
      const newMessage = {
        role: "user",
        parts: [{ text: options.message }],
      } as unknown as Content;

      // Run the agent with SSE streaming mode for real-time token streaming
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
              fullContent += part.text;
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

      // Save to history
      await this.history.append(options.sessionId, [
        { role: "user", content: options.message },
        { role: "assistant", content: fullContent },
      ]);

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
