// Application Constants

export const APP_NAME = "Chat.buzzi.ai";
export const APP_DESCRIPTION =
  "Multi-Tenant AI Customer Support Platform";
export const APP_DOMAIN = "chat.buzzi.ai";

// Route Groups
export const ROUTES = {
  // Auth routes
  auth: {
    login: "/login",
    register: "/register",
    forgotPassword: "/forgot-password",
    acceptInvitation: "/accept-invitation",
  },
  // Master Admin routes
  masterAdmin: {
    dashboard: "/dashboard",
    companies: "/companies",
    plans: "/plans",
    packages: "/packages",
    analytics: "/analytics",
    auditLogs: "/audit-logs",
    settings: "/settings",
  },
  // Company Admin routes
  companyAdmin: {
    dashboard: "/dashboard",
    agents: "/agents",
    knowledge: "/knowledge",
    conversations: "/conversations",
    team: "/team",
    analytics: "/analytics",
    widget: "/widget",
    integrations: "/integrations",
    settings: "/settings",
    billing: "/billing",
  },
  // Support Agent routes
  supportAgent: {
    inbox: "/inbox",
    customers: "/customers",
    responses: "/responses",
    settings: "/settings",
  },
} as const;

// User Roles
export const USER_ROLES = {
  MASTER_ADMIN: "master_admin",
  COMPANY_ADMIN: "company_admin",
  SUPPORT_AGENT: "support_agent",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Agent Status
export const AGENT_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

// Conversation Status
export const CONVERSATION_STATUS = {
  ACTIVE: "active",
  WAITING_HUMAN: "waiting_human",
  WITH_HUMAN: "with_human",
  RESOLVED: "resolved",
  ABANDONED: "abandoned",
} as const;

export type ConversationStatus =
  (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

// Channel Types
export const CHANNEL_TYPES = {
  WEB: "web",
  WHATSAPP: "whatsapp",
  TELEGRAM: "telegram",
  MESSENGER: "messenger",
  INSTAGRAM: "instagram",
  SLACK: "slack",
  TEAMS: "teams",
  CUSTOM: "custom",
} as const;

export type ChannelType = (typeof CHANNEL_TYPES)[keyof typeof CHANNEL_TYPES];

// Subscription Status
export const SUBSCRIPTION_STATUS = {
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  GRACE_PERIOD: "grace_period",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

// File Status
export const FILE_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  INDEXED: "indexed",
  FAILED: "failed",
} as const;

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

// Escalation Priority
export const ESCALATION_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type EscalationPriority =
  (typeof ESCALATION_PRIORITY)[keyof typeof ESCALATION_PRIORITY];

// Support Agent Status
export const SUPPORT_AGENT_STATUS = {
  ONLINE: "online",
  BUSY: "busy",
  AWAY: "away",
  OFFLINE: "offline",
} as const;

export type SupportAgentStatus =
  (typeof SUPPORT_AGENT_STATUS)[keyof typeof SUPPORT_AGENT_STATUS];

// Message Roles
export const MESSAGE_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
  HUMAN_AGENT: "human_agent",
  TOOL: "tool",
} as const;

export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Date formats
export const DATE_FORMATS = {
  DISPLAY: "MMM d, yyyy",
  DISPLAY_TIME: "MMM d, yyyy h:mm a",
  INPUT: "yyyy-MM-dd",
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
} as const;
