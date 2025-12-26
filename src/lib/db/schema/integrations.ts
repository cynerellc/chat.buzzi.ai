import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { chatappSchema, integrationStatusEnum, integrationTypeEnum, invitationStatusEnum } from "./enums";
import { users } from "./users";

// Integrations Table
export const integrations = chatappSchema.table(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Integration Info
    type: integrationTypeEnum("type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: integrationStatusEnum("status").default("inactive").notNull(),

    // Configuration (encrypted sensitive data)
    config: jsonb("config").default({}).notNull(),

    // OAuth tokens (if applicable)
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),

    // Webhook URL (for incoming webhooks)
    webhookUrl: varchar("webhook_url", { length: 500 }),
    webhookSecret: varchar("webhook_secret", { length: 255 }),

    // Error tracking
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at"),
    errorCount: jsonb("error_count").default(0),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("integrations_company_idx").on(table.companyId),
    index("integrations_type_idx").on(table.type),
    index("integrations_status_idx").on(table.status),
  ]
);

// Webhooks Table (outgoing webhooks)
export const webhooks = chatappSchema.table(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Webhook Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    url: varchar("url", { length: 500 }).notNull(),
    secret: varchar("secret", { length: 255 }),

    // Events to trigger
    events: jsonb("events").default([]).notNull(), // ['conversation.created', 'message.created', etc.]

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    // Headers to send
    headers: jsonb("headers").default({}),

    // Retry config
    maxRetries: jsonb("max_retries").default(3),
    retryDelaySeconds: jsonb("retry_delay_seconds").default(60),

    // Stats
    totalDeliveries: jsonb("total_deliveries").default(0),
    successfulDeliveries: jsonb("successful_deliveries").default(0),
    failedDeliveries: jsonb("failed_deliveries").default(0),
    lastDeliveryAt: timestamp("last_delivery_at"),
    lastDeliveryStatus: varchar("last_delivery_status", { length: 50 }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhooks_company_idx").on(table.companyId),
    index("webhooks_active_idx").on(table.isActive),
  ]
);

// Webhook Deliveries Table (delivery history)
export const webhookDeliveries = chatappSchema.table(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Webhook Reference
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),

    // Event Info
    event: varchar("event", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),

    // Delivery Status
    status: varchar("status", { length: 50 }).notNull(), // pending, success, failed
    statusCode: jsonb("status_code"),
    responseBody: text("response_body"),
    errorMessage: text("error_message"),

    // Retry Info
    attempt: jsonb("attempt").default(1).notNull(),
    nextRetryAt: timestamp("next_retry_at"),

    // Timing
    deliveredAt: timestamp("delivered_at"),
    durationMs: jsonb("duration_ms"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_deliveries_webhook_idx").on(table.webhookId),
    index("webhook_deliveries_status_idx").on(table.status),
    index("webhook_deliveries_created_at_idx").on(table.createdAt),
  ]
);

// Team Invitations Table
export const invitations = chatappSchema.table(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Invitation Details
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),

    // Token
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),

    // Inviter
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),

    // Acceptance
    acceptedAt: timestamp("accepted_at"),
    acceptedUserId: uuid("accepted_user_id").references(() => users.id),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invitations_company_idx").on(table.companyId),
    index("invitations_email_idx").on(table.email),
    index("invitations_token_idx").on(table.token),
    index("invitations_status_idx").on(table.status),
  ]
);

// Audit Log Table
export const auditLogs = chatappSchema.table(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference (nullable for master admin actions)
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),

    // Actor
    userId: uuid("user_id").references(() => users.id),
    userEmail: varchar("user_email", { length: 255 }),

    // Action
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    resourceId: uuid("resource_id"),

    // Details
    details: jsonb("details").default({}),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),

    // Request Info
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Status
    success: boolean("success").default(true),
    errorMessage: text("error_message"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_company_idx").on(table.companyId),
    index("audit_logs_user_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_resource_idx").on(table.resource, table.resourceId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

// Relations
export const integrationsRelations = relations(integrations, ({ one }) => ({
  company: one(companies, {
    fields: [integrations.companyId],
    references: [companies.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  company: one(companies, {
    fields: [webhooks.companyId],
    references: [companies.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  company: one(companies, {
    fields: [invitations.companyId],
    references: [companies.id],
  }),
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  company: one(companies, {
    fields: [auditLogs.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Types
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
