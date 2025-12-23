/**
 * AI Agent Framework - Core Type Definitions
 *
 * This module defines all the types used throughout the AI agent system,
 * including agent configuration, context, responses, and tool definitions.
 */

import type { Agent } from "@/lib/db/schema/agents";

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
  content: string;
  name?: string; // For tool messages
  toolCallId?: string; // For tool result messages
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
  categoryIds?: string[];
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

  // Knowledge sources
  knowledgeSourceIds: string[];
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
  | "error";

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

export type AgentStreamEvent =
  | ThinkingEvent
  | ToolCallEvent
  | DeltaEvent
  | CompleteEvent
  | ErrorEvent;

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
 */
export function agentToConfig(agent: Agent, companyApiKeys?: { openai?: string; anthropic?: string }): AgentConfig {
  const behavior = agent.behavior as BehaviorConfig;
  const escalationTriggers = agent.escalationTriggers as EscalationTrigger[];
  const knowledgeSourceIds = agent.knowledgeSourceIds as string[];

  // Determine provider from model ID
  const provider: LLMProvider = agent.modelId.startsWith("claude") ? "anthropic" : "openai";

  return {
    agentId: agent.id,
    companyId: agent.companyId,
    agentName: agent.name,
    systemPrompt: agent.systemPrompt,
    llmConfig: {
      provider,
      model: agent.modelId,
      temperature: agent.temperature / 100, // Convert from 0-100 to 0-1
      maxTokens: 4096,
      apiKey: provider === "openai" ? companyApiKeys?.openai : companyApiKeys?.anthropic,
    },
    ragConfig: {
      enabled: knowledgeSourceIds.length > 0,
      maxResults: 5,
      relevanceThreshold: 0.7,
      categoryIds: knowledgeSourceIds,
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
    knowledgeSourceIds,
  };
}
