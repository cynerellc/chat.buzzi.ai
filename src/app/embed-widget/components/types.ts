/**
 * Shared types for embed-widget components
 */

import type { CSSProperties } from "react";

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentInfo {
  id: string;
  name: string;
  designation?: string;
  avatarUrl?: string;
  color?: string;
  type?: string;
}

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  isNotification?: boolean;
  isTransfer?: boolean;
  targetAgentName?: string;
  targetAgentId?: string;
  targetAgentAvatarUrl?: string;
  targetAgentDesignation?: string;
  previousAgentId?: string;
  previousAgentName?: string;
  previousAgentAvatarUrl?: string;
  agentId?: string;
  agentName?: string;
  agentAvatarUrl?: string;
  agentColor?: string;
  // Voice message fields
  type?: "text" | "audio";
  audioUrl?: string;
  transcript?: string;
  duration?: number;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  sessionId: string;
  conversationId: string;
  endUserId: string;
}

// ============================================================================
// Thinking State Types
// ============================================================================

export interface ThinkingState {
  text?: string;
  toolCalls?: {
    name: string;
    status: "pending" | "running" | "completed" | "error";
    args?: Record<string, unknown>;
  }[];
}

// ============================================================================
// Config Types
// ============================================================================

export interface ChatWindowConfig {
  agentId: string;
  companyId: string;
  theme: "light" | "dark" | "auto";
  primaryColor: string;
  accentColor?: string;
  userBubbleColor?: string;
  overrideAgentColor?: boolean;
  agentBubbleColor?: string;
  borderRadius?: number;
  position?: "bottom-right" | "bottom-left";
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  logoUrl?: string;
  welcomeMessage?: string;
  placeholderText?: string;
  showBranding?: boolean;
  enableFileUpload?: boolean;
  enableEmoji?: boolean;
  enableVoice?: boolean;
  enableTypingIndicator?: boolean;
  enableMarkdown?: boolean;
  launcherIcon?: string;
  buttonSize?: number;
  launcherIconBorderRadius?: number;
  launcherIconPulseGlow?: boolean;
  hideLauncherOnMobile?: boolean;
  isMultiAgent?: boolean;
  agentsList?: AgentInfo[];
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
  // Stream Display Options
  showAgentSwitchNotification?: boolean;
  showThinking?: boolean;
  showInstantUpdates?: boolean;
  // Multi-agent Display Options
  showAgentListOnTop?: boolean;
  agentListMinCards?: number;
  agentListingType?: "minimal" | "compact" | "standard" | "detailed";
  // Custom CSS
  customCss?: string;
  // Behavior
  autoOpen?: boolean;
  autoOpenDelay?: number;
  playSoundOnMessage?: boolean;
  persistConversation?: boolean;
  // Pre-chat requirements
  requireEmail?: boolean;
  requireName?: boolean;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface ChatWindowProps {
  /** When true, uses configJson instead of fetching from API */
  isDemo?: boolean;
  /** Widget configuration for demo/preview mode */
  configJson?: Partial<ChatWindowConfig>;
  /** Override agentId (used when not in demo mode) */
  agentId?: string;
  /** Override companyId (used when not in demo mode) */
  companyId?: string;
  /** Custom class name for the container */
  className?: string;
  /** Custom styles for the container */
  style?: CSSProperties;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate contrast text color (white or black) based on background luminance
 */
export function getContrastTextColor(bgColor: string): string {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
