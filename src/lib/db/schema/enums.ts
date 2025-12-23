import { pgEnum } from "drizzle-orm/pg-core";

// User/Role Enums
export const userRoleEnum = pgEnum("user_role", [
  "master_admin",
  "company_admin",
  "support_agent",
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
