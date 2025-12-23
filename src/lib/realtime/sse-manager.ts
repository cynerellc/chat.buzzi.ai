/**
 * SSE Event Manager
 *
 * Manages Server-Sent Events for real-time communication.
 * Provides a pub/sub system for broadcasting events to connected clients.
 *
 * Features:
 * - In-memory event subscriptions
 * - Channel-based event routing
 * - Automatic heartbeats
 * - Connection cleanup
 */

import type {
  SSEEvent,
  SSEEventType,
  EventCallback,
  Subscription,
} from "./types";

// ============================================================================
// Types
// ============================================================================

interface ChannelSubscriber {
  id: string;
  callback: EventCallback;
  createdAt: Date;
}

// ============================================================================
// SSE Manager Class
// ============================================================================

export class SSEManager {
  private channels: Map<string, Map<string, ChannelSubscriber>> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly heartbeatIntervalMs = 30000; // 30 seconds

  /**
   * Subscribe to a channel for events
   */
  subscribe(channel: string, callback: EventCallback): Subscription {
    const subscriberId = crypto.randomUUID();

    // Get or create channel
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Map());
    }

    const channelSubscribers = this.channels.get(channel)!;
    channelSubscribers.set(subscriberId, {
      id: subscriberId,
      callback,
      createdAt: new Date(),
    });

    // Return subscription object
    return {
      id: subscriberId,
      channel,
      callback,
      unsubscribe: () => this.unsubscribe(channel, subscriberId),
    };
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string, subscriberId: string): void {
    const channelSubscribers = this.channels.get(channel);
    if (channelSubscribers) {
      channelSubscribers.delete(subscriberId);

      // Clean up empty channels
      if (channelSubscribers.size === 0) {
        this.channels.delete(channel);
      }
    }
  }

  /**
   * Publish an event to a channel
   */
  publish(channel: string, type: SSEEventType, data: unknown): void {
    const channelSubscribers = this.channels.get(channel);
    if (!channelSubscribers) {
      return;
    }

    const event: SSEEvent = {
      type,
      data,
      timestamp: Date.now(),
    };

    // Notify all subscribers
    for (const subscriber of channelSubscribers.values()) {
      try {
        subscriber.callback(event);
      } catch (error) {
        console.error(`Error notifying subscriber ${subscriber.id}:`, error);
      }
    }
  }

  /**
   * Publish an event to multiple channels
   */
  publishToMultiple(channels: string[], type: SSEEventType, data: unknown): void {
    for (const channel of channels) {
      this.publish(channel, type, data);
    }
  }

  /**
   * Start heartbeat for a channel
   */
  startHeartbeat(channel: string): void {
    if (this.heartbeatIntervals.has(channel)) {
      return;
    }

    const interval = setInterval(() => {
      this.publish(channel, "heartbeat", { timestamp: Date.now() });
    }, this.heartbeatIntervalMs);

    this.heartbeatIntervals.set(channel, interval);
  }

  /**
   * Stop heartbeat for a channel
   */
  stopHeartbeat(channel: string): void {
    const interval = this.heartbeatIntervals.get(channel);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(channel);
    }
  }

  /**
   * Get subscriber count for a channel
   */
  getSubscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }

  /**
   * Check if channel has any subscribers
   */
  hasSubscribers(channel: string): boolean {
    return this.getSubscriberCount(channel) > 0;
  }

  /**
   * Get all active channels
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Cleanup all subscriptions for a channel
   */
  cleanupChannel(channel: string): void {
    this.stopHeartbeat(channel);
    this.channels.delete(channel);
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    for (const channel of this.channels.keys()) {
      this.cleanupChannel(channel);
    }
  }
}

// ============================================================================
// Channel Name Helpers
// ============================================================================

/**
 * Generate channel name for a conversation
 */
export function getConversationChannel(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/**
 * Generate channel name for a user's presence
 */
export function getUserChannel(userId: string): string {
  return `user:${userId}`;
}

/**
 * Generate channel name for a company's notifications
 */
export function getCompanyChannel(companyId: string): string {
  return `company:${companyId}`;
}

/**
 * Generate channel name for an agent's notifications
 */
export function getAgentNotificationChannel(agentId: string): string {
  return `agent:${agentId}`;
}

/**
 * Generate channel name for support agent inbox
 */
export function getSupportAgentChannel(userId: string): string {
  return `support:${userId}`;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let sseManagerInstance: SSEManager | null = null;

export function getSSEManager(): SSEManager {
  if (!sseManagerInstance) {
    sseManagerInstance = new SSEManager();
  }
  return sseManagerInstance;
}

export function createSSEManager(): SSEManager {
  return new SSEManager();
}
