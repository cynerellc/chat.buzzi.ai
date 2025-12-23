/**
 * Realtime Communication Module
 *
 * Provides real-time communication capabilities including:
 * - SSE event management
 * - User/agent presence tracking
 * - Typing indicators
 * - Channel adapters for external platforms
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

// Typing Indicator
export {
  TypingIndicatorService,
  getTypingIndicator,
  createTypingIndicator,
} from "./typing-indicator";

// Channel Adapters
export * from "./channels";
