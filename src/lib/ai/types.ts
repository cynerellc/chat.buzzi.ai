/**
 * AI Agent Framework - Core Type Definitions
 *
 * This module defines all the types used throughout the AI agent system,
 * including agent configuration, context, responses, and tool definitions.
 */

import type { Agent } from "@/lib/db/schema/chatbots";

// ============================================================================
// LLM Configuration Types
// ============================================================================

export type LLMProvider = "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number; // 0-1 (normalized from database 0-100)
  maxTokens: number;
  apiKey?: string; // Optional - uses env vars if not provided
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string; // For tool messages
  toolCallId?: string; // For tool result messages
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>; // For assistant messages with tool calls
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  usage: LLMUsage;
  latencyMs: number;
  finishReason: "stop" | "tool_calls" | "length" | "content_filter";
}

// ============================================================================
// Tool System Types
// ============================================================================

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  /**
   * Message to display when tool starts executing
   * @example "Checking your orders..."
   */
  toolExecutingMessage?: string;
  /**
   * Message to display when tool completes
   * @example "Order details retrieved"
   */
  toolCompletedMessage?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Tool extends ToolDefinition {
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>;
}

// ============================================================================
// Agent Context Types
// ============================================================================

export interface Attachment {
  id: string;
  type: "image" | "file" | "audio";
  url: string;
  mimeType: string;
  fileName?: string;
  size?: number;
}

export interface CustomerMetadata {
  email?: string;
  name?: string;
  phone?: string;
  externalId?: string;
  tags?: string[];
  customAttributes?: Record<string, unknown>;
}

export type ChannelType = "web" | "whatsapp" | "telegram" | "messenger" | "instagram" | "slack" | "teams" | "custom";

// ============================================================================
// Package Variable Context Types
// ============================================================================

/**
 * Interface for accessing package variables at runtime
 * Used to get configuration values defined per-agent
 */
export interface VariableAccessor {
  /**
   * Get a variable value by name
   * @param name - The variable name (e.g., "EMAIL_HOST", "API_KEY")
   * @returns The variable value or undefined if not found
   */
  get(name: string): string | undefined;

  /**
   * Check if a variable exists
   * @param name - The variable name
   * @returns true if the variable exists
   */
  has(name: string): boolean;

  /**
   * Get all variable names
   * @returns Array of variable names
   */
  keys(): string[];
}

/**
 * Variable context that provides access to package variables
 * Available to tools via context.variables and context.securedVariables
 */
export interface VariableContext {
  /**
   * Access regular (non-sensitive) variables
   * Example: context.variables.get("EMAIL_HOST")
   */
  variables: VariableAccessor;

  /**
   * Access secured (sensitive) variables
   * Example: context.securedVariables.get("API_KEY")
   */
  securedVariables: VariableAccessor;
}

/**
 * Raw variable data loaded from database
 */
export interface VariableValue {
  name: string;
  value: string | null;
  variableType: "variable" | "secured_variable";
  dataType: "string" | "number" | "boolean" | "json";
}

/**
 * Create a VariableContext from an array of variable values
 */
export function createVariableContext(variableValues: VariableValue[]): VariableContext {
  const regularVars = new Map<string, string>();
  const securedVars = new Map<string, string>();

  for (const v of variableValues) {
    if (v.value !== null) {
      if (v.variableType === "variable") {
        regularVars.set(v.name, v.value);
      } else {
        securedVars.set(v.name, v.value);
      }
    }
  }

  const createAccessor = (map: Map<string, string>): VariableAccessor => ({
    get: (name: string) => map.get(name),
    has: (name: string) => map.has(name),
    keys: () => Array.from(map.keys()),
  });

  return {
    variables: createAccessor(regularVars),
    securedVariables: createAccessor(securedVars),
  };
}

export interface AgentContext {
  // Identifiers
  conversationId: string;
  companyId: string;
  agentId: string;
  requestId: string;

  // Message
  message: string;
  attachments?: Attachment[];

  // Customer info
  endUserId?: string;
  customerName?: string;
  customerMetadata?: CustomerMetadata;

  // Channel info
  channel: ChannelType;
  channelMetadata?: Record<string, unknown>;

  // Session info
  sessionId?: string;
  pageUrl?: string;
  referrer?: string;

  // Injected context (for custom logic)
  systemPromptAddition?: string;

  // Package variables context (for accessing package configuration)
  variables: VariableAccessor;
  securedVariables: VariableAccessor;

  // Request metadata
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Agent Response Types
// ============================================================================

export interface RAGSource {
  id: string;
  fileName: string;
  category?: string;
  chunkIndex?: number;
  relevanceScore: number;
}

export interface AgentResponseMetadata {
  confidence?: number;
  sources?: RAGSource[];
  toolsUsed?: string[];
  tokensUsed?: LLMUsage;
  processingTimeMs?: number;
  shouldEscalate?: boolean;
  escalationReason?: string;
  modelId?: string;
}

export interface AgentResponse {
  content: string;
  metadata?: AgentResponseMetadata;
}

// ============================================================================
// Agent Configuration Types
// ============================================================================

export interface RAGConfig {
  enabled: boolean;
  maxResults: number;
  relevanceThreshold: number;
  categories?: string[]; // Category names for RAG filtering
}

export interface HistoryConfig {
  maxMessages: number;
  ttlSeconds: number;
  enableSummarization: boolean;
}

export interface BehaviorConfig {
  greeting: string;
  fallbackMessage: string;
  maxTurnsBeforeEscalation: number;
  autoEscalateOnSentiment: boolean;
  sentimentThreshold: number;
  collectEmail: boolean;
  collectName: boolean;
  workingHours?: {
    timezone: string;
    schedule: Record<string, { start: string; end: string } | null>;
  };
  offlineMessage?: string;
}

export interface AgentConfig {
  // Identity
  agentId: string;
  agentIdentifier: string; // Agent identifier within the package
  companyId: string;
  agentName: string;

  // Prompts
  systemPrompt: string;
  personality?: string;

  // LLM Configuration
  llmConfig: LLMConfig;

  // RAG Configuration
  ragConfig: RAGConfig;

  // Tool Configuration
  enabledTools: string[];
  customTools?: Tool[];

  // History Configuration
  historyConfig: HistoryConfig;

  // Behavior
  behavior: BehaviorConfig;

  // Escalation
  escalationEnabled: boolean;
  escalationTriggers: EscalationTrigger[];
}

// ============================================================================
// Escalation Types
// ============================================================================

export type EscalationTriggerType =
  | "keyword"
  | "sentiment"
  | "turns"
  | "confidence"
  | "manual"
  | "tool_request";

export interface EscalationTrigger {
  type: EscalationTriggerType;
  config: Record<string, unknown>;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface EscalationRequest {
  conversationId: string;
  reason: string;
  triggerType: EscalationTriggerType;
  priority: "low" | "medium" | "high" | "urgent";
  context?: Record<string, unknown>;
}

// ============================================================================
// Streaming Types
// ============================================================================

export type StreamEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "delta"
  | "complete"
  | "error"
  | "notification";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

export interface ThinkingEvent extends StreamEvent {
  type: "thinking";
  data: {
    step: string;
    progress: number; // 0-1
  };
}

export interface ToolCallEvent extends StreamEvent {
  type: "tool_call";
  data: {
    toolName: string;
    status: "executing" | "completed" | "failed";
    arguments?: Record<string, unknown>;
    result?: ToolResult;
    /** User-friendly notification message for this tool status */
    notification?: string;
  };
}

export interface DeltaEvent extends StreamEvent {
  type: "delta";
  data: {
    content: string;
  };
}

export interface CompleteEvent extends StreamEvent {
  type: "complete";
  data: {
    content: string;
    metadata: AgentResponseMetadata;
  };
}

export interface ErrorEvent extends StreamEvent {
  type: "error";
  data: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface NotificationEvent extends StreamEvent {
  type: "notification";
  data: {
    message: string;
    targetAgentId?: string;
    targetAgentName?: string;
    targetAgentDesignation?: string;
    targetAgentAvatarUrl?: string;
    previousAgentId?: string | null;
    previousAgentName?: string;
    previousAgentAvatarUrl?: string;
    level?: "info" | "warning" | "success";
  };
}

export type AgentStreamEvent =
  | ThinkingEvent
  | ToolCallEvent
  | DeltaEvent
  | CompleteEvent
  | ErrorEvent
  | NotificationEvent;

// ============================================================================
// Error Types
// ============================================================================

export class AgentError extends Error {
  code: string;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    retryable = false,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export class LLMError extends AgentError {
  constructor(message: string, retryable = true, details?: Record<string, unknown>) {
    super(message, "LLM_ERROR", retryable, details);
    this.name = "LLMError";
  }
}

export class ToolError extends AgentError {
  toolName: string;

  constructor(message: string, toolName: string, retryable = false, details?: Record<string, unknown>) {
    super(message, "TOOL_ERROR", retryable, details);
    this.name = "ToolError";
    this.toolName = toolName;
  }
}

export class RateLimitError extends AgentError {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message, "RATE_LIMIT", true, { retryAfterMs });
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ContextLimitError extends AgentError {
  tokensUsed: number;
  maxTokens: number;

  constructor(tokensUsed: number, maxTokens: number) {
    super(
      `Context limit exceeded: ${tokensUsed} tokens used, max ${maxTokens}`,
      "CONTEXT_LIMIT",
      true,
      { tokensUsed, maxTokens }
    );
    this.name = "ContextLimitError";
    this.tokensUsed = tokensUsed;
    this.maxTokens = maxTokens;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert database agent to AgentConfig
 * Uses the first agent in agents_list for configuration, or falls back to defaults
 */
export function agentToConfig(
  agent: Agent,
  companyApiKeys?: { openai?: string; anthropic?: string },
  agentIdentifier?: string
): AgentConfig {
  const behavior = agent.behavior as BehaviorConfig;
  const escalationTriggers = agent.escalationTriggers as EscalationTrigger[];
  const agentsList = agent.agentsList || [];

  // Find the specified agent or use the first one
  const agentConfig = agentIdentifier
    ? agentsList.find((a) => a.agent_identifier === agentIdentifier)
    : agentsList[0];

  // Default values if no agent in list
  const systemPrompt = agentConfig?.default_system_prompt || "";
  const modelId = agentConfig?.default_model_id || "gpt-5-mini-2025-08-07";
  const modelSettings = agentConfig?.model_settings ?? { temperature: 0.7 };
  const temperatureValue = typeof modelSettings.temperature === "number" ? modelSettings.temperature : 0.7;
  const knowledgeBaseEnabled = agentConfig?.knowledge_base_enabled ?? false;
  const knowledgeCategories = agentConfig?.knowledge_categories || [];
  const identifier = agentConfig?.agent_identifier || "main";

  // Determine provider from model ID
  const provider: LLMProvider = modelId.startsWith("claude") ? "anthropic" : "openai";

  return {
    agentId: agent.id,
    agentIdentifier: identifier,
    companyId: agent.companyId,
    agentName: agentConfig?.name || agent.name,
    systemPrompt,
    llmConfig: {
      provider,
      model: modelId,
      temperature: temperatureValue, // Already in 0-1 format
      maxTokens: 4096,
      apiKey: provider === "openai" ? companyApiKeys?.openai : companyApiKeys?.anthropic,
    },
    ragConfig: {
      enabled: knowledgeBaseEnabled,
      maxResults: 5,
      relevanceThreshold: 0.7,
      categories: knowledgeCategories.length > 0 ? knowledgeCategories : undefined,
    },
    enabledTools: ["search_knowledge", "request_human_handover"],
    historyConfig: {
      maxMessages: 50,
      ttlSeconds: 86400, // 24 hours
      enableSummarization: true,
    },
    behavior,
    escalationEnabled: agent.escalationEnabled,
    escalationTriggers,
  };
}
