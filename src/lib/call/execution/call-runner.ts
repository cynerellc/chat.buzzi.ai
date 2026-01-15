/**
 * Call Runner Service
 *
 * This service manages the lifecycle of voice call executors:
 * - Loading chatbot call configurations from database
 * - Caching call executor instances
 * - Managing call sessions
 * - Routing audio to appropriate executors
 * - Handling call lifecycle events
 *
 * Mirrors the AgentRunnerService architecture for consistency
 */

import { db } from "@/lib/db";
import { chatbots, type ChatbotSettings, type AgentListItem } from "@/lib/db/schema/chatbots";
import { calls } from "@/lib/db/schema/calls";
import { eq, and } from "drizzle-orm";

import { getCallSessionManager } from "./call-session-manager";
import { CallExecutor } from "./call-executor";
import { profiler } from "@/lib/profiler";
import { getAllBuiltInTools } from "@/lib/ai/tools/built-in";
import type { RegisteredTool } from "@/lib/ai/tools/types";
import { BUILT_IN_TOOLS } from "@/lib/ai/tools/types";

import type {
  CallSession,
  CreateCallSessionParams,
  CallAiProvider,
  VoiceConfig,
  ExecutorConfig,
} from "../types";
import type { BaseCallHandler } from "../handlers/base-call-handler";

// ============================================================================
// Tool Conversion for Voice Calls
// ============================================================================

/**
 * Convert RegisteredTool to OpenAI Realtime API tool format
 */
function convertToolForOpenAI(tool: RegisteredTool): {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
} {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

/**
 * Get tools configured for voice calls (built-in only)
 */
function getVoiceCallTools(): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}> {
  const builtInTools = getAllBuiltInTools();
  return builtInTools.map(convertToolForOpenAI);
}

/**
 * Aggregate tools from all agents in the chatbot
 */
function aggregateAgentTools(agentsList: AgentListItem[]): RegisteredTool[] {
  const toolsMap = new Map<string, RegisteredTool>();

  // Add built-in tools first
  for (const tool of getAllBuiltInTools()) {
    toolsMap.set(tool.name, tool);
  }

  // Add tools from each agent (deduplicating by name)
  for (const agent of agentsList) {
    if (agent.tools && Array.isArray(agent.tools)) {
      for (const tool of agent.tools) {
        const registeredTool = tool as RegisteredTool;
        if (registeredTool.name && !toolsMap.has(registeredTool.name)) {
          toolsMap.set(registeredTool.name, registeredTool);
        }
      }
    }
  }

  return Array.from(toolsMap.values());
}

/**
 * Get filtered tools based on knowledge settings
 * @param agentsList - List of agents to aggregate tools from
 * @param knowledgeEnabled - Whether knowledge base tool should be included (default: false)
 */
function getFilteredTools(
  agentsList: AgentListItem[],
  knowledgeEnabled: boolean = false
): RegisteredTool[] {
  const allTools = aggregateAgentTools(agentsList);

  // Filter out search_knowledge tool if knowledge base is not enabled
  return knowledgeEnabled
    ? allTools
    : allTools.filter((tool) => tool.name !== BUILT_IN_TOOLS.SEARCH_KNOWLEDGE);
}

/**
 * Get tools for voice calls including agent-specific tools
 * @param agentsList - List of agents to aggregate tools from
 * @param knowledgeEnabled - Whether knowledge base tool should be included (default: false)
 */
function getVoiceCallToolsWithAgents(
  agentsList: AgentListItem[],
  knowledgeEnabled: boolean = false
): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}> {
  const filteredTools = getFilteredTools(agentsList, knowledgeEnabled);
  return filteredTools.map(convertToolForOpenAI);
}

/**
 * Aggregate knowledge categories from all agents
 */
function aggregateKnowledgeCategories(agentsList: AgentListItem[]): string[] {
  const categories = new Set<string>();
  for (const agent of agentsList) {
    if (agent.knowledge_categories) {
      for (const cat of agent.knowledge_categories) {
        categories.add(cat);
      }
    }
  }
  return Array.from(categories);
}

// ============================================================================
// Executor Cache with Activity-Based Eviction
// ============================================================================

interface ExecutorCacheEntry {
  executor: CallExecutor;
  lastActivity: number; // Timestamp of last activity
  chatbotId: string; // For logging
}

interface ExecutorCacheConfig {
  inactivityTTL: number; // Time before evicting inactive executors (default: 3 hours)
  cleanupInterval: number; // How often to run cleanup (default: 15 minutes)
  maxExecutors: number; // Maximum number of cached executors (default: 100)
}

const DEFAULT_EXECUTOR_CACHE_CONFIG: ExecutorCacheConfig = {
  inactivityTTL: 3 * 60 * 60 * 1000, // 3 hours
  cleanupInterval: 15 * 60 * 1000, // 15 minutes
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
  get(chatbotId: string): CallExecutor | undefined {
    const entry = this.cache.get(chatbotId);
    if (entry) {
      const now = Date.now();
      // Check if expired
      if (now - entry.lastActivity > this.config.inactivityTTL) {
        console.log(
          `[CallExecutorCache] Executor ${chatbotId} expired after ${this.formatDuration(now - entry.lastActivity)} of inactivity`
        );
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
  set(chatbotId: string, executor: CallExecutor): void {
    // Check if we're at capacity
    if (this.cache.size >= this.config.maxExecutors && !this.cache.has(chatbotId)) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(chatbotId, {
      executor,
      lastActivity: Date.now(),
      chatbotId,
    });

    console.log(`[CallExecutorCache] Cached executor for ${chatbotId}, total: ${this.cache.size}`);
  }

  /**
   * Record activity for an executor (call when processing audio)
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
        // Disconnect executor before evicting
        void entry.executor.disconnect();
        this.cache.delete(chatbotId);
        evicted++;
        console.log(
          `[CallExecutorCache] Evicted ${chatbotId} after ${this.formatDuration(inactiveFor)} of inactivity`
        );
      }
    }

    if (evicted > 0) {
      console.log(`[CallExecutorCache] Cleanup: evicted ${evicted} executors, remaining: ${this.cache.size}`);
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
      const entry = this.cache.get(oldest.chatbotId);
      if (entry) {
        void entry.executor.disconnect();
      }
      this.cache.delete(oldest.chatbotId);
      console.log(
        `[CallExecutorCache] Evicted LRU executor ${oldest.chatbotId} (cache at capacity: ${this.config.maxExecutors})`
      );
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
// Call Runner Service
// ============================================================================

export class CallRunnerService {
  private executorCache: ExecutorCache;
  private sessionManager = getCallSessionManager();
  private activeHandlers: Map<string, BaseCallHandler> = new Map();
  // Track executors per session (not per chatbot) to avoid connection sharing issues
  private sessionExecutors: Map<string, CallExecutor> = new Map();

  constructor() {
    this.executorCache = new ExecutorCache();
  }

  /**
   * Load chatbot configuration for creating executors
   */
  private async loadChatbotConfig(chatbotId: string) {
    const chatbotData = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        name: chatbots.name,
        status: chatbots.status,
        enabledCall: chatbots.enabledCall,
        callAiProvider: chatbots.callAiProvider,
        voiceConfig: chatbots.voiceConfig,
        agentsList: chatbots.agentsList,
        settings: chatbots.settings,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.status, "active")))
      .limit(1);

    return chatbotData[0] || null;
  }

  /**
   * Create a fresh executor for a specific session
   * Each call session gets its own executor to avoid connection sharing issues
   */
  async createExecutorForSession(sessionId: string, chatbotId: string): Promise<CallExecutor | null> {
    const loadSpan = profiler.startSpan("call_runner_create_executor_for_session", "executor", { sessionId, chatbotId });

    // Check if session already has an executor
    const existing = this.sessionExecutors.get(sessionId);
    if (existing && existing.isExecutorConnected()) {
      console.log(`[CallRunner] Reusing existing executor for session ${sessionId}`);
      loadSpan.end({ reused: true });
      return existing;
    }

    // Load chatbot configuration
    const chatbot = await this.loadChatbotConfig(chatbotId);
    if (!chatbot) {
      console.error(`[CallRunner] Chatbot ${chatbotId} not found or not active`);
      loadSpan.end({ error: "not_found" });
      return null;
    }

    // Validate call is enabled
    if (!chatbot.enabledCall) {
      console.error(`[CallRunner] Call feature not enabled for chatbot ${chatbotId}`);
      loadSpan.end({ error: "call_not_enabled" });
      return null;
    }

    // Validate AI provider is configured
    if (!chatbot.callAiProvider) {
      console.error(`[CallRunner] No AI provider configured for chatbot ${chatbotId}`);
      loadSpan.end({ error: "no_ai_provider" });
      return null;
    }

    // Get agents list for tools and knowledge categories
    const agentsList = (chatbot.agentsList as AgentListItem[]) || [];

    if (agentsList.length === 0) {
      console.error(`[CallRunner] Chatbot ${chatbotId} has no agents configured`);
      loadSpan.end({ error: "no_agents" });
      return null;
    }

    // Find the primary agent (first supervisor or first agent)
    const primaryAgent = agentsList.find((a) => a.agent_type === "supervisor") || agentsList[0];
    if (!primaryAgent) {
      console.error(`[CallRunner] Chatbot ${chatbotId} has no primary agent`);
      loadSpan.end({ error: "no_primary_agent" });
      return null;
    }

    // Build executor configuration
    const voiceConfig = chatbot.voiceConfig as VoiceConfig;
    const chatbotSettings = chatbot.settings as ChatbotSettings;

    // Get call system prompt: priority is settings.callSystemPrompt > voiceConfig.system_prompt_call > primary agent prompt
    const systemPrompt =
      chatbotSettings?.callSystemPrompt ||
      voiceConfig?.system_prompt_call ||
      primaryAgent.default_system_prompt;

    // Determine knowledge base settings:
    // 1. If call knowledge base is enabled at chatbot level, use chatbot settings categories
    // 2. Otherwise, fall back to aggregated agent categories (but KB tool won't be included)
    const callKnowledgeEnabled = chatbotSettings?.callKnowledgeBaseEnabled ?? false;
    const knowledgeCategories = callKnowledgeEnabled && chatbotSettings?.callKnowledgeCategories?.length
      ? chatbotSettings.callKnowledgeCategories
      : aggregateKnowledgeCategories(agentsList);
    const knowledgeThreshold = chatbotSettings?.callKnowledgeBaseThreshold ?? 0.3;

    // Get filtered tools (with execute functions) for executor use
    const registeredTools = getFilteredTools(agentsList, callKnowledgeEnabled);

    const executorConfig: ExecutorConfig = {
      chatbotId: chatbot.id,
      companyId: chatbot.companyId,
      aiProvider: chatbot.callAiProvider as CallAiProvider,
      voiceConfig: voiceConfig || {},
      systemPrompt,
      knowledgeCategories,
      knowledgeEnabled: callKnowledgeEnabled,
      knowledgeThreshold,
      tools: registeredTools.map(convertToolForOpenAI),
      registeredTools: registeredTools as unknown as ExecutorConfig["registeredTools"],
    };

    // Create executor based on AI provider
    let executor: CallExecutor | null = null;

    try {
      if (executorConfig.aiProvider === "OPENAI") {
        const { OpenAIRealtimeExecutor } = await import("./providers/openai-realtime");
        executor = new OpenAIRealtimeExecutor(executorConfig);
      } else if (executorConfig.aiProvider === "GEMINI") {
        const { GeminiLiveExecutor } = await import("./providers/gemini-live");
        executor = new GeminiLiveExecutor(executorConfig);
      } else {
        console.error(`[CallRunner] Unknown AI provider: ${executorConfig.aiProvider}`);
        loadSpan.end({ error: "unknown_provider" });
        return null;
      }
    } catch (error) {
      console.error(`[CallRunner] Failed to create executor:`, error);
      loadSpan.end({ error: "creation_failed" });
      return null;
    }

    // Connect the executor
    try {
      await executor.connect();
    } catch (error) {
      console.error(`[CallRunner] Failed to connect executor:`, error);
      loadSpan.end({ error: "connection_failed" });
      return null;
    }

    // Store executor for this session
    this.sessionExecutors.set(sessionId, executor);

    console.log(`[CallRunner] Created new executor for session ${sessionId} (chatbot: ${chatbotId}, provider: ${executorConfig.aiProvider}, tools: ${registeredTools.length})`);
    loadSpan.end({ created: true });
    return executor;
  }

  /**
   * Load a call executor by chatbot ID (for compatibility - prefer createExecutorForSession)
   * @deprecated Use createExecutorForSession for new calls
   */
  async loadExecutor(chatbotId: string): Promise<CallExecutor | null> {
    const loadSpan = profiler.startSpan("call_runner_load_executor", "executor", { chatbotId });

    // Check cache first - but verify connection is still valid
    const cached = this.executorCache.get(chatbotId);
    if (cached && cached.isExecutorConnected()) {
      console.log(`[CallRunner] Using cached executor for chatbot ${chatbotId} (connected: true)`);
      loadSpan.end({ fromCache: true });
      return cached;
    } else if (cached) {
      // Cached executor is disconnected, remove it
      console.log(`[CallRunner] Cached executor for chatbot ${chatbotId} is disconnected, creating new one`);
      this.executorCache.delete(chatbotId);
    }

    // Load chatbot configuration
    const chatbot = await this.loadChatbotConfig(chatbotId);
    if (!chatbot) {
      console.error(`[CallRunner] Chatbot ${chatbotId} not found or not active`);
      loadSpan.end({ error: "not_found" });
      return null;
    }

    // Validate call is enabled
    if (!chatbot.enabledCall) {
      console.error(`[CallRunner] Call feature not enabled for chatbot ${chatbotId}`);
      loadSpan.end({ error: "call_not_enabled" });
      return null;
    }

    // Validate AI provider is configured
    if (!chatbot.callAiProvider) {
      console.error(`[CallRunner] No AI provider configured for chatbot ${chatbotId}`);
      loadSpan.end({ error: "no_ai_provider" });
      return null;
    }

    // Get agents list for tools and knowledge categories
    const agentsList = (chatbot.agentsList as AgentListItem[]) || [];

    if (agentsList.length === 0) {
      console.error(`[CallRunner] Chatbot ${chatbotId} has no agents configured`);
      loadSpan.end({ error: "no_agents" });
      return null;
    }

    // Find the primary agent (first supervisor or first agent)
    const primaryAgent = agentsList.find((a) => a.agent_type === "supervisor") || agentsList[0];
    if (!primaryAgent) {
      console.error(`[CallRunner] Chatbot ${chatbotId} has no primary agent`);
      loadSpan.end({ error: "no_primary_agent" });
      return null;
    }

    // Build executor configuration
    const voiceConfig = chatbot.voiceConfig as VoiceConfig;
    const chatbotSettings = chatbot.settings as ChatbotSettings;

    // Get call system prompt: priority is settings.callSystemPrompt > voiceConfig.system_prompt_call > primary agent prompt
    const systemPrompt =
      chatbotSettings?.callSystemPrompt ||
      voiceConfig?.system_prompt_call ||
      primaryAgent.default_system_prompt;

    // Determine knowledge base settings:
    // 1. If call knowledge base is enabled at chatbot level, use chatbot settings categories
    // 2. Otherwise, fall back to aggregated agent categories (but KB tool won't be included)
    const callKnowledgeEnabled = chatbotSettings?.callKnowledgeBaseEnabled ?? false;
    const knowledgeCategories = callKnowledgeEnabled && chatbotSettings?.callKnowledgeCategories?.length
      ? chatbotSettings.callKnowledgeCategories
      : aggregateKnowledgeCategories(agentsList);
    const knowledgeThreshold = chatbotSettings?.callKnowledgeBaseThreshold ?? 0.3;

    // Get filtered tools (with execute functions) for executor use
    const registeredTools = getFilteredTools(agentsList, callKnowledgeEnabled);

    const executorConfig: ExecutorConfig = {
      chatbotId: chatbot.id,
      companyId: chatbot.companyId,
      aiProvider: chatbot.callAiProvider as CallAiProvider,
      voiceConfig: voiceConfig || {},
      systemPrompt,
      knowledgeCategories,
      knowledgeEnabled: callKnowledgeEnabled,
      knowledgeThreshold,
      tools: registeredTools.map(convertToolForOpenAI),
      registeredTools: registeredTools as unknown as ExecutorConfig["registeredTools"],
    };

    // Create executor based on AI provider
    let executor: CallExecutor | null = null;

    try {
      if (executorConfig.aiProvider === "OPENAI") {
        const { OpenAIRealtimeExecutor } = await import("./providers/openai-realtime");
        executor = new OpenAIRealtimeExecutor(executorConfig);
      } else if (executorConfig.aiProvider === "GEMINI") {
        const { GeminiLiveExecutor } = await import("./providers/gemini-live");
        executor = new GeminiLiveExecutor(executorConfig);
      } else {
        console.error(`[CallRunner] Unknown AI provider: ${executorConfig.aiProvider}`);
        loadSpan.end({ error: "unknown_provider" });
        return null;
      }
    } catch (error) {
      console.error(`[CallRunner] Failed to create executor:`, error);
      loadSpan.end({ error: "creation_failed" });
      return null;
    }

    // Connect the executor
    try {
      await executor.connect();
    } catch (error) {
      console.error(`[CallRunner] Failed to connect executor:`, error);
      loadSpan.end({ error: "connection_failed" });
      return null;
    }

    // Cache the executor
    this.executorCache.set(chatbotId, executor);

    console.log(`[CallRunner] Loaded executor for chatbot ${chatbotId} (provider: ${executorConfig.aiProvider}, tools: ${registeredTools.length})`);
    loadSpan.end({ fromCache: false });
    return executor;
  }

  /**
   * Create a new call session
   */
  async createSession(params: CreateCallSessionParams): Promise<CallSession | null> {
    const createSpan = profiler.startSpan("call_runner_create_session", "executor");

    // Verify chatbot exists and has call enabled
    const chatbotData = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        enabledCall: chatbots.enabledCall,
        callAiProvider: chatbots.callAiProvider,
        status: chatbots.status,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, params.chatbotId),
          eq(chatbots.companyId, params.companyId),
          eq(chatbots.status, "active")
        )
      )
      .limit(1);

    const chatbot = chatbotData[0];
    if (!chatbot) {
      createSpan.end({ error: "chatbot_not_found" });
      return null;
    }

    if (!chatbot.enabledCall) {
      createSpan.end({ error: "call_not_enabled" });
      return null;
    }

    if (!chatbot.callAiProvider) {
      createSpan.end({ error: "no_ai_provider" });
      return null;
    }

    // Generate unique IDs
    const sessionId = crypto.randomUUID();
    const callId = crypto.randomUUID();

    // Create database call record (store sessionId in metadata for cross-module lookup)
    const callResults = await db
      .insert(calls)
      .values({
        id: callId,
        chatbotId: params.chatbotId,
        companyId: params.companyId,
        endUserId: params.endUserId,
        source: params.source,
        aiProvider: chatbot.callAiProvider as CallAiProvider,
        status: "pending",
        integrationAccountId: params.integrationAccountId,
        externalRefs: {
          fromNumber: params.fromNumber,
          toNumber: params.toNumber,
          sessionId, // Store sessionId for WebSocket lookup
        },
        callerInfo: {
          name: params.callerName,
          email: params.callerEmail,
        },
        metadata: params.metadata || {},
        startedAt: new Date(),
      })
      .returning();

    const call = callResults[0];
    if (!call) {
      createSpan.end({ error: "db_insert_failed" });
      return null;
    }

    // Create in-memory session
    const session = await this.sessionManager.createSession({
      sessionId,
      callId: call.id,
      chatbotId: params.chatbotId,
      companyId: params.companyId,
      endUserId: params.endUserId,
      source: params.source,
    });

    console.log(`[CallRunner] Created session ${sessionId} for call ${callId}`);
    createSpan.end({ sessionId, callId });
    return session;
  }

  /**
   * Start a call with a handler
   */
  async startCall(sessionId: string, handler: BaseCallHandler): Promise<void> {
    const startSpan = profiler.startSpan("call_runner_start_call", "executor", { sessionId });

    // Get session
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`[CallRunner] Session ${sessionId} not found`);
      startSpan.end({ error: "session_not_found" });
      throw new Error("Session not found");
    }

    // Create a fresh executor for this session (each call gets its own connection)
    const executor = await this.createExecutorForSession(sessionId, session.chatbotId);
    if (!executor) {
      console.error(`[CallRunner] Failed to create executor for session ${sessionId}`);
      startSpan.end({ error: "executor_create_failed" });
      throw new Error("Failed to create executor");
    }

    // Store handler
    this.activeHandlers.set(sessionId, handler);

    // Create bound event handlers so we can remove them later
    const audioDeltaHandler = (audioData: Buffer) => {
      void handler.sendAudio(audioData);
    };

    const errorHandler = (error: Error) => {
      console.error(`[CallRunner] Executor error for session ${sessionId}:`, error);
      handler.emit("error", error);
    };

    const connectionClosedHandler = () => {
      console.log(`[CallRunner] Executor connection closed for session ${sessionId}`);
      void this.endCall(sessionId, "Executor disconnected");
    };

    const escalateHandler = (data: { reason: string; urgency: string; summary?: string; conversationId?: string }) => {
      console.log(`[CallRunner] Escalation requested for session ${sessionId}:`, data);

      // Notify the client about the escalation via handler
      // Check if handler supports handleEscalation (WebSocketCallHandler does)
      if ("handleEscalation" in handler && typeof handler.handleEscalation === "function") {
        handler.handleEscalation({
          reason: data.reason,
          urgency: data.urgency,
          summary: data.summary,
        });
      }

      // End the AI call after a short delay to allow the transfer message to be spoken
      // The delay allows OpenAI to finish speaking the "transferring you..." message
      setTimeout(() => {
        void this.endCall(sessionId, "Escalated to human agent");
      }, 3000);
    };

    // Wire up executor events to handler
    executor.on("audioDelta", audioDeltaHandler);
    executor.on("error", errorHandler);
    executor.on("connectionClosed", connectionClosedHandler);
    executor.on("escalate", escalateHandler);

    // Wire up handler events to executor
    const audioReceivedHandler = (audioData: Buffer) => {
      void this.sendAudioToSession(sessionId, audioData);
    };

    const callEndedHandler = (reason?: string) => {
      void this.endCall(sessionId, reason);
    };

    handler.on("audioReceived", audioReceivedHandler);
    handler.on("callEnded", callEndedHandler);

    // Update session status
    await this.sessionManager.updateSessionStatus(sessionId, "in_progress");

    // Update database call status
    await db
      .update(calls)
      .set({
        status: "in_progress",
        answeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(calls.id, session.callId));

    console.log(`[CallRunner] Started call for session ${sessionId} with fresh executor`);
    startSpan.end({ success: true });
  }

  /**
   * Send audio to executor using session-based lookup (preferred)
   */
  async sendAudioToSession(sessionId: string, audioBuffer: Buffer): Promise<void> {
    // Get executor for this session
    const executor = this.sessionExecutors.get(sessionId);
    if (!executor) {
      console.error(`[CallRunner] No executor found for session ${sessionId}`);
      return;
    }

    if (!executor.isExecutorConnected()) {
      console.error(`[CallRunner] Executor not connected for session ${sessionId}`);
      return;
    }

    // Update session activity
    await this.sessionManager.updateLastActivity(sessionId);

    // Send audio to executor
    try {
      await executor.sendAudio(audioBuffer);
    } catch (error) {
      console.error(`[CallRunner] Error sending audio for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Send audio to executor (legacy - uses chatbot cache)
   * @deprecated Use sendAudioToSession instead
   */
  async sendAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    // First try session-based lookup
    const sessionExecutor = this.sessionExecutors.get(sessionId);
    if (sessionExecutor && sessionExecutor.isExecutorConnected()) {
      await this.sendAudioToSession(sessionId, audioBuffer);
      return;
    }

    // Fallback to chatbot-based cache (legacy)
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`[CallRunner] Session ${sessionId} not found for audio`);
      return;
    }

    // Update session activity
    await this.sessionManager.updateLastActivity(sessionId);

    // Touch executor cache
    this.executorCache.touch(session.chatbotId);

    // Get executor from cache
    const executor = this.executorCache.get(session.chatbotId);
    if (!executor) {
      console.error(`[CallRunner] No executor in cache for session ${sessionId}`);
      return;
    }

    if (!executor.isExecutorConnected()) {
      console.error(`[CallRunner] Cached executor not connected for session ${sessionId}`);
      return;
    }

    // Send audio to executor
    try {
      await executor.sendAudio(audioBuffer);
    } catch (error) {
      console.error(`[CallRunner] Error sending audio for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * End a call
   */
  async endCall(sessionId: string, reason?: string): Promise<void> {
    const endSpan = profiler.startSpan("call_runner_end_call", "executor", { sessionId });

    // Get session
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`[CallRunner] Session ${sessionId} not found for end`);
      endSpan.end({ error: "session_not_found" });
      return;
    }

    // Clean up session executor first
    const executor = this.sessionExecutors.get(sessionId);
    if (executor) {
      try {
        // Remove all listeners to prevent memory leaks
        executor.removeAllListeners();
        // Disconnect from AI provider
        await executor.disconnect();
        console.log(`[CallRunner] Disconnected executor for session ${sessionId}`);
      } catch (error) {
        console.error(`[CallRunner] Error disconnecting executor for session ${sessionId}:`, error);
      }
      this.sessionExecutors.delete(sessionId);
    }

    // Get handler and clean up
    const handler = this.activeHandlers.get(sessionId);
    if (handler) {
      try {
        // Remove handler listeners to prevent memory leaks
        handler.removeAllListeners();
        await handler.end(reason);
      } catch (error) {
        console.error(`[CallRunner] Error ending handler for session ${sessionId}:`, error);
      }
      this.activeHandlers.delete(sessionId);
    }

    // Update session status
    await this.sessionManager.updateSessionStatus(sessionId, "completed");

    // Update database call record
    const endedAt = new Date();
    const startedAt = session.startedAt;
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    await db
      .update(calls)
      .set({
        status: "completed",
        endedAt,
        durationSeconds,
        endReason: reason || "normal",
        updatedAt: new Date(),
      })
      .where(eq(calls.id, session.callId));

    // End session
    await this.sessionManager.endSession(sessionId);

    console.log(`[CallRunner] Ended call for session ${sessionId} (reason: ${reason || "normal"})`);
    endSpan.end({ success: true, durationSeconds });
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessionManager.getActiveSessionsCount();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.executorCache.getStats();
  }

  /**
   * Invalidate executor cache for a chatbot
   */
  async invalidateExecutor(chatbotId: string): Promise<void> {
    const executor = this.executorCache.get(chatbotId);
    if (executor) {
      try {
        await executor.disconnect();
      } catch (error) {
        console.error(`[CallRunner] Error disconnecting executor for ${chatbotId}:`, error);
      }
    }
    this.executorCache.delete(chatbotId);
  }

  /**
   * Clear all executor cache
   */
  clearCache(): void {
    // Disconnect all executors
    for (const entry of this.executorCache.getStats().entries) {
      void this.invalidateExecutor(entry.chatbotId);
    }
    this.executorCache.clear();
  }

  /**
   * Shutdown the call runner service
   */
  async shutdown(): Promise<void> {
    // End all active calls
    const activeSessions = this.sessionManager.getActiveSessionIds();
    for (const sessionId of activeSessions) {
      await this.endCall(sessionId, "shutdown");
    }

    // Clear cache and disconnect executors
    this.clearCache();

    // Stop cache cleanup timer
    this.executorCache.stopCleanupTimer();

    // Shutdown session manager
    await this.sessionManager.shutdown();

    console.log("[CallRunner] Shutdown complete");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let runnerInstance: CallRunnerService | null = null;

export function getCallRunner(): CallRunnerService {
  if (!runnerInstance) {
    runnerInstance = new CallRunnerService();
  }
  return runnerInstance;
}

export function createCallRunner(): CallRunnerService {
  return new CallRunnerService();
}
