import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { agents } from "./agents";
import { companies } from "./companies";
import { channelTypeEnum } from "./enums";
import { users } from "./users";

// Channel Configs Table (per-channel settings for agents)
export const channelConfigs = pgTable(
  "chatapp_channel_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Agent Reference
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),

    // Channel Info
    channel: channelTypeEnum("channel").notNull(),

    // Webhook Config
    webhookUrl: varchar("webhook_url", { length: 500 }),
    webhookSecret: varchar("webhook_secret", { length: 255 }),

    // Channel-specific credentials (encrypted)
    credentials: jsonb("credentials").default({}).notNull(),

    // Channel settings
    settings: jsonb("settings").default({}).notNull(),
    // e.g., { welcomeMessage: "...", offlineMessage: "...", autoReply: true }

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    lastConnectedAt: timestamp("last_connected_at"),
    lastErrorAt: timestamp("last_error_at"),
    lastError: text("last_error"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("channel_configs_company_idx").on(table.companyId),
    index("channel_configs_agent_idx").on(table.agentId),
    index("channel_configs_channel_idx").on(table.channel),
    index("channel_configs_agent_channel_idx").on(table.agentId, table.channel),
  ]
);

// API Keys Table (company API key management)
export const apiKeys = pgTable(
  "chatapp_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Creator
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    // Key Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // The actual key (hashed - only prefix stored for display)
    keyHash: varchar("key_hash", { length: 255 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(), // First 8 chars for display

    // Permissions/Scopes
    scopes: jsonb("scopes").default([]).notNull(), // ['agents:read', 'agents:write', 'conversations:read', etc.]

    // Rate limiting
    rateLimit: integer("rate_limit").default(1000).notNull(), // Requests per hour
    rateLimitWindow: integer("rate_limit_window").default(3600).notNull(), // Window in seconds

    // Usage tracking
    lastUsedAt: timestamp("last_used_at"),
    usageCount: integer("usage_count").default(0).notNull(),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    revokedBy: uuid("revoked_by").references(() => users.id),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("api_keys_company_idx").on(table.companyId),
    index("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_active_idx").on(table.isActive),
  ]
);

// Usage Records Table (detailed usage tracking for billing)
export const usageRecords = pgTable(
  "chatapp_usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Agent Reference (optional - for per-agent tracking)
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),

    // Usage Type
    usageType: varchar("usage_type", { length: 50 }).notNull(),
    // e.g., 'message', 'ai_tokens', 'storage', 'api_call', 'conversation'

    // Usage Amounts
    quantity: integer("quantity").notNull().default(1),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),

    // Model/Resource Info
    modelId: varchar("model_id", { length: 100 }),
    resourceId: uuid("resource_id"), // Reference to conversation, message, etc.
    resourceType: varchar("resource_type", { length: 50 }), // 'conversation', 'message', etc.

    // Billing Info
    unitCost: integer("unit_cost").default(0), // In cents
    totalCost: integer("total_cost").default(0), // In cents

    // Billing Period
    billingPeriodStart: timestamp("billing_period_start"),
    billingPeriodEnd: timestamp("billing_period_end"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("usage_records_company_idx").on(table.companyId),
    index("usage_records_agent_idx").on(table.agentId),
    index("usage_records_type_idx").on(table.usageType),
    index("usage_records_created_at_idx").on(table.createdAt),
    index("usage_records_billing_period_idx").on(
      table.companyId,
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
  ]
);

// Rate Limit Records Table (for tracking rate limit state)
export const rateLimitRecords = pgTable(
  "chatapp_rate_limit_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identifier (could be API key, IP, user, etc.)
    identifier: varchar("identifier", { length: 255 }).notNull(),
    identifierType: varchar("identifier_type", { length: 50 }).notNull(),
    // e.g., 'api_key', 'ip_address', 'user', 'company'

    // Optional references
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }),

    // Rate limit type
    limitType: varchar("limit_type", { length: 50 }).notNull(),
    // e.g., 'api_requests', 'messages', 'conversations'

    // Window tracking
    windowStart: timestamp("window_start").notNull(),
    windowEnd: timestamp("window_end").notNull(),

    // Counts
    requestCount: integer("request_count").default(0).notNull(),
    limitValue: integer("limit_value").notNull(),

    // Status
    isExceeded: boolean("is_exceeded").default(false).notNull(),
    lastRequestAt: timestamp("last_request_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("rate_limit_records_identifier_idx").on(table.identifier, table.identifierType),
    index("rate_limit_records_window_idx").on(table.windowStart, table.windowEnd),
    index("rate_limit_records_company_idx").on(table.companyId),
  ]
);

// Relations
export const channelConfigsRelations = relations(channelConfigs, ({ one }) => ({
  company: one(companies, {
    fields: [channelConfigs.companyId],
    references: [companies.id],
  }),
  agent: one(agents, {
    fields: [channelConfigs.agentId],
    references: [agents.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  company: one(companies, {
    fields: [apiKeys.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
    relationName: "api_key_creator",
  }),
  revoker: one(users, {
    fields: [apiKeys.revokedBy],
    references: [users.id],
    relationName: "api_key_revoker",
  }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  company: one(companies, {
    fields: [usageRecords.companyId],
    references: [companies.id],
  }),
  agent: one(agents, {
    fields: [usageRecords.agentId],
    references: [agents.id],
  }),
}));

export const rateLimitRecordsRelations = relations(rateLimitRecords, ({ one }) => ({
  company: one(companies, {
    fields: [rateLimitRecords.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [rateLimitRecords.userId],
    references: [users.id],
  }),
  apiKey: one(apiKeys, {
    fields: [rateLimitRecords.apiKeyId],
    references: [apiKeys.id],
  }),
}));

// Types
export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type NewChannelConfig = typeof channelConfigs.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type RateLimitRecord = typeof rateLimitRecords.$inferSelect;
export type NewRateLimitRecord = typeof rateLimitRecords.$inferInsert;
