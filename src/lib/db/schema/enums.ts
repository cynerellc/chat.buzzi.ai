import { pgEnum, pgSchema } from "drizzle-orm/pg-core";

// Create the chatapp schema for all tables
export const chatappSchema = pgSchema("chatapp");

// User/Role Enums - Only master_admin and user at the user level
export const userRoleEnum = pgEnum("user_role", [
  "chatapp.master_admin",
  "chatapp.user",
]);

// Company Permission Roles - Applied per-company via company_permissions table
export const companyPermissionRoleEnum = pgEnum("company_permission_role", [
  "chatapp.company_admin",
  "chatapp.support_agent",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "pending",
  "suspended",
]);

// Agent Enums
export const agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const agentTypeEnum = pgEnum("agent_type", [
  "support",
  "sales",
  "general",
  "custom",
]);

// Conversation Enums
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "waiting_human",
  "with_human",
  "resolved",
  "abandoned",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
  "human_agent",
  "tool",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "file",
  "audio",
  "system_event",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "web",
  "whatsapp",
  "telegram",
  "messenger",
  "instagram",
  "slack",
  "teams",
  "custom",
]);

// Subscription Enums
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trial",
  "active",
  "past_due",
  "grace_period",
  "expired",
  "cancelled",
]);

export const billingCycleEnum = pgEnum("billing_cycle", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

// Knowledge Enums
export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", [
  "file",
  "url",
  "text",
]);

export const knowledgeSourceStatusEnum = pgEnum("knowledge_source_status", [
  "pending",
  "processing",
  "indexed",
  "failed",
]);

// Integration Enums
export const integrationTypeEnum = pgEnum("integration_type", [
  "slack",
  "zapier",
  "salesforce",
  "hubspot",
  "webhook",
  "custom",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "active",
  "inactive",
  "error",
]);

// Invitation Enums
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

// Escalation Enums
export const escalationStatusEnum = pgEnum("escalation_status", [
  "pending",
  "assigned",
  "in_progress",
  "resolved",
  "returned_to_ai",
  "abandoned",
]);

export const escalationPriorityEnum = pgEnum("escalation_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// Support Agent Status
export const supportAgentStatusEnum = pgEnum("support_agent_status", [
  "online",
  "busy",
  "away",
  "offline",
]);

// Resolution Type
export const resolutionTypeEnum = pgEnum("resolution_type", [
  "ai",
  "human",
  "abandoned",
  "escalated",
]);

// Agent Package Enums
export const packageTypeEnum = pgEnum("package_type", [
  "single_agent",
  "multi_agent",
]);

export const packageAgentTypeEnum = pgEnum("package_agent_type", [
  "worker",
  "supervisor",
]);

// Package Variable Enums
export const variableTypeEnum = pgEnum("variable_type", [
  "variable",
  "secured_variable",
]);

export const variableDataTypeEnum = pgEnum("variable_data_type", [
  "string",
  "number",
  "boolean",
  "json",
]);

// AI Model Provider Enum
export const aiModelProviderEnum = pgEnum("ai_model_provider", [
  "openai",
  "google",
  "anthropic",
]);

// Call Feature Enums
export const callSourceEnum = pgEnum("call_source", [
  "web",
  "whatsapp",
  "twilio",
  "vonage",
]);

export const callStatusEnum = pgEnum("call_status", [
  "pending",
  "connecting",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "no_answer",
  "busy",
  "cancelled",
  "timeout",
]);

export const callAiProviderEnum = pgEnum("call_ai_provider", [
  "OPENAI",
  "GEMINI",
]);

export const integrationAccountProviderEnum = pgEnum(
  "integration_account_provider",
  ["whatsapp", "twilio", "vonage", "bandwidth"]
);

export const callTranscriptRoleEnum = pgEnum("call_transcript_role", [
  "user",
  "assistant",
  "system",
]);

// AI Model Type (for filtering call-capable models)
export const aiModelTypeEnum = pgEnum("ai_model_type", [
  "chat",
  "call",
  "both",
]);
