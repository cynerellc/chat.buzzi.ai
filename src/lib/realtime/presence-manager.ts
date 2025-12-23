/**
 * Presence Manager
 *
 * Manages user and agent presence status for real-time features.
 * Uses in-memory storage with TTL-based expiration.
 *
 * Features:
 * - User presence tracking (online/away/offline)
 * - Agent availability management
 * - Automatic status updates
 * - Presence change notifications
 */

import type {
  PresenceStatus,
  UserPresence,
  AgentPresence,
} from "./types";
import { getSSEManager, getUserChannel, getCompanyChannel } from "./sse-manager";

// ============================================================================
// Configuration
// ============================================================================

const PRESENCE_TTL_MS = 60000; // 1 minute before considered away
const OFFLINE_TTL_MS = 300000; // 5 minutes before considered offline
const CLEANUP_INTERVAL_MS = 30000; // Cleanup every 30 seconds

// ============================================================================
// Presence Manager Class
// ============================================================================

export class PresenceManager {
  private userPresence: Map<string, UserPresence> = new Map();
  private agentPresence: Map<string, AgentPresence> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  // ==========================================================================
  // User Presence
  // ==========================================================================

  /**
   * Update user presence status
   */
  setUserPresence(
    userId: string,
    status: PresenceStatus,
    options?: {
      currentConversationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const previous = this.userPresence.get(userId);
    const presence: UserPresence = {
      userId,
      status,
      lastActiveAt: new Date(),
      currentConversationId: options?.currentConversationId,
      metadata: options?.metadata,
    };

    this.userPresence.set(userId, presence);

    // Notify if status changed
    if (previous?.status !== status) {
      this.notifyPresenceChange(userId, presence);
    }
  }

  /**
   * Mark user as active (refreshes presence)
   */
  touchUserPresence(userId: string): void {
    const presence = this.userPresence.get(userId);
    if (presence) {
      presence.lastActiveAt = new Date();
      if (presence.status === "away") {
        presence.status = "online";
        this.notifyPresenceChange(userId, presence);
      }
    }
  }

  /**
   * Get user presence
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.userPresence.get(userId) ?? null;
  }

  /**
   * Get multiple user presences
   */
  getUsersPresence(userIds: string[]): Map<string, UserPresence> {
    const result = new Map<string, UserPresence>();
    for (const userId of userIds) {
      const presence = this.userPresence.get(userId);
      if (presence) {
        result.set(userId, presence);
      }
    }
    return result;
  }

  /**
   * Remove user presence
   */
  removeUserPresence(userId: string): void {
    const presence = this.userPresence.get(userId);
    if (presence) {
      this.userPresence.delete(userId);
      this.notifyPresenceChange(userId, { ...presence, status: "offline" });
    }
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): UserPresence[] {
    return Array.from(this.userPresence.values()).filter(
      (p) => p.status === "online"
    );
  }

  // ==========================================================================
  // Agent Presence
  // ==========================================================================

  /**
   * Update agent status
   */
  setAgentPresence(
    agentId: string,
    status: AgentPresence["status"],
    options?: {
      maxConversations?: number;
    }
  ): void {
    const current = this.agentPresence.get(agentId);
    const presence: AgentPresence = {
      agentId,
      status,
      activeConversations: current?.activeConversations ?? 0,
      maxConversations: options?.maxConversations ?? 10,
    };

    this.agentPresence.set(agentId, presence);
  }

  /**
   * Get agent presence
   */
  getAgentPresence(agentId: string): AgentPresence | null {
    return this.agentPresence.get(agentId) ?? null;
  }

  /**
   * Increment agent's active conversations
   */
  incrementAgentConversations(agentId: string): void {
    const presence = this.agentPresence.get(agentId);
    if (presence) {
      presence.activeConversations++;
    }
  }

  /**
   * Decrement agent's active conversations
   */
  decrementAgentConversations(agentId: string): void {
    const presence = this.agentPresence.get(agentId);
    if (presence && presence.activeConversations > 0) {
      presence.activeConversations--;
    }
  }

  /**
   * Check if agent is available for new conversations
   */
  isAgentAvailable(agentId: string): boolean {
    const presence = this.agentPresence.get(agentId);
    if (!presence) return false;
    if (presence.status !== "active") return false;
    return presence.activeConversations < presence.maxConversations;
  }

  /**
   * Get available agents for a company (sorted by load)
   */
  getAvailableAgents(agentIds: string[]): AgentPresence[] {
    return agentIds
      .map((id) => this.agentPresence.get(id))
      .filter((p): p is AgentPresence => p !== undefined && this.isAgentAvailable(p.agentId))
      .sort((a, b) => a.activeConversations - b.activeConversations);
  }

  // ==========================================================================
  // Presence Cleanup
  // ==========================================================================

  /**
   * Start automatic presence cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredPresence();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop automatic presence cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired presence entries
   */
  private cleanupExpiredPresence(): void {
    const now = Date.now();

    for (const [userId, presence] of this.userPresence.entries()) {
      const inactiveMs = now - presence.lastActiveAt.getTime();

      if (inactiveMs >= OFFLINE_TTL_MS && presence.status !== "offline") {
        // Mark as offline after 5 minutes
        presence.status = "offline";
        this.notifyPresenceChange(userId, presence);
      } else if (
        inactiveMs >= PRESENCE_TTL_MS &&
        presence.status === "online"
      ) {
        // Mark as away after 1 minute
        presence.status = "away";
        this.notifyPresenceChange(userId, presence);
      }
    }
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  /**
   * Notify subscribers about presence change
   */
  private notifyPresenceChange(userId: string, presence: UserPresence): void {
    const sseManager = getSSEManager();

    // Notify on user's channel
    sseManager.publish(getUserChannel(userId), "presence", {
      userId: presence.userId,
      status: presence.status,
      lastSeen: presence.lastActiveAt,
    });
  }

  /**
   * Notify a company about a support agent's presence change
   */
  notifySupportAgentPresence(
    companyId: string,
    userId: string,
    status: PresenceStatus
  ): void {
    const sseManager = getSSEManager();
    sseManager.publish(getCompanyChannel(companyId), "presence", {
      type: "support_agent",
      userId,
      status,
      timestamp: Date.now(),
    });
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clear all presence data
   */
  clear(): void {
    this.stopCleanup();
    this.userPresence.clear();
    this.agentPresence.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let presenceManagerInstance: PresenceManager | null = null;

export function getPresenceManager(): PresenceManager {
  if (!presenceManagerInstance) {
    presenceManagerInstance = new PresenceManager();
  }
  return presenceManagerInstance;
}

export function createPresenceManager(): PresenceManager {
  return new PresenceManager();
}
