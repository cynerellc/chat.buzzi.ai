/**
 * Typing Indicator Service
 *
 * Enhanced typing indicator service with:
 * - Real-time typing broadcast via SSE
 * - Automatic timeout handling
 * - Multi-participant support
 * - Channel-specific typing indicators
 * - Rate limiting to prevent spam
 */

import { getSSEManager, getConversationChannel } from "./sse-manager";

// ============================================================================
// Configuration
// ============================================================================

const TYPING_TIMEOUT_MS = 5000; // Auto-stop after 5 seconds
const TYPING_RATE_LIMIT_MS = 500; // Minimum interval between typing events
const MAX_TYPING_DURATION_MS = 30000; // Maximum typing duration

// ============================================================================
// Types
// ============================================================================

export interface TypingUser {
  userId: string;
  userName?: string;
  userType: "end_user" | "support_agent" | "ai_agent";
  conversationId: string;
  startedAt: Date;
  lastActivityAt: Date;
}

export interface TypingState {
  user: TypingUser;
  timeoutId: NodeJS.Timeout;
  maxTimeoutId: NodeJS.Timeout;
}

export interface TypingEvent {
  conversationId: string;
  users: Array<{
    userId: string;
    userName?: string;
    userType: string;
  }>;
  isTyping: boolean;
  timestamp: number;
}

// ============================================================================
// Typing Service Class
// ============================================================================

export class TypingService {
  // Map: conversationId -> userId -> TypingState
  private typingStates: Map<string, Map<string, TypingState>> = new Map();

  // Map: userId -> lastTypingEventTime (for rate limiting)
  private lastTypingEvent: Map<string, number> = new Map();

  /**
   * Start typing indicator for a user
   */
  startTyping(
    conversationId: string,
    userId: string,
    options?: {
      userName?: string;
      userType?: TypingUser["userType"];
    }
  ): boolean {
    // Rate limiting check
    const now = Date.now();
    const lastEvent = this.lastTypingEvent.get(userId) ?? 0;
    if (now - lastEvent < TYPING_RATE_LIMIT_MS) {
      // Update activity time but don't broadcast
      this.updateTypingActivity(conversationId, userId);
      return false;
    }

    this.lastTypingEvent.set(userId, now);

    // Get or create conversation map
    if (!this.typingStates.has(conversationId)) {
      this.typingStates.set(conversationId, new Map());
    }

    const conversationTyping = this.typingStates.get(conversationId)!;
    const existingState = conversationTyping.get(userId);

    // Clear existing timeouts
    if (existingState) {
      clearTimeout(existingState.timeoutId);
      clearTimeout(existingState.maxTimeoutId);
    }

    // Create timeout to auto-stop typing after inactivity
    const timeoutId = setTimeout(() => {
      this.stopTyping(conversationId, userId);
    }, TYPING_TIMEOUT_MS);

    // Create max duration timeout
    const maxTimeoutId = setTimeout(() => {
      this.stopTyping(conversationId, userId);
    }, MAX_TYPING_DURATION_MS);

    const wasTyping = existingState !== undefined;
    const user: TypingUser = {
      userId,
      userName: options?.userName,
      userType: options?.userType ?? "end_user",
      conversationId,
      startedAt: existingState?.user.startedAt ?? new Date(),
      lastActivityAt: new Date(),
    };

    conversationTyping.set(userId, {
      user,
      timeoutId,
      maxTimeoutId,
    });

    // Broadcast if this is a new typing state
    if (!wasTyping) {
      this.broadcastTypingUpdate(conversationId);
    }

    return !wasTyping;
  }

  /**
   * Stop typing indicator for a user
   */
  stopTyping(conversationId: string, userId: string): boolean {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return false;

    const state = conversationTyping.get(userId);
    if (!state) return false;

    // Clear timeouts
    clearTimeout(state.timeoutId);
    clearTimeout(state.maxTimeoutId);

    // Remove from typing users
    conversationTyping.delete(userId);

    // Cleanup empty conversation map
    if (conversationTyping.size === 0) {
      this.typingStates.delete(conversationId);
    }

    // Clear rate limit entry
    this.lastTypingEvent.delete(userId);

    // Broadcast update
    this.broadcastTypingUpdate(conversationId);

    return true;
  }

  /**
   * Update typing activity (extends timeout without broadcasting)
   */
  private updateTypingActivity(conversationId: string, userId: string): void {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return;

    const state = conversationTyping.get(userId);
    if (!state) return;

    // Update last activity
    state.user.lastActivityAt = new Date();

    // Reset timeout
    clearTimeout(state.timeoutId);
    state.timeoutId = setTimeout(() => {
      this.stopTyping(conversationId, userId);
    }, TYPING_TIMEOUT_MS);
  }

  /**
   * Get all typing users in a conversation
   */
  getTypingUsers(conversationId: string): TypingUser[] {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return [];

    return Array.from(conversationTyping.values()).map((state) => state.user);
  }

  /**
   * Check if a specific user is typing
   */
  isUserTyping(conversationId: string, userId: string): boolean {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return false;

    return conversationTyping.has(userId);
  }

  /**
   * Check if anyone is typing in a conversation
   */
  isAnyoneTyping(conversationId: string): boolean {
    const conversationTyping = this.typingStates.get(conversationId);
    return conversationTyping ? conversationTyping.size > 0 : false;
  }

  /**
   * Get typing indicator info for display
   */
  getTypingIndicatorText(conversationId: string): string | null {
    const users = this.getTypingUsers(conversationId);
    if (users.length === 0) return null;

    const firstUser = users[0];
    if (users.length === 1 && firstUser) {
      return `${firstUser.userName ?? "Someone"} is typing...`;
    }

    const secondUser = users[1];
    if (users.length === 2 && firstUser && secondUser) {
      return `${firstUser.userName ?? "Someone"} and ${secondUser.userName ?? "someone"} are typing...`;
    }

    return `${users.length} people are typing...`;
  }

  /**
   * Broadcast typing update to conversation participants
   */
  private broadcastTypingUpdate(conversationId: string): void {
    const users = this.getTypingUsers(conversationId);
    const sseManager = getSSEManager();

    const event: TypingEvent = {
      conversationId,
      users: users.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userType: u.userType,
      })),
      isTyping: users.length > 0,
      timestamp: Date.now(),
    };

    // Broadcast to conversation channel
    sseManager.publish(getConversationChannel(conversationId), "typing", event);

    // Also broadcast to support agents watching this conversation
    // This allows agent inbox to show typing indicators
    for (const user of users) {
      if (user.userType === "end_user") {
        // Find support agents and notify them
        // In production, you'd look up assigned agents
        sseManager.publish(
          `conversation:${conversationId}:agents`,
          "typing",
          event
        );
        break;
      }
    }
  }

  /**
   * Stop all typing indicators for a user across all conversations
   */
  stopAllTyping(userId: string): void {
    for (const [conversationId, conversationTyping] of this.typingStates) {
      if (conversationTyping.has(userId)) {
        this.stopTyping(conversationId, userId);
      }
    }
  }

  /**
   * Clear all typing states for a conversation
   */
  clearConversation(conversationId: string): void {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return;

    // Clear all timeouts
    for (const state of conversationTyping.values()) {
      clearTimeout(state.timeoutId);
      clearTimeout(state.maxTimeoutId);
      this.lastTypingEvent.delete(state.user.userId);
    }

    this.typingStates.delete(conversationId);
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalConversations: number;
    totalTypingUsers: number;
    conversationStats: Array<{
      conversationId: string;
      typingUsers: number;
    }>;
  } {
    let totalTypingUsers = 0;
    const conversationStats: Array<{ conversationId: string; typingUsers: number }> = [];

    for (const [conversationId, conversationTyping] of this.typingStates) {
      const count = conversationTyping.size;
      totalTypingUsers += count;
      conversationStats.push({
        conversationId,
        typingUsers: count,
      });
    }

    return {
      totalConversations: this.typingStates.size,
      totalTypingUsers,
      conversationStats,
    };
  }

  /**
   * Clear all typing states
   */
  clear(): void {
    for (const conversationId of this.typingStates.keys()) {
      this.clearConversation(conversationId);
    }
    this.lastTypingEvent.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let typingServiceInstance: TypingService | null = null;

export function getTypingService(): TypingService {
  if (!typingServiceInstance) {
    typingServiceInstance = new TypingService();
  }
  return typingServiceInstance;
}

export function createTypingService(): TypingService {
  return new TypingService();
}
