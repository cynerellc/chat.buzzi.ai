/**
 * Agent Runner Service
 *
 * This service manages the lifecycle of AI agents:
 * - Loading agent configurations from database
 * - Caching agent instances
 * - Routing messages to appropriate agents
 * - Managing agent execution
 *
 * Uses AdkExecutor for chatbot execution via Google ADK
 */

import { db } from "@/lib/db";
import {
  chatbots,
  chatbotPackages,
  type PackageVariableDefinition,
  type AgentListItem,
} from "@/lib/db/schema/chatbots";
import { conversations, messages as messagesTable } from "@/lib/db/schema/conversations";
import { companies } from "@/lib/db/schema/companies";
import { eq, and } from "drizzle-orm";

import { AdkExecutor, createAdkExecutor } from "./adk-executor";
import { createVariableContext } from "../types";
import { profiler } from "@/lib/profiler";

import type {
  AgentContext,
  AgentResponse,
  AgentStreamEvent,
  ChannelType,
  VariableValue,
  VariableContext,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export interface CreateSessionOptions {
  agentId: string;
  companyId: string;
  channel: ChannelType;
  endUserId?: string;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
  pageUrl?: string;
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionInfo {
  conversationId: string;
  agentId: string;
  companyId: string;
  greeting: string;
}

export interface SendMessageOptions {
  conversationId: string;
  message: string;
  attachments?: Array<{
    type: "image" | "file" | "audio";
    url: string;
    mimeType: string;
    fileName?: string;
  }>;
}

// ============================================================================
// Agent Cache with Activity-Based Eviction
// ============================================================================

interface ExecutorCacheEntry {
  executor: AdkExecutor;
  lastActivity: number;  // Timestamp of last activity
  chatbotId: string;     // For logging
}

interface ExecutorCacheConfig {
  inactivityTTL: number;    // Time before evicting inactive executors (default: 3 hours)
  cleanupInterval: number;  // How often to run cleanup (default: 15 minutes)
  maxExecutors: number;     // Maximum number of cached executors (default: 100)
}

const DEFAULT_EXECUTOR_CACHE_CONFIG: ExecutorCacheConfig = {
  inactivityTTL: 3 * 60 * 60 * 1000,    // 3 hours
  cleanupInterval: 15 * 60 * 1000,       // 15 minutes
  maxExecutors: 100,
};

class ExecutorCache {
  private cache: Map<string, ExecutorCacheEntry> = new Map();
  private config: ExecutorCacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ExecutorCacheConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTOR_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get an executor from cache, updating its activity timestamp
   */
  get(chatbotId: string): AdkExecutor | undefined {
    const entry = this.cache.get(chatbotId);
    if (entry) {
      const now = Date.now();
      // Check if expired
      if (now - entry.lastActivity > this.config.inactivityTTL) {
        console.log(`[ExecutorCache] Executor ${chatbotId} expired after ${this.formatDuration(now - entry.lastActivity)} of inactivity`);
        this.cache.delete(chatbotId);
        return undefined;
      }
      // Update activity timestamp on access
      entry.lastActivity = now;
      return entry.executor;
    }
    return undefined;
  }

  /**
   * Store an executor in cache
   */
  set(chatbotId: string, executor: AdkExecutor): void {
    // Check if we're at capacity
    if (this.cache.size >= this.config.maxExecutors && !this.cache.has(chatbotId)) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(chatbotId, {
      executor,
      lastActivity: Date.now(),
      chatbotId,
    });

    console.log(`[ExecutorCache] Cached executor for ${chatbotId}, total: ${this.cache.size}`);
  }

  /**
   * Record activity for an executor (call when processing messages)
   */
  touch(chatbotId: string): void {
    const entry = this.cache.get(chatbotId);
    if (entry) {
      entry.lastActivity = Date.now();
    }
  }

  /**
   * Remove an executor from cache
   */
  delete(chatbotId: string): void {
    this.cache.delete(chatbotId);
  }

  /**
   * Clear all cached executors
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Start the background cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Ensure timer doesn't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the cleanup timer (for testing/shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove expired executors
   */
  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [chatbotId, entry] of this.cache.entries()) {
      const inactiveFor = now - entry.lastActivity;
      if (inactiveFor > this.config.inactivityTTL) {
        this.cache.delete(chatbotId);
        evicted++;
        console.log(`[ExecutorCache] Evicted ${chatbotId} after ${this.formatDuration(inactiveFor)} of inactivity`);
      }
    }

    if (evicted > 0) {
      console.log(`[ExecutorCache] Cleanup: evicted ${evicted} executors, remaining: ${this.cache.size}`);
    }
  }

  /**
   * Evict the least recently used executor when at capacity
   */
  private evictLeastRecentlyUsed(): void {
    let oldest: { chatbotId: string; lastActivity: number } | null = null;

    for (const [chatbotId, entry] of this.cache.entries()) {
      if (!oldest || entry.lastActivity < oldest.lastActivity) {
        oldest = { chatbotId, lastActivity: entry.lastActivity };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.chatbotId);
      console.log(`[ExecutorCache] Evicted LRU executor ${oldest.chatbotId} (cache at capacity: ${this.config.maxExecutors})`);
    }
  }

  /**
   * Format duration for logging
   */
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getStats(): {
    size: number;
    maxSize: number;
    inactivityTTL: number;
    entries: Array<{ chatbotId: string; idleTime: number }>;
  } {
    const now = Date.now();
    return {
      size: this.cache.size,
      maxSize: this.config.maxExecutors,
      inactivityTTL: this.config.inactivityTTL,
      entries: Array.from(this.cache.entries()).map(([chatbotId, entry]) => ({
        chatbotId,
        idleTime: now - entry.lastActivity,
      })),
    };
  }
}

// ============================================================================
// Agent Runner Service
// ============================================================================

export class AgentRunnerService {
  private executorCache: ExecutorCache;

  constructor() {
    this.executorCache = new ExecutorCache();
  }

  /**
   * Load a chatbot executor by ID
   */
  async loadExecutor(chatbotId: string): Promise<AdkExecutor | null> {
    const loadSpan = profiler.startSpan("runner_load_executor", "executor", { chatbotId });

    // Check cache first
    const cacheSpan = profiler.startSpan("runner_cache_check", "executor");
    const cached = this.executorCache.get(chatbotId);
    cacheSpan.end({ hit: !!cached });

    if (cached) {
      loadSpan.end({ fromCache: true });
      return cached;
    }

    // Load chatbot with package info
    const dbSpan = profiler.startSpan("db_load_chatbot", "db");
    const chatbotData = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        packageId: chatbots.packageId,
        packageType: chatbots.packageType,
        agentsList: chatbots.agentsList,
        variableValues: chatbots.variableValues,
        status: chatbots.status,
        // Package fields
        packageSlug: chatbotPackages.slug,
        packageVariables: chatbotPackages.variables,
      })
      .from(chatbots)
      .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.status, "active")))
      .limit(1);
    dbSpan.end({ found: chatbotData.length > 0 });

    if (chatbotData.length === 0) {
      console.error(`[AgentRunner] Chatbot ${chatbotId} not found or not active`);
      loadSpan.end({ error: "not_found" });
      return null;
    }

    const chatbot = chatbotData[0];
    if (!chatbot) {
      loadSpan.end({ error: "no_data" });
      return null;
    }

    // Get agents list
    const agentsList = chatbot.agentsList as AgentListItem[] || [];
    if (agentsList.length === 0) {
      console.error(`[AgentRunner] Chatbot ${chatbotId} has no agents configured`);
      loadSpan.end({ error: "no_agents" });
      return null;
    }

    // Find the primary agent (first supervisor or first agent)
    const primaryAgent = agentsList.find((a) => a.agent_type === "supervisor") || agentsList[0];
    if (!primaryAgent) {
      console.error(`[AgentRunner] Chatbot ${chatbotId} has no primary agent`);
      loadSpan.end({ error: "no_primary_agent" });
      return null;
    }

    // Use primary agent's knowledge base settings (not aggregated from all agents)
    // KB is enabled only if BOTH: knowledge_base_enabled is true AND categories are configured
    const hasKbCategories = Array.isArray(primaryAgent.knowledge_categories) &&
      primaryAgent.knowledge_categories.length > 0;
    const primaryKbEnabled = primaryAgent.knowledge_base_enabled === true && hasKbCategories;
    const primaryKbCategories = primaryKbEnabled ? primaryAgent.knowledge_categories! : [];

    // Build AdkExecutor options
    const executorOptions = {
      chatbotId: chatbot.id,
      companyId: chatbot.companyId,
      packageId: chatbot.packageId || chatbot.id, // Use package UUID for registry lookup
      agentConfig: {
        systemPrompt: primaryAgent.default_system_prompt,
        modelId: primaryAgent.default_model_id,
        modelSettings: primaryAgent.model_settings ?? { temperature: 0.7 },
        knowledgeBaseEnabled: primaryKbEnabled,
        knowledgeCategories: primaryKbCategories,
        knowledgeThreshold: primaryAgent.knowledge_threshold,
      },
      agentsListConfig: agentsList,
    };

    // Create executor
    const executor = createAdkExecutor(executorOptions);

    // Initialize the executor (load package - may be async if from storage)
    const initSpan = profiler.startSpan("runner_init_executor", "executor");
    const initialized = await executor.initialize();
    initSpan.end({ success: initialized });

    if (!initialized) {
      console.error(`[AgentRunner] Failed to initialize executor for ${chatbotId}`);
      loadSpan.end({ error: "init_failed" });
      return null;
    }

    // Cache the executor
    this.executorCache.set(chatbotId, executor);

    console.log(`[AgentRunner] Loaded executor for chatbot ${chatbotId}`);
    loadSpan.end({ fromCache: false });
    return executor;
  }

  /**
   * Load an agent by ID (legacy method - now loads executor)
   * @deprecated Use loadExecutor instead
   */
  async loadAgent(agentId: string): Promise<AdkExecutor | null> {
    return this.loadExecutor(agentId);
  }

  /**
   * Create a new chat session (conversation)
   */
  async createSession(options: CreateSessionOptions): Promise<SessionInfo | null> {
    // Verify chatbot exists and is active
    const chatbotData = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, options.agentId),
          eq(chatbots.companyId, options.companyId),
          eq(chatbots.status, "active")
        )
      )
      .limit(1);

    const chatbot = chatbotData[0];
    if (!chatbot) {
      return null;
    }

    // Verify company subscription is active
    const companyData = await db
      .select()
      .from(companies)
      .where(eq(companies.id, options.companyId))
      .limit(1);

    const companyRecord = companyData[0];
    if (!companyRecord || companyRecord.status !== "active") {
      return null;
    }

    // Create conversation
    const conversationResults = await db
      .insert(conversations)
      .values({
        companyId: options.companyId,
        chatbotId: options.agentId,
        endUserId: options.endUserId || crypto.randomUUID(),
        channel: options.channel,
        status: "active",
        metadata: options.metadata || {},
        pageUrl: options.pageUrl,
        referrer: options.referrer,
        lastMessageAt: new Date(),
      })
      .returning();

    const conversation = conversationResults[0];
    if (!conversation) {
      return null;
    }

    // Get greeting message
    const behavior = chatbot.behavior as { greeting?: string };
    const greeting = behavior?.greeting || "Hello! How can I help you today?";

    // Get first agent from agentsList for greeting attribution
    const firstAgent = chatbot.agentsList?.[0];

    // Save greeting as first message
    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "assistant",
      type: "text",
      content: greeting,
      agentDetails: {
        agentId: firstAgent?.agent_identifier || "main",
        agentType: "ai",
        agentName: firstAgent?.name || chatbot.name,
      },
    });

    return {
      conversationId: conversation.id,
      agentId: chatbot.id,
      companyId: options.companyId,
      greeting,
    };
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(options: SendMessageOptions): Promise<AgentResponse | null> {
    // Load conversation
    const conversationData = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, options.conversationId))
      .limit(1);

    const conversation = conversationData[0];
    if (!conversation) {
      return null;
    }

    // Check if conversation is active
    if (conversation.status !== "active") {
      return {
        content: "This conversation has ended. Please start a new conversation.",
        metadata: {},
      };
    }

    // Check if assigned to human
    if (conversation.assignedUserId) {
      return {
        content: "A support agent is handling your request. Please wait for their response.",
        metadata: {},
      };
    }

    // Load executor
    const executor = await this.loadExecutor(conversation.chatbotId);
    if (!executor) {
      return {
        content: "The agent is currently unavailable. Please try again later.",
        metadata: {},
      };
    }

    // Save user message
    await db.insert(messagesTable).values({
      conversationId: options.conversationId,
      role: "user",
      type: "text",
      content: options.message,
      attachments: options.attachments || [],
    });

    // Update conversation
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 1,
        userMessageCount: conversation.userMessageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, options.conversationId));

    // Load variable context
    const variableContext = await this.loadVariableContext(conversation.chatbotId);

    // Build context
    const context: AgentContext = {
      conversationId: options.conversationId,
      companyId: conversation.companyId,
      agentId: conversation.chatbotId,
      requestId: crypto.randomUUID(),
      message: options.message,
      attachments: options.attachments?.map((a) => ({
        id: crypto.randomUUID(),
        ...a,
      })),
      endUserId: conversation.endUserId,
      channel: conversation.channel as ChannelType,
      timestamp: new Date(),
      variables: variableContext.variables,
      securedVariables: variableContext.securedVariables,
    };

    // Process message using ADK executor
    const response = await executor.processMessage({
      message: options.message,
      sessionId: options.conversationId,
      context,
    });

    // Save assistant response
    await db.insert(messagesTable).values({
      conversationId: options.conversationId,
      role: "assistant",
      type: "text",
      content: response.content,
      tokenCount: response.metadata?.tokensUsed?.totalTokens,
      processingTimeMs: response.metadata?.processingTimeMs
        ? Math.round(response.metadata.processingTimeMs)
        : undefined,
      sourceChunkIds: response.metadata?.sources?.map((s) => s.id) || [],
      toolCalls: response.metadata?.toolsUsed || [],
      agentDetails: {
        agentId: ((response.metadata as Record<string, unknown>)?.agentId as string) || "main",
        agentType: "ai",
        agentName: ((response.metadata as Record<string, unknown>)?.agentName as string) || "AI Assistant",
      },
    });

    // Update conversation
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 2, // User + Assistant
        assistantMessageCount: conversation.assistantMessageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, options.conversationId));

    // Handle escalation if needed
    if (response.metadata?.shouldEscalate) {
      await this.handleEscalation(
        options.conversationId,
        response.metadata.escalationReason || "Escalation requested"
      );
    }

    return response;
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessageStream(
    options: SendMessageOptions
  ): AsyncGenerator<AgentStreamEvent> {
    // Detailed timing for sendMessageStream internals
    const timings: Record<string, number> = {};
    const startTotal = performance.now();
    let stepStart = performance.now();

    // Load conversation
    const conversationData = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, options.conversationId))
      .limit(1);
    timings.loadConversation = performance.now() - stepStart;
    stepStart = performance.now();

    const conversation = conversationData[0];
    if (!conversation) {
      yield {
        type: "error",
        data: {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found",
          retryable: false,
        },
        timestamp: Date.now(),
      };
      return;
    }

    // Check if conversation is being handled by a human agent
    if (conversation.status === "waiting_human" || conversation.status === "with_human") {
      yield {
        type: "human_handling",
        data: {
          status: conversation.status,
          message: conversation.status === "waiting_human"
            ? "Waiting for human agent..."
            : "A human agent is handling your request.",
        },
        timestamp: Date.now(),
      };
      return;
    }

    // Check if conversation is active
    if (conversation.status !== "active") {
      yield {
        type: "error",
        data: {
          code: "CONVERSATION_CLOSED",
          message: "This conversation has ended",
          retryable: false,
        },
        timestamp: Date.now(),
      };
      return;
    }

    // Load executor
    const executor = await this.loadExecutor(conversation.chatbotId);
    timings.loadExecutor = performance.now() - stepStart;
    stepStart = performance.now();

    if (!executor) {
      yield {
        type: "error",
        data: {
          code: "AGENT_NOT_FOUND",
          message: "Agent not available",
          retryable: true,
        },
        timestamp: Date.now(),
      };
      return;
    }

    // NOTE: User message is saved by the caller (widget route handles this with more context)
    // Do NOT save user message here to avoid duplicates

    // Load variable context
    const variableContext = await this.loadVariableContext(conversation.chatbotId);
    timings.loadVariableContext = performance.now() - stepStart;
    stepStart = performance.now();

    // Build context
    const context: AgentContext = {
      conversationId: options.conversationId,
      companyId: conversation.companyId,
      agentId: conversation.chatbotId,
      requestId: crypto.randomUUID(),
      message: options.message,
      endUserId: conversation.endUserId,
      channel: conversation.channel as ChannelType,
      timestamp: new Date(),
      variables: variableContext.variables,
      securedVariables: variableContext.securedVariables,
    };

    // Stream response using ADK executor
    // Content and metadata are tracked for potential debugging/logging use
    let _fullContent = "";
    let _metadata: AgentResponse["metadata"];
    let firstTokenTime: number | null = null;

    for await (const event of executor.processMessageStream({
      message: options.message,
      sessionId: options.conversationId,
      context,
    })) {
      // Track time to first token
      if (event.type === "delta" && !firstTokenTime) {
        firstTokenTime = performance.now() - stepStart;
      }

      yield event;

      if (event.type === "delta") {
        _fullContent += (event.data as { content: string }).content;
      } else if (event.type === "complete") {
        const completeData = event.data as { content: string; metadata: AgentResponse["metadata"] };
        _fullContent = completeData.content;
        _metadata = completeData.metadata;
      }
    }
    timings.llmStreaming = performance.now() - stepStart;
    timings.timeToFirstToken = firstTokenTime ?? timings.llmStreaming;
    timings.total = performance.now() - startTotal;

    // NOTE: Assistant message and conversation stats are saved by the caller
    // (widget route handles this with more context including sourceChunkIds)
    // Do NOT save assistant message here to avoid duplicates

    // Print detailed timing report if profiler enabled
    if (process.env.ENABLE_PROFILER === "true") {
      console.log("\n[AgentRunner] Detailed Timing Breakdown:");
      console.log("─".repeat(50));
      for (const [key, value] of Object.entries(timings)) {
        const pct = ((value / timings.total) * 100).toFixed(1);
        console.log(`  ${key.padEnd(25)} ${value.toFixed(2).padStart(10)}ms (${pct.padStart(5)}%)`);
      }
      console.log("─".repeat(50));
    }
  }

  /**
   * Handle conversation escalation
   */
  private async handleEscalation(
    conversationId: string,
    reason: string
  ): Promise<void> {
    // Update conversation status to waiting for human
    await db
      .update(conversations)
      .set({
        status: "waiting_human",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // TODO: Create escalation record
    // TODO: Notify available support agents
    // TODO: Emit escalation event

    console.log(`Conversation ${conversationId} escalated: ${reason}`);
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string): Promise<Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>> {
    const messagesList = await db
      .select({
        role: messagesTable.role,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    return messagesList;
  }

  /**
   * End a conversation
   */
  async endConversation(
    conversationId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resolution?: string
  ): Promise<void> {
    await db
      .update(conversations)
      .set({
        status: "resolved",
        resolutionType: "ai",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * Load variable values for a chatbot
   */
  private async loadVariableContext(chatbotId: string): Promise<VariableContext> {
    const varSpan = profiler.startSpan("db_load_variables", "db", { chatbotId });

    // Get chatbot with its package to read variable definitions and values
    const chatbotData = await db
      .select({
        variableValues: chatbots.variableValues,
        packageId: chatbots.packageId,
        packageVariables: chatbotPackages.variables,
      })
      .from(chatbots)
      .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
      .where(eq(chatbots.id, chatbotId))
      .limit(1);

    const chatbot = chatbotData[0];
    if (!chatbot) {
      varSpan.end({ found: false });
      return createVariableContext([]);
    }

    // Get package variable definitions and chatbot's values
    const packageVariablesDefs = (chatbot.packageVariables as PackageVariableDefinition[]) || [];
    const chatbotVariableValues = (chatbot.variableValues as Record<string, string>) || {};

    // Combine definitions with values
    const variableValues: VariableValue[] = packageVariablesDefs.map((pv) => ({
      name: pv.name,
      value: chatbotVariableValues[pv.name] || null,
      variableType: pv.variableType,
      dataType: pv.dataType,
    }));

    varSpan.end({ found: true, variableCount: variableValues.length });
    return createVariableContext(variableValues);
  }

  /**
   * Invalidate executor cache for a chatbot
   */
  invalidateAgent(chatbotId: string): void {
    this.executorCache.delete(chatbotId);
  }

  /**
   * Clear all executor cache
   */
  clearCache(): void {
    this.executorCache.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let runnerInstance: AgentRunnerService | null = null;

export function getAgentRunner(): AgentRunnerService {
  if (!runnerInstance) {
    runnerInstance = new AgentRunnerService();
  }
  return runnerInstance;
}

export function createAgentRunner(): AgentRunnerService {
  return new AgentRunnerService();
}
