/**
 * Conversation History Service
 *
 * Manages conversation history for AI agents with support for:
 * - In-memory caching for active conversations
 * - Database persistence for long-term storage
 * - Automatic history trimming based on token limits
 * - Optional summarization for long conversations
 */

import { db } from "@/lib/db";
import { messages as messagesTable } from "@/lib/db/schema/conversations";
import { eq, asc } from "drizzle-orm";

import type { LLMMessage, HistoryConfig } from "../types";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// ============================================================================
// Types
// ============================================================================

export interface HistoryMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: Date;
  metadata?: {
    toolCallId?: string;
    toolName?: string;
    tokenCount?: number;
  };
}

export interface ConversationHistory {
  conversationId: string;
  messages: HistoryMessage[];
  summary?: string;
  totalMessages: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// In-Memory Cache (will be replaced with Redis in production)
// ============================================================================

class HistoryCache {
  private cache: Map<string, ConversationHistory> = new Map();
  private readonly maxCacheSize = 1000;
  private readonly ttlMs: number;

  constructor(ttlMs: number = 3600000) {
    // Default 1 hour TTL
    this.ttlMs = ttlMs;
  }

  get(conversationId: string): ConversationHistory | undefined {
    const entry = this.cache.get(conversationId);
    if (entry) {
      // Check if expired
      const age = Date.now() - entry.updatedAt.getTime();
      if (age > this.ttlMs) {
        this.cache.delete(conversationId);
        return undefined;
      }
    }
    return entry;
  }

  set(conversationId: string, history: ConversationHistory): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(conversationId, {
      ...history,
      updatedAt: new Date(),
    });
  }

  delete(conversationId: string): void {
    this.cache.delete(conversationId);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// History Service Class
// ============================================================================

export class HistoryService {
  private config: HistoryConfig;
  private cache: HistoryCache;

  constructor(config: HistoryConfig) {
    this.config = config;
    this.cache = new HistoryCache(config.ttlSeconds * 1000);
  }

  /**
   * Get conversation history
   */
  async get(conversationId: string): Promise<HistoryMessage[]> {
    // Check cache first
    const cached = this.cache.get(conversationId);
    if (cached) {
      return this.trimHistory(cached.messages);
    }

    // Load from database
    const history = await this.loadFromDatabase(conversationId);
    if (history) {
      this.cache.set(conversationId, history);
      return this.trimHistory(history.messages);
    }

    return [];
  }

  /**
   * Add messages to history
   */
  async append(
    conversationId: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<void> {
    // Get existing history
    let history = this.cache.get(conversationId);

    if (!history) {
      history = {
        conversationId,
        messages: [],
        totalMessages: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Add new messages
    const newMessages: HistoryMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(),
    }));

    history.messages.push(...newMessages);
    history.totalMessages += newMessages.length;
    history.updatedAt = new Date();

    // Update cache
    this.cache.set(conversationId, history);

    // Note: Database persistence happens via the message API routes
    // This service is primarily for fast history access during conversations
  }

  /**
   * Clear conversation history
   */
  async clear(conversationId: string): Promise<void> {
    this.cache.delete(conversationId);
  }

  /**
   * Get history formatted for LLM
   */
  async getForLLM(conversationId: string): Promise<LLMMessage[]> {
    const history = await this.get(conversationId);

    return history.map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...(msg.metadata?.toolCallId && { toolCallId: msg.metadata.toolCallId }),
    }));
  }

  /**
   * Summarize long conversation (placeholder - requires LLM call)
   */
  async summarize(conversationId: string): Promise<string> {
    const history = await this.get(conversationId);

    if (history.length === 0) {
      return "";
    }

    // Simple summary for now - just concatenate first and last few messages
    // In production, this would use the LLM to generate a proper summary
    const firstMessages = history.slice(0, 3);
    const lastMessages = history.slice(-3);

    const summary = [
      "Conversation Summary:",
      "---",
      "Beginning of conversation:",
      ...firstMessages.map((m) => `${m.role}: ${m.content.slice(0, 100)}...`),
      "...",
      "Recent messages:",
      ...lastMessages.map((m) => `${m.role}: ${m.content.slice(0, 100)}...`),
    ].join("\n");

    return summary;
  }

  /**
   * Load history from database
   */
  private async loadFromDatabase(
    conversationId: string
  ): Promise<ConversationHistory | null> {
    // Skip database query if conversationId is not a valid UUID
    // This handles test sessions and other non-persistent conversations
    if (!isValidUUID(conversationId)) {
      console.log(`[HistoryService] Skipping DB load - conversationId "${conversationId}" is not a valid UUID`);
      return null;
    }

    try {
      console.log(`[HistoryService] Loading history from DB for conversation: ${conversationId}`);
      const dbMessages = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conversationId))
        .orderBy(asc(messagesTable.createdAt))
        .limit(this.config.maxMessages);

      console.log(`[HistoryService] Found ${dbMessages.length} messages in DB`);

      if (dbMessages.length === 0) {
        return null;
      }

      const messages: HistoryMessage[] = dbMessages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system" | "tool",
        content: msg.content,
        timestamp: msg.createdAt,
        metadata: {
          tokenCount: msg.tokenCount || undefined,
        },
      }));

      const firstMessage = dbMessages[0];
      const lastMessage = dbMessages[dbMessages.length - 1];

      return {
        conversationId,
        messages,
        totalMessages: dbMessages.length,
        createdAt: firstMessage?.createdAt ?? new Date(),
        updatedAt: lastMessage?.createdAt ?? new Date(),
      };
    } catch (error) {
      console.error("[HistoryService] Error loading history from database:", error);
      return null;
    }
  }

  /**
   * Trim history to fit within max messages limit
   */
  private trimHistory(messages: HistoryMessage[]): HistoryMessage[] {
    if (messages.length <= this.config.maxMessages) {
      return messages;
    }

    // Keep the most recent messages
    return messages.slice(-this.config.maxMessages);
  }

  /**
   * Estimate token count for history
   */
  estimateTokenCount(messages: HistoryMessage[]): number {
    const totalChars = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    // Rough estimation: ~4 characters per token
    return Math.ceil(totalChars / 4);
  }

  /**
   * Check if history needs summarization
   */
  needsSummarization(messages: HistoryMessage[]): boolean {
    if (!this.config.enableSummarization) {
      return false;
    }

    const tokenCount = this.estimateTokenCount(messages);
    // Summarize if we're using more than 50% of typical context window
    return tokenCount > 50000;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createHistoryService(config: HistoryConfig): HistoryService {
  return new HistoryService(config);
}

// Default configuration
export const defaultHistoryConfig: HistoryConfig = {
  maxMessages: 50,
  ttlSeconds: 86400, // 24 hours
  enableSummarization: true,
};
