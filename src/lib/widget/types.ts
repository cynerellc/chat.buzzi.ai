/**
 * Widget Configuration JSON Types
 *
 * These types define the structure of the pre-generated widget config JSON
 * stored in Supabase Storage for fast widget initialization.
 */

// Pre-chat form field definition
export interface PreChatFormField {
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "select" | "textarea";
  required: boolean;
  options?: string[]; // For select type
  placeholder?: string;
}

// Agent info for multi-agent widgets
export interface WidgetAgentInfo {
  id: string; // agent_identifier
  name: string;
  designation?: string;
  avatarUrl?: string;
  color?: string; // Agent color for chat bubbles and avatar ring
  type: "worker" | "supervisor";
}

/**
 * Main widget configuration JSON structure
 * This is the format stored in Supabase Storage
 */
export interface WidgetConfigJson {
  // Metadata
  version: string; // "1.0.0" for compatibility
  generatedAt: string; // ISO timestamp

  // Chatbot info
  chatbot: {
    id: string;
    name: string;
    type: "single_agent" | "multi_agent";
    companyId: string;
  };

  // Agent list (for multi-agent, includes all agents; for single-agent, just one)
  agents: WidgetAgentInfo[];

  // Appearance settings
  appearance: {
    theme: "light" | "dark" | "auto";
    position: "bottom-right" | "bottom-left";
    placement: "above-launcher" | "center-screen";
    primaryColor: string;
    accentColor: string;
    userBubbleColor?: string; // User message bubble color (defaults to primaryColor)
    overrideAgentColor: boolean; // When true, use agentBubbleColor instead of individual agent colors
    agentBubbleColor?: string; // Agent message bubble color (when override is enabled)
    borderRadius: number;
    buttonSize: number;
    launcherIcon: string;
    launcherText?: string;
    launcherIconBorderRadius: number; // percentage (0-50)
    launcherIconPulseGlow: boolean;
    showLauncherText: boolean;
    launcherTextBackgroundColor: string;
    launcherTextColor: string;
    zIndex: number;
  };

  // Branding settings
  branding: {
    title: string;
    subtitle?: string;
    welcomeMessage: string;
    logoUrl?: string;
    avatarUrl?: string;
    showBranding: boolean;
  };

  // Behavior settings
  behavior: {
    autoOpen: boolean;
    autoOpenDelay: number;
    playSoundOnMessage: boolean;
    persistConversation: boolean;
    hideLauncherOnMobile: boolean;
  };

  // Feature flags
  features: {
    enableFileUpload: boolean;
    enableVoiceMessages: boolean;
    enableFeedback: boolean;
    requireEmail: boolean;
    requireName: boolean;
  };

  // Stream display options (new)
  streamDisplay: {
    showAgentSwitchNotification: boolean;
    showThinking: boolean;
    showInstantUpdates: boolean;
  };

  // Multi-agent display options (optional, only for multi-agent chatbots)
  multiAgent?: {
    showAgentListOnTop: boolean;
    agentListMinCards: number;
    agentListingType: "minimal" | "compact" | "standard" | "detailed";
  };

  // Pre-chat form configuration
  preChatForm: {
    enabled: boolean;
    fields: PreChatFormField[];
  };

  // Custom CSS (optional)
  customCss?: string;

  // Security settings
  security: {
    allowedDomains: string[];
  };
}

// Default values for widget config
export const WIDGET_CONFIG_DEFAULTS = {
  version: "1.0.0",
  appearance: {
    theme: "light" as const,
    position: "bottom-right" as const,
    placement: "above-launcher" as const,
    primaryColor: "#6437F3",
    accentColor: "#2b3dd8",
    userBubbleColor: undefined as string | undefined, // Defaults to primaryColor when undefined
    overrideAgentColor: false,
    agentBubbleColor: "#FFFFFF", // White for light theme
    borderRadius: 16,
    buttonSize: 60,
    launcherIcon: "chat",
    launcherIconBorderRadius: 50,
    launcherIconPulseGlow: false,
    showLauncherText: false,
    launcherTextBackgroundColor: "#ffffff",
    launcherTextColor: "#000000",
    zIndex: 9999,
  },
  branding: {
    title: "Chat with us",
    welcomeMessage: "Hi there! How can we help you today?",
    showBranding: true,
  },
  behavior: {
    autoOpen: false,
    autoOpenDelay: 5,
    playSoundOnMessage: true,
    persistConversation: true,
    hideLauncherOnMobile: false,
  },
  features: {
    enableFileUpload: false,
    enableVoiceMessages: false,
    enableFeedback: true,
    requireEmail: false,
    requireName: false,
  },
  streamDisplay: {
    showAgentSwitchNotification: true,
    showThinking: false,
    showInstantUpdates: true,
  },
  multiAgent: {
    showAgentListOnTop: true,
    agentListMinCards: 3,
    agentListingType: "detailed" as const,
  },
  preChatForm: {
    enabled: false,
    fields: [],
  },
  security: {
    allowedDomains: [],
  },
};

// Request/Response types for API endpoints
export interface WidgetConfigUrlResponse {
  configUrl: string;
  chatbotId: string;
  generatedAt: string;
}

export interface GenerateWidgetConfigResult {
  success: boolean;
  configUrl?: string;
  storagePath?: string;
  error?: string;
}

// ============================================================================
// Widget Embed Script Types (for embed.ts and widget iframe communication)
// ============================================================================

/**
 * Widget configuration for the embed script
 * This is what developers pass to initialize the widget
 */
export interface WidgetConfig {
  // Required
  agentId: string;
  companyId: string;

  // Appearance
  theme?: "light" | "dark" | "auto";
  position?: "bottom-right" | "bottom-left";
  primaryColor?: string;
  borderRadius?: number;

  // Behavior
  autoOpen?: boolean;
  autoOpenDelay?: number;
  showBranding?: boolean;
  closeOnEscape?: boolean;

  // Features
  enableFileUpload?: boolean;
  enableEmoji?: boolean;
  enableVoice?: boolean;
  enableMarkdown?: boolean;
  enableTypingIndicator?: boolean;

  // Customer info (optional)
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
  };

  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: unknown) => void;
  onError?: (error: Error) => void;

  // Custom strings
  strings?: {
    openChat?: string;
    closeChat?: string;
    placeholder?: string;
  };
}

/**
 * Widget session info
 */
export interface WidgetSession {
  sessionId: string;
  conversationId: string;
  endUserId: string;
  expiresAt: string;
}

/**
 * Widget event types
 */
export type WidgetEventType =
  | "open"
  | "close"
  | "minimize"
  | "session:start"
  | "message:sent"
  | "message:received"
  | "error";

/**
 * Widget event callback
 */
export type WidgetEventCallback<T = unknown> = (event: {
  type: WidgetEventType;
  data: T;
  timestamp: Date;
}) => void;

/**
 * Chat widget public API
 */
export interface ChatWidgetAPI {
  open(): void;
  close(): void;
  toggle(): void;
  minimize(): void;
  destroy(): void;
  sendMessage(content: string, attachments?: File[]): Promise<void>;
  clearHistory(): void;
  setCustomer(customer: WidgetConfig["customer"]): void;
  setMetadata(key: string, value: unknown): void;
  on<T = unknown>(event: WidgetEventType, callback: WidgetEventCallback<T>): void;
  off<T = unknown>(event: WidgetEventType, callback: WidgetEventCallback<T>): void;
  isOpen(): boolean;
  isMinimized(): boolean;
  getConversationId(): string | null;
  getSession(): WidgetSession | null;
}

// ============================================================================
// Widget API Request/Response Types
// ============================================================================

/**
 * Create session request
 */
export interface CreateSessionRequest {
  agentId: string;
  companyId: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
  };
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
}

/**
 * Create session response
 */
export interface CreateSessionResponse {
  sessionId: string;
  conversationId: string;
  endUserId: string;
  expiresAt: string;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  content: string;
  attachments?: Array<{
    name: string;
    type: string;
    url: string;
    size: number;
  }>;
}
