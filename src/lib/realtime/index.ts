/**
 * Realtime Communication Module
 *
 * Provides real-time communication capabilities including:
 * - SSE event management
 * - User/agent presence tracking
 * - Typing indicators
 * - Channel adapters for external platforms
 * - Handover/escalation service
 * - Real-time notifications
 */

// Types
export * from "./types";

// SSE Manager
export {
  SSEManager,
  getSSEManager,
  createSSEManager,
  getConversationChannel,
  getUserChannel,
  getCompanyChannel,
  getAgentNotificationChannel,
  getSupportAgentChannel,
} from "./sse-manager";

// Presence Manager
export {
  PresenceManager,
  getPresenceManager,
  createPresenceManager,
} from "./presence-manager";

// Typing Indicator (original)
export {
  TypingIndicatorService,
  getTypingIndicator,
  createTypingIndicator,
} from "./typing-indicator";

// Typing Service (enhanced)
export {
  TypingService,
  getTypingService,
  createTypingService,
  type TypingUser,
  type TypingEvent,
} from "./typing-service";

// Handover/Escalation Service
export {
  HandoverService,
  getHandoverService,
  createHandoverService,
  type Escalation,
  type EscalationReason,
  type EscalationStatus,
  type EscalationPriority,
  type EscalationTrigger,
  type QueuedConversation,
} from "./handover-service";

// Notification Service
export {
  NotificationService,
  getNotificationService,
  createNotificationService,
  type Notification,
  type NotificationType,
  type NotificationPriority,
  type NotificationPreferences,
  type NotificationAction,
} from "./notification-service";

// Channel Adapters
export * from "./channels";
