/**
 * Push Notification Service
 *
 * Handles push notifications for mobile and desktop applications.
 * Features:
 * - Web Push API (VAPID)
 * - Mobile push (Firebase Cloud Messaging)
 * - Device registration and management
 * - Notification templating
 * - Delivery tracking
 */

import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export type PushProvider = "web" | "fcm" | "apns";

export interface PushSubscription {
  id: string;
  userId: string;
  provider: PushProvider;
  endpoint: string;
  deviceToken?: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  deviceInfo?: {
    platform: string;
    browser?: string;
    os?: string;
    deviceName?: string;
  };
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  urgency?: "very-low" | "low" | "normal" | "high";
  ttl?: number; // seconds
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface DeliveryResult {
  subscriptionId: string;
  success: boolean;
  error?: string;
  statusCode?: number;
  timestamp: Date;
}

export interface VAPIDKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface FCMConfig {
  projectId: string;
  serviceAccountKey: string;
}

// ============================================================================
// Push Service Class
// ============================================================================

export class PushService {
  private subscriptions: Map<string, PushSubscription> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map();
  private vapidKeys?: VAPIDKeys;
  private fcmConfig?: FCMConfig;
  private deliveryHistory: Map<string, DeliveryResult[]> = new Map();

  /**
   * Initialize VAPID keys for Web Push
   */
  initializeVAPID(keys: VAPIDKeys): void {
    this.vapidKeys = keys;
  }

  /**
   * Initialize FCM for mobile push
   */
  initializeFCM(config: FCMConfig): void {
    this.fcmConfig = config;
  }

  /**
   * Get VAPID public key for client subscription
   */
  getVAPIDPublicKey(): string | null {
    return this.vapidKeys?.publicKey ?? null;
  }

  /**
   * Register a new push subscription
   */
  async registerSubscription(params: {
    userId: string;
    provider: PushProvider;
    endpoint: string;
    deviceToken?: string;
    keys?: { p256dh: string; auth: string };
    deviceInfo?: PushSubscription["deviceInfo"];
  }): Promise<PushSubscription> {
    // Check for existing subscription with same endpoint
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_id, sub] of this.subscriptions) {
      if (sub.endpoint === params.endpoint) {
        // Update existing subscription
        sub.userId = params.userId;
        sub.lastUsedAt = new Date();
        sub.isActive = true;
        return sub;
      }
    }

    const subscription: PushSubscription = {
      id: crypto.randomUUID(),
      userId: params.userId,
      provider: params.provider,
      endpoint: params.endpoint,
      deviceToken: params.deviceToken,
      keys: params.keys,
      deviceInfo: params.deviceInfo,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      isActive: true,
    };

    this.subscriptions.set(subscription.id, subscription);

    // Track user subscriptions
    if (!this.userSubscriptions.has(params.userId)) {
      this.userSubscriptions.set(params.userId, new Set());
    }
    this.userSubscriptions.get(params.userId)!.add(subscription.id);

    return subscription;
  }

  /**
   * Unregister a subscription
   */
  async unregisterSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    // Remove from user's subscriptions
    const userSubs = this.userSubscriptions.get(subscription.userId);
    if (userSubs) {
      userSubs.delete(subscriptionId);
    }

    this.subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Deactivate subscription (e.g., after delivery failure)
   */
  deactivateSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
    }
  }

  /**
   * Get user's active subscriptions
   */
  getUserSubscriptions(userId: string): PushSubscription[] {
    const subscriptionIds = this.userSubscriptions.get(userId);
    if (!subscriptionIds) return [];

    const subscriptions: PushSubscription[] = [];
    for (const id of subscriptionIds) {
      const sub = this.subscriptions.get(id);
      if (sub && sub.isActive) {
        subscriptions.push(sub);
      }
    }

    return subscriptions;
  }

  /**
   * Send push notification to a user
   */
  async sendToUser(
    userId: string,
    notification: Omit<PushNotification, "id">
  ): Promise<DeliveryResult[]> {
    const subscriptions = this.getUserSubscriptions(userId);
    if (subscriptions.length === 0) {
      return [];
    }

    const results: DeliveryResult[] = [];

    for (const subscription of subscriptions) {
      const result = await this.sendToSubscription(subscription, notification);
      results.push(result);

      // Deactivate on permanent failure
      if (!result.success && this.isPermanentFailure(result.statusCode)) {
        this.deactivateSubscription(subscription.id);
      }
    }

    return results;
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: Omit<PushNotification, "id">
  ): Promise<Map<string, DeliveryResult[]>> {
    const results = new Map<string, DeliveryResult[]>();

    // Send in parallel with concurrency limit
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userId) => {
        const userResults = await this.sendToUser(userId, notification);
        results.set(userId, userResults);
      });

      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * Send notification to a specific subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    notification: Omit<PushNotification, "id">
  ): Promise<DeliveryResult> {
    const notificationId = crypto.randomUUID();
    const fullNotification: PushNotification = {
      ...notification,
      id: notificationId,
    };

    try {
      switch (subscription.provider) {
        case "web":
          return await this.sendWebPush(subscription, fullNotification);
        case "fcm":
          return await this.sendFCMPush(subscription, fullNotification);
        case "apns":
          return await this.sendAPNSPush(subscription, fullNotification);
        default:
          return {
            subscriptionId: subscription.id,
            success: false,
            error: `Unsupported provider: ${subscription.provider}`,
            timestamp: new Date(),
          };
      }
    } catch (error) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send Web Push notification (VAPID)
   */
  private async sendWebPush(
    subscription: PushSubscription,
    notification: PushNotification
  ): Promise<DeliveryResult> {
    if (!this.vapidKeys) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: "VAPID keys not configured",
        timestamp: new Date(),
      };
    }

    if (!subscription.keys) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: "Subscription keys missing",
        timestamp: new Date(),
      };
    }

    try {
      // Build the push payload
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        image: notification.image,
        tag: notification.tag,
        data: notification.data,
        actions: notification.actions,
        requireInteraction: notification.requireInteraction,
        silent: notification.silent,
      });

      // In production, use web-push library
      // For now, make direct API call simulation
      const response = await this.makeWebPushRequest(
        subscription.endpoint,
        payload,
        subscription.keys,
        notification.urgency ?? "normal",
        notification.ttl ?? 86400
      );

      // Update last used
      subscription.lastUsedAt = new Date();

      return {
        subscriptionId: subscription.id,
        success: response.success,
        statusCode: response.statusCode,
        error: response.error,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: error instanceof Error ? error.message : "Web push failed",
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send FCM push notification
   */
  private async sendFCMPush(
    subscription: PushSubscription,
    notification: PushNotification
  ): Promise<DeliveryResult> {
    if (!this.fcmConfig) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: "FCM not configured",
        timestamp: new Date(),
      };
    }

    if (!subscription.deviceToken) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: "Device token missing",
        timestamp: new Date(),
      };
    }

    try {
      // Build FCM message
      const message = {
        message: {
          token: subscription.deviceToken,
          notification: {
            title: notification.title,
            body: notification.body,
            image: notification.image,
          },
          data: notification.data
            ? Object.fromEntries(
                Object.entries(notification.data).map(([k, v]) => [k, String(v)])
              )
            : undefined,
          android: {
            priority: notification.urgency === "high" ? "high" : "normal",
            ttl: `${notification.ttl ?? 86400}s`,
            notification: {
              icon: notification.icon,
              tag: notification.tag,
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: notification.title,
                  body: notification.body,
                },
                badge: notification.badge ? parseInt(notification.badge) : undefined,
                sound: notification.silent ? undefined : "default",
              },
            },
          },
        },
      };

      // Get OAuth token for FCM
      const accessToken = await this.getFCMAccessToken();

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.fcmConfig.projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        }
      );

      if (response.ok) {
        subscription.lastUsedAt = new Date();
        return {
          subscriptionId: subscription.id,
          success: true,
          statusCode: response.status,
          timestamp: new Date(),
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          subscriptionId: subscription.id,
          success: false,
          statusCode: response.status,
          error: JSON.stringify(errorData),
          timestamp: new Date(),
        };
      }
    } catch (error) {
      return {
        subscriptionId: subscription.id,
        success: false,
        error: error instanceof Error ? error.message : "FCM push failed",
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send APNS push notification (placeholder - requires Apple certificates)
   */
  private async sendAPNSPush(
    subscription: PushSubscription,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _notification: PushNotification
  ): Promise<DeliveryResult> {
    // APNS requires Apple Push Notification service certificates
    // This is a placeholder implementation
    return {
      subscriptionId: subscription.id,
      success: false,
      error: "APNS not implemented - requires Apple certificates",
      timestamp: new Date(),
    };
  }

  /**
   * Make Web Push API request
   */
  private async makeWebPushRequest(
    endpoint: string,
    payload: string,
    keys: { p256dh: string; auth: string },
    urgency: string,
    ttl: number
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    // In production, use web-push library for proper encryption
    // This is a simplified implementation
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          TTL: ttl.toString(),
          Urgency: urgency,
          // Note: Actual implementation needs VAPID authorization header
          // and proper payload encryption using keys
        },
        body: payload,
      });

      if (response.ok || response.status === 201) {
        return { success: true, statusCode: response.status };
      }

      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  }

  /**
   * Get FCM access token using service account
   */
  private async getFCMAccessToken(): Promise<string> {
    // In production, use Google Auth library for proper OAuth2 flow
    // This is a placeholder
    throw new Error("FCM access token not implemented - use google-auth-library");
  }

  /**
   * Check if status code indicates permanent failure
   */
  private isPermanentFailure(statusCode?: number): boolean {
    if (!statusCode) return false;
    // 404 (not found), 410 (gone) indicate subscription is no longer valid
    return [404, 410].includes(statusCode);
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(userId?: string): {
    totalSent: number;
    totalSuccess: number;
    totalFailed: number;
    successRate: number;
  } {
    let totalSent = 0;
    let totalSuccess = 0;

    for (const [subId, results] of this.deliveryHistory) {
      if (userId) {
        const sub = this.subscriptions.get(subId);
        if (sub?.userId !== userId) continue;
      }

      for (const result of results) {
        totalSent++;
        if (result.success) totalSuccess++;
      }
    }

    return {
      totalSent,
      totalSuccess,
      totalFailed: totalSent - totalSuccess,
      successRate: totalSent > 0 ? totalSuccess / totalSent : 0,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.subscriptions.clear();
    this.userSubscriptions.clear();
    this.deliveryHistory.clear();
  }
}

// ============================================================================
// Notification Templates
// ============================================================================

export const NotificationTemplates = {
  newMessage(senderName: string, preview: string): Omit<PushNotification, "id"> {
    return {
      title: `New message from ${senderName}`,
      body: preview.slice(0, 100),
      icon: "/icons/message.png",
      tag: "new-message",
      requireInteraction: false,
      data: { type: "new_message" },
    };
  },

  newConversation(customerName?: string): Omit<PushNotification, "id"> {
    return {
      title: "New conversation",
      body: customerName
        ? `${customerName} started a new conversation`
        : "A customer started a new conversation",
      icon: "/icons/conversation.png",
      tag: "new-conversation",
      requireInteraction: true,
      data: { type: "new_conversation" },
      actions: [
        { action: "accept", title: "Accept" },
        { action: "view", title: "View" },
      ],
    };
  },

  escalation(
    reason: string,
    customerName?: string
  ): Omit<PushNotification, "id"> {
    return {
      title: "Escalation",
      body: `${customerName ?? "Customer"} needs human assistance: ${reason}`,
      icon: "/icons/escalation.png",
      badge: "/icons/badge-urgent.png",
      tag: "escalation",
      urgency: "high",
      requireInteraction: true,
      data: { type: "escalation" },
      actions: [
        { action: "accept", title: "Accept" },
        { action: "view", title: "View" },
      ],
    };
  },

  slaWarning(
    conversationId: string,
    minutesRemaining: number
  ): Omit<PushNotification, "id"> {
    return {
      title: "SLA Warning",
      body: `Response time SLA at risk. ${minutesRemaining} minutes remaining.`,
      icon: "/icons/warning.png",
      tag: `sla-${conversationId}`,
      urgency: "high",
      requireInteraction: true,
      data: { type: "sla_warning", conversationId },
    };
  },

  systemAlert(message: string): Omit<PushNotification, "id"> {
    return {
      title: "System Alert",
      body: message,
      icon: "/icons/system.png",
      tag: "system-alert",
      urgency: "normal",
      data: { type: "system" },
    };
  },
};

// ============================================================================
// Singleton Instance
// ============================================================================

let pushServiceInstance: PushService | null = null;

export function getPushService(): PushService {
  if (!pushServiceInstance) {
    pushServiceInstance = new PushService();
  }
  return pushServiceInstance;
}

export function createPushService(): PushService {
  return new PushService();
}
