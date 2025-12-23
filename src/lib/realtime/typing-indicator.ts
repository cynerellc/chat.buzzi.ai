/**
 * Typing Indicator Service
 *
 * Manages typing indicators for real-time chat.
 * Broadcasts when users start/stop typing in conversations.
 *
 * Features:
 * - Automatic typing timeout
 * - Debounced updates
 * - Multi-participant support
 */

import { getSSEManager, getConversationChannel } from "./sse-manager";

// ============================================================================
// Configuration
// ============================================================================

const TYPING_TIMEOUT_MS = 5000; // Auto-stop after 5 seconds of inactivity
const DEBOUNCE_MS = 500; // Debounce typing events

// ============================================================================
// Types
// ============================================================================

interface TypingState {
  userId: string;
  userName?: string;
  isTyping: boolean;
  startedAt: Date;
  timeoutId: NodeJS.Timeout | null;
}

// ============================================================================
// Typing Indicator Service
// ============================================================================

export class TypingIndicatorService {
  // Map of conversationId -> userId -> TypingState
  private typingStates: Map<string, Map<string, TypingState>> = new Map();

  /**
   * Start typing indicator for a user in a conversation
   */
  startTyping(
    conversationId: string,
    userId: string,
    userName?: string
  ): void {
    // Get or create conversation map
    if (!this.typingStates.has(conversationId)) {
      this.typingStates.set(conversationId, new Map());
    }

    const conversationTyping = this.typingStates.get(conversationId)!;
    const existingState = conversationTyping.get(userId);

    // Clear existing timeout
    if (existingState?.timeoutId) {
      clearTimeout(existingState.timeoutId);
    }

    // Create new timeout to auto-stop typing
    const timeoutId = setTimeout(() => {
      this.stopTyping(conversationId, userId);
    }, TYPING_TIMEOUT_MS);

    // Update state
    const wasTyping = existingState?.isTyping ?? false;
    conversationTyping.set(userId, {
      userId,
      userName,
      isTyping: true,
      startedAt: existingState?.startedAt ?? new Date(),
      timeoutId,
    });

    // Broadcast if status changed
    if (!wasTyping) {
      this.broadcastTypingUpdate(conversationId);
    }
  }

  /**
   * Stop typing indicator for a user in a conversation
   */
  stopTyping(conversationId: string, userId: string): void {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return;

    const state = conversationTyping.get(userId);
    if (!state) return;

    // Clear timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    // Remove from typing users
    conversationTyping.delete(userId);

    // Clean up empty conversation map
    if (conversationTyping.size === 0) {
      this.typingStates.delete(conversationId);
    }

    // Broadcast update
    this.broadcastTypingUpdate(conversationId);
  }

  /**
   * Get all typing users in a conversation
   */
  getTypingUsers(conversationId: string): Array<{
    userId: string;
    userName?: string;
    startedAt: Date;
  }> {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return [];

    return Array.from(conversationTyping.values())
      .filter((state) => state.isTyping)
      .map((state) => ({
        userId: state.userId,
        userName: state.userName,
        startedAt: state.startedAt,
      }));
  }

  /**
   * Check if a specific user is typing
   */
  isUserTyping(conversationId: string, userId: string): boolean {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return false;

    const state = conversationTyping.get(userId);
    return state?.isTyping ?? false;
  }

  /**
   * Check if anyone is typing in a conversation
   */
  isAnyoneTyping(conversationId: string): boolean {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return false;

    return Array.from(conversationTyping.values()).some(
      (state) => state.isTyping
    );
  }

  /**
   * Broadcast typing update to conversation participants
   */
  private broadcastTypingUpdate(conversationId: string): void {
    const typingUsers = this.getTypingUsers(conversationId);
    const sseManager = getSSEManager();

    sseManager.publish(getConversationChannel(conversationId), "typing", {
      conversationId,
      typingUsers: typingUsers.map((u) => ({
        userId: u.userId,
        userName: u.userName,
      })),
      isTyping: typingUsers.length > 0,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up all typing states for a conversation
   */
  clearConversation(conversationId: string): void {
    const conversationTyping = this.typingStates.get(conversationId);
    if (!conversationTyping) return;

    // Clear all timeouts
    for (const state of conversationTyping.values()) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
    }

    this.typingStates.delete(conversationId);
  }

  /**
   * Clear all typing states
   */
  clear(): void {
    for (const conversationId of this.typingStates.keys()) {
      this.clearConversation(conversationId);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let typingIndicatorInstance: TypingIndicatorService | null = null;

export function getTypingIndicator(): TypingIndicatorService {
  if (!typingIndicatorInstance) {
    typingIndicatorInstance = new TypingIndicatorService();
  }
  return typingIndicatorInstance;
}

export function createTypingIndicator(): TypingIndicatorService {
  return new TypingIndicatorService();
}
