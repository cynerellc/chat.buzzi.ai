/**
 * Real-time Notification Service
 *
 * Manages real-time notifications for support agents and users.
 * Features:
 * - Notification routing by user/channel
 * - Notification persistence for history
 * - Read/unread tracking
 * - Priority-based delivery
 * - Sound/visual notification hints
 */

import {
  getSSEManager,
  getSupportAgentChannel,
  getUserChannel,
  getCompanyChannel,
} from "./sse-manager";

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | "new_message"
  | "new_conversation"
  | "escalation"
  | "assignment"
  | "transfer"
  | "mention"
  | "system"
  | "reminder"
  | "sla_warning"
  | "customer_waiting";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;

  // Target
  recipientId: string;
  recipientType: "user" | "agent" | "company";

  // Content
  title: string;
  body: string;
  data?: Record<string, unknown>;

  // References
  conversationId?: string;
  escalationId?: string;
  messageId?: string;

  // State
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;

  // Display hints
  sound?: boolean;
  vibrate?: boolean;
  showBanner?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: "accept" | "dismiss" | "view" | "reply" | "custom";
  data?: Record<string, unknown>;
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  emailEnabled: boolean;
  types: Record<NotificationType, boolean>;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
  };
}

// ============================================================================
// Notification Service Class
// ============================================================================

export class NotificationService {
  // In-memory notification storage (in production, use database)
  private notifications: Map<string, Notification> = new Map();

  // User notification lists
  private userNotifications: Map<string, string[]> = new Map();

  // Unread counts
  private unreadCounts: Map<string, number> = new Map();

  // User preferences
  private preferences: Map<string, NotificationPreferences> = new Map();

  // Default preferences
  private defaultPreferences: NotificationPreferences = {
    enabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    emailEnabled: false,
    types: {
      new_message: true,
      new_conversation: true,
      escalation: true,
      assignment: true,
      transfer: true,
      mention: true,
      system: true,
      reminder: true,
      sla_warning: true,
      customer_waiting: true,
    },
  };

  /**
   * Send notification to a user
   */
  async sendNotification(params: {
    type: NotificationType;
    recipientId: string;
    recipientType: "user" | "agent" | "company";
    title: string;
    body: string;
    priority?: NotificationPriority;
    conversationId?: string;
    escalationId?: string;
    messageId?: string;
    data?: Record<string, unknown>;
    actions?: NotificationAction[];
    expiresIn?: number; // seconds
    sound?: boolean;
  }): Promise<Notification> {
    // Check preferences
    const prefs = this.getPreferences(params.recipientId);
    if (!this.shouldDeliver(prefs, params.type)) {
      // Create notification but don't deliver via SSE
      const notification = this.createNotification(params, prefs);
      return notification;
    }

    const notification = this.createNotification(params, prefs);

    // Store notification
    this.storeNotification(notification);

    // Deliver via SSE
    this.deliverNotification(notification);

    return notification;
  }

  /**
   * Send notification to multiple recipients
   */
  async broadcastNotification(params: {
    type: NotificationType;
    recipientIds: string[];
    recipientType: "user" | "agent";
    title: string;
    body: string;
    priority?: NotificationPriority;
    conversationId?: string;
    data?: Record<string, unknown>;
  }): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const recipientId of params.recipientIds) {
      const notification = await this.sendNotification({
        ...params,
        recipientId,
      });
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Send notification to company channel
   */
  async notifyCompany(params: {
    companyId: string;
    type: NotificationType;
    title: string;
    body: string;
    priority?: NotificationPriority;
    conversationId?: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const sseManager = getSSEManager();

    sseManager.publish(getCompanyChannel(params.companyId), "notification", {
      type: params.type,
      title: params.title,
      body: params.body,
      priority: params.priority ?? "normal",
      conversationId: params.conversationId,
      data: params.data,
      timestamp: Date.now(),
    });
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.isRead) return false;

    notification.isRead = true;
    notification.readAt = new Date();

    // Update unread count
    const count = this.unreadCounts.get(notification.recipientId) ?? 0;
    if (count > 0) {
      this.unreadCounts.set(notification.recipientId, count - 1);
    }

    // Notify about read status
    this.notifyReadStatus(notification.recipientId);

    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(userId: string): number {
    const notificationIds = this.userNotifications.get(userId) ?? [];
    let markedCount = 0;

    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        markedCount++;
      }
    }

    this.unreadCounts.set(userId, 0);
    this.notifyReadStatus(userId);

    return markedCount;
  }

  /**
   * Get notifications for a user
   */
  getNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      type?: NotificationType;
      limit?: number;
      offset?: number;
    }
  ): { notifications: Notification[]; total: number; unreadCount: number } {
    const notificationIds = this.userNotifications.get(userId) ?? [];
    let notifications: Notification[] = [];

    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (!notification) continue;

      // Filter by unread
      if (options?.unreadOnly && notification.isRead) continue;

      // Filter by type
      if (options?.type && notification.type !== options.type) continue;

      // Check expiration
      if (notification.expiresAt && notification.expiresAt < new Date()) continue;

      notifications.push(notification);
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = notifications.length;

    // Apply pagination
    if (options?.offset) {
      notifications = notifications.slice(options.offset);
    }
    if (options?.limit) {
      notifications = notifications.slice(0, options.limit);
    }

    return {
      notifications,
      total,
      unreadCount: this.unreadCounts.get(userId) ?? 0,
    };
  }

  /**
   * Get unread count for a user
   */
  getUnreadCount(userId: string): number {
    return this.unreadCounts.get(userId) ?? 0;
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    // Remove from user list
    const userNotifs = this.userNotifications.get(notification.recipientId);
    if (userNotifs) {
      const index = userNotifs.indexOf(notificationId);
      if (index !== -1) {
        userNotifs.splice(index, 1);
      }
    }

    // Update unread count
    if (!notification.isRead) {
      const count = this.unreadCounts.get(notification.recipientId) ?? 0;
      if (count > 0) {
        this.unreadCounts.set(notification.recipientId, count - 1);
      }
    }

    this.notifications.delete(notificationId);
    return true;
  }

  /**
   * Clear old notifications
   */
  clearExpired(): number {
    const now = new Date();
    let clearedCount = 0;

    for (const [id, notification] of this.notifications) {
      if (notification.expiresAt && notification.expiresAt < now) {
        this.deleteNotification(id);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Set user notification preferences
   */
  setPreferences(userId: string, preferences: Partial<NotificationPreferences>): void {
    const current = this.preferences.get(userId) ?? { ...this.defaultPreferences };
    this.preferences.set(userId, { ...current, ...preferences });
  }

  /**
   * Get user notification preferences
   */
  getPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) ?? { ...this.defaultPreferences };
  }

  // ============================================================================
  // Convenience Methods for Common Notifications
  // ============================================================================

  /**
   * Notify agent of new message
   */
  async notifyNewMessage(params: {
    agentUserId: string;
    conversationId: string;
    senderName: string;
    preview: string;
    messageId: string;
  }): Promise<Notification> {
    return this.sendNotification({
      type: "new_message",
      recipientId: params.agentUserId,
      recipientType: "agent",
      title: `New message from ${params.senderName}`,
      body: params.preview.slice(0, 100),
      priority: "normal",
      conversationId: params.conversationId,
      messageId: params.messageId,
      actions: [
        { id: "view", label: "View", type: "view" },
        { id: "reply", label: "Reply", type: "reply" },
      ],
    });
  }

  /**
   * Notify agent of new conversation assignment
   */
  async notifyAssignment(params: {
    agentUserId: string;
    conversationId: string;
    customerName?: string;
    summary?: string;
  }): Promise<Notification> {
    return this.sendNotification({
      type: "assignment",
      recipientId: params.agentUserId,
      recipientType: "agent",
      title: "New conversation assigned",
      body: params.customerName
        ? `${params.customerName} needs assistance`
        : params.summary ?? "A customer needs assistance",
      priority: "high",
      conversationId: params.conversationId,
      sound: true,
      actions: [
        { id: "accept", label: "Accept", type: "accept" },
        { id: "view", label: "View", type: "view" },
      ],
    });
  }

  /**
   * Notify agent of escalation
   */
  async notifyEscalation(params: {
    agentUserId: string;
    conversationId: string;
    escalationId: string;
    reason: string;
    customerName?: string;
  }): Promise<Notification> {
    return this.sendNotification({
      type: "escalation",
      recipientId: params.agentUserId,
      recipientType: "agent",
      title: "Escalation",
      body: `${params.customerName ?? "Customer"} needs human assistance: ${params.reason}`,
      priority: "high",
      conversationId: params.conversationId,
      escalationId: params.escalationId,
      sound: true,
      actions: [
        { id: "accept", label: "Accept", type: "accept" },
        { id: "view", label: "View", type: "view" },
      ],
    });
  }

  /**
   * Notify agent of SLA warning
   */
  async notifySLAWarning(params: {
    agentUserId: string;
    conversationId: string;
    warningType: "response_time" | "resolution_time";
    timeRemaining: number; // seconds
  }): Promise<Notification> {
    const warningText =
      params.warningType === "response_time"
        ? "Response time SLA at risk"
        : "Resolution time SLA at risk";

    return this.sendNotification({
      type: "sla_warning",
      recipientId: params.agentUserId,
      recipientType: "agent",
      title: "SLA Warning",
      body: `${warningText}. ${Math.floor(params.timeRemaining / 60)} minutes remaining.`,
      priority: "urgent",
      conversationId: params.conversationId,
      sound: true,
      data: {
        warningType: params.warningType,
        timeRemaining: params.timeRemaining,
      },
    });
  }

  /**
   * Notify about customer waiting
   */
  async notifyCustomerWaiting(params: {
    agentUserId: string;
    conversationId: string;
    waitTimeSeconds: number;
  }): Promise<Notification> {
    const minutes = Math.floor(params.waitTimeSeconds / 60);

    return this.sendNotification({
      type: "customer_waiting",
      recipientId: params.agentUserId,
      recipientType: "agent",
      title: "Customer waiting",
      body: `Customer has been waiting for ${minutes} minutes`,
      priority: minutes > 5 ? "high" : "normal",
      conversationId: params.conversationId,
      data: { waitTimeSeconds: params.waitTimeSeconds },
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createNotification(
    params: {
      type: NotificationType;
      recipientId: string;
      recipientType: "user" | "agent" | "company";
      title: string;
      body: string;
      priority?: NotificationPriority;
      conversationId?: string;
      escalationId?: string;
      messageId?: string;
      data?: Record<string, unknown>;
      actions?: NotificationAction[];
      expiresIn?: number;
      sound?: boolean;
    },
    prefs: NotificationPreferences
  ): Notification {
    const notification: Notification = {
      id: crypto.randomUUID(),
      type: params.type,
      priority: params.priority ?? "normal",
      recipientId: params.recipientId,
      recipientType: params.recipientType,
      title: params.title,
      body: params.body,
      data: params.data,
      conversationId: params.conversationId,
      escalationId: params.escalationId,
      messageId: params.messageId,
      isRead: false,
      createdAt: new Date(),
      expiresAt: params.expiresIn
        ? new Date(Date.now() + params.expiresIn * 1000)
        : undefined,
      sound: params.sound ?? (prefs.soundEnabled && (params.priority === "high" || params.priority === "urgent")),
      showBanner: prefs.desktopEnabled,
      actions: params.actions,
    };

    return notification;
  }

  private storeNotification(notification: Notification): void {
    this.notifications.set(notification.id, notification);

    // Add to user's list
    if (!this.userNotifications.has(notification.recipientId)) {
      this.userNotifications.set(notification.recipientId, []);
    }
    this.userNotifications.get(notification.recipientId)!.push(notification.id);

    // Update unread count
    const count = this.unreadCounts.get(notification.recipientId) ?? 0;
    this.unreadCounts.set(notification.recipientId, count + 1);
  }

  private deliverNotification(notification: Notification): void {
    const sseManager = getSSEManager();

    // Determine channel
    let channel: string;
    switch (notification.recipientType) {
      case "agent":
        channel = getSupportAgentChannel(notification.recipientId);
        break;
      case "company":
        channel = getCompanyChannel(notification.recipientId);
        break;
      default:
        channel = getUserChannel(notification.recipientId);
    }

    // Send via SSE
    sseManager.publish(channel, "notification", {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      title: notification.title,
      body: notification.body,
      conversationId: notification.conversationId,
      escalationId: notification.escalationId,
      messageId: notification.messageId,
      data: notification.data,
      sound: notification.sound,
      showBanner: notification.showBanner,
      actions: notification.actions,
      unreadCount: this.unreadCounts.get(notification.recipientId) ?? 0,
      timestamp: notification.createdAt.getTime(),
    });
  }

  private notifyReadStatus(userId: string): void {
    const sseManager = getSSEManager();
    const channel = getSupportAgentChannel(userId);

    sseManager.publish(channel, "notification", {
      type: "read_status",
      unreadCount: this.unreadCounts.get(userId) ?? 0,
      timestamp: Date.now(),
    });
  }

  private shouldDeliver(prefs: NotificationPreferences, type: NotificationType): boolean {
    if (!prefs.enabled) return false;
    if (prefs.types[type] === false) return false;

    // Check quiet hours
    if (prefs.quietHours?.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      const start = prefs.quietHours.start;
      const end = prefs.quietHours.end;

      // Handle overnight quiet hours
      if (start > end) {
        if (currentTime >= start || currentTime <= end) {
          return false;
        }
      } else {
        if (currentTime >= start && currentTime <= end) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.notifications.clear();
    this.userNotifications.clear();
    this.unreadCounts.clear();
    this.preferences.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}

export function createNotificationService(): NotificationService {
  return new NotificationService();
}
