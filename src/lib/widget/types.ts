/**
 * Chat Widget Types
 *
 * Type definitions for the embeddable chat widget.
 */

// ============================================================================
// Widget Configuration
// ============================================================================

export interface WidgetConfig {
  // Required
  agentId: string;
  companyId: string;

  // Appearance
  theme?: "light" | "dark" | "auto";
  position?: "bottom-right" | "bottom-left";
  primaryColor?: string;
  borderRadius?: number;
  width?: number;
  height?: number;

  // Branding
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  welcomeMessage?: string;
  placeholderText?: string;
  showBranding?: boolean;

  // Behavior
  autoOpen?: boolean;
  autoOpenDelay?: number;
  openOnLoad?: boolean;
  closeOnEscape?: boolean;
  soundEnabled?: boolean;

  // Features
  enableVoice?: boolean;
  enableFileUpload?: boolean;
  enableEmoji?: boolean;
  enableMarkdown?: boolean;
  enableTypingIndicator?: boolean;

  // Localization
  locale?: string;
  strings?: Partial<WidgetStrings>;

  // Customer context (optional)
  customer?: CustomerInfo;

  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: WidgetMessage) => void;
  onError?: (error: Error) => void;
}

export interface CustomerInfo {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface WidgetStrings {
  inputPlaceholder: string;
  sendButton: string;
  welcomeMessage: string;
  typingIndicator: string;
  connectionError: string;
  reconnecting: string;
  sendError: string;
  offlineMessage: string;
  poweredBy: string;
  close: string;
  minimize: string;
  openChat: string;
  fileUpload: string;
  voiceInput: string;
  emoji: string;
}

// ============================================================================
// Session & Messages
// ============================================================================

export interface WidgetSession {
  sessionId: string;
  conversationId: string;
  endUserId: string;
  agentId: string;
  companyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface WidgetMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}

export interface MessageAttachment {
  id: string;
  type: "image" | "document" | "audio" | "video";
  name: string;
  url?: string;
  size?: number;
  mimeType?: string;
  analysis?: {
    description?: string;
    extractedText?: string;
    summary?: string;
  };
}

// ============================================================================
// Widget Events
// ============================================================================

export type WidgetEventType =
  | "open"
  | "close"
  | "minimize"
  | "message:sent"
  | "message:received"
  | "message:error"
  | "typing:start"
  | "typing:stop"
  | "session:start"
  | "session:end"
  | "handover:started"
  | "handover:ended"
  | "connection:online"
  | "connection:offline"
  | "connection:reconnecting"
  | "error";

export interface WidgetEvent<T = unknown> {
  type: WidgetEventType;
  data: T;
  timestamp: Date;
}

export type WidgetEventCallback<T = unknown> = (event: WidgetEvent<T>) => void;

// ============================================================================
// Widget API (Public Interface)
// ============================================================================

export interface ChatWidgetAPI {
  // Lifecycle
  open(): void;
  close(): void;
  toggle(): void;
  minimize(): void;
  destroy(): void;

  // Messaging
  sendMessage(content: string, attachments?: File[]): Promise<void>;
  clearHistory(): void;

  // Customer context
  setCustomer(customer: CustomerInfo): void;
  setMetadata(key: string, value: unknown): void;

  // Events
  on<T = unknown>(event: WidgetEventType, callback: WidgetEventCallback<T>): void;
  off<T = unknown>(event: WidgetEventType, callback: WidgetEventCallback<T>): void;

  // State
  isOpen(): boolean;
  isMinimized(): boolean;
  getConversationId(): string | null;
  getSession(): WidgetSession | null;
}

// ============================================================================
// Widget State
// ============================================================================

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  isTyping: boolean;
  session: WidgetSession | null;
  messages: WidgetMessage[];
  pendingMessage: string | null;
  error: string | null;
}

// ============================================================================
// Server Types
// ============================================================================

export interface CreateSessionRequest {
  agentId: string;
  companyId: string;
  customer?: CustomerInfo;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  conversationId: string;
  endUserId: string;
  expiresAt: string;
}

export interface SendMessageRequest {
  content: string;
  attachments?: {
    id: string;
    type: string;
    name: string;
    url: string;
  }[];
}

export interface SendMessageResponse {
  messageId: string;
  conversationId: string;
  timestamp: string;
}

// ============================================================================
// Widget Configuration (Server-side stored)
// ============================================================================

export interface StoredWidgetConfig {
  id: string;
  companyId: string;
  agentId: string;

  // Appearance
  theme: "light" | "dark" | "auto";
  position: "bottom-right" | "bottom-left";
  primaryColor: string;
  borderRadius: number;

  // Branding
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  welcomeMessage?: string;
  placeholderText: string;
  showBranding: boolean;

  // Behavior
  autoOpen: boolean;
  autoOpenDelay: number;
  closeOnEscape: boolean;
  soundEnabled: boolean;

  // Features
  enableVoice: boolean;
  enableFileUpload: boolean;
  enableEmoji: boolean;
  enableMarkdown: boolean;
  enableTypingIndicator: boolean;

  // Security
  allowedDomains: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
