/**
 * Realtime Communication - Type Definitions
 *
 * Core types for the realtime communication system including:
 * - SSE event types
 * - Presence types
 * - Channel types
 * - Session management types
 */

// ============================================================================
// SSE Event Types
// ============================================================================

export type SSEEventType =
  | "thinking"
  | "tool_call"
  | "delta"
  | "complete"
  | "error"
  | "notification"
  | "presence"
  | "typing"
  | "connected"
  | "heartbeat"
  | "human_escalation"
  | "human_joined"
  | "human_exited"
  | "human_handling"
  | "escalation_cancelled";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

export interface ThinkingEvent {
  step: string;
  progress: number; // 0-1
}

export interface ToolCallEvent {
  tool: string;
  status: "executing" | "completed" | "failed";
  result?: unknown;
}

export interface DeltaEvent {
  content: string;
}

export interface CompleteEvent {
  content: string;
  metadata: {
    messageId: string;
    tokens: { input: number; output: number };
    sources?: string[];
    confidence?: number;
  };
}

export interface ErrorEvent {
  code: string;
  message: string;
  retryable: boolean;
}

export interface NotificationEvent {
  type: "handover" | "message" | "escalation" | "read";
  data: unknown;
}

export interface PresenceEvent {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeen?: Date;
}

export interface TypingEvent {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

// ============================================================================
// Presence Types
// ============================================================================

export type PresenceStatus = "online" | "away" | "offline" | "busy";

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastActiveAt: Date;
  currentConversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentPresence {
  agentId: string;
  status: "active" | "paused" | "offline";
  activeConversations: number;
  maxConversations: number;
}

// ============================================================================
// Channel Types
// ============================================================================

export type ChannelType =
  | "web"
  | "whatsapp"
  | "telegram"
  | "messenger"
  | "instagram"
  | "slack"
  | "teams"
  | "custom";

export interface UnifiedMessage {
  // Identifiers
  externalId: string; // Channel-specific message ID
  senderId: string; // Channel-specific sender ID
  senderName?: string;

  // Content
  content: string;
  contentType: "text" | "image" | "audio" | "video" | "document" | "location";

  // Attachments
  attachments?: MessageAttachment[];

  // Metadata
  timestamp: Date;
  replyToId?: string;
  channelMetadata?: Record<string, unknown>;
}

export interface MessageAttachment {
  type: "image" | "audio" | "video" | "document";
  url?: string;
  mediaId?: string; // Channel-specific media ID
  mimeType: string;
  filename?: string;
  size?: number;
}

export interface ChannelConfig {
  id: string;
  companyId: string;
  agentId: string;
  channel: ChannelType;
  webhookUrl: string;
  webhookSecret: string;
  credentials: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendOptions {
  replyToId?: string;
  parseMode?: "text" | "markdown" | "html";
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Session Types
// ============================================================================

export interface ChatSession {
  sessionId: string;
  conversationId: string;
  companyId: string;
  agentId: string;
  endUserId?: string;
  channel: ChannelType;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SessionCreateOptions {
  companyId: string;
  agentId: string;
  channel: ChannelType;
  endUserId?: string;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Subscription Types
// ============================================================================

export type EventCallback = (event: SSEEvent) => void;

export interface Subscription {
  id: string;
  channel: string;
  callback: EventCallback;
  unsubscribe: () => void;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}
