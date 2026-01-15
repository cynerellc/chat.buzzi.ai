import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { chatbots } from "./chatbots";
import { companies } from "./companies";
import { conversations, endUsers } from "./conversations";
import {
  callAiProviderEnum,
  callSourceEnum,
  callStatusEnum,
  callTranscriptRoleEnum,
  chatappSchema,
  integrationAccountProviderEnum,
} from "./enums";

// Integration Account Settings (stored as JSONB)
export interface IntegrationAccountSettings {
  phone_number?: string;
  webhook_secret?: string;
  webhook_url?: string;
  default_ai_provider?: string;
  recording_enabled?: boolean;
  voice_config?: Record<string, unknown>;
  [key: string]: unknown;
}

// Integration Accounts Table (Twilio, WhatsApp, Vonage, etc.)
export const integrationAccounts = chatappSchema.table(
  "integration_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Provider Info
    provider: integrationAccountProviderEnum("provider").notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),

    // Status
    isVerified: boolean("is_verified").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    // Credentials (encrypted in application layer)
    credentials: jsonb("credentials").default({}).notNull(),
    // e.g., { account_sid, auth_token, api_key, access_token, etc. }

    // Settings (includes phone_number, webhook_secret, and other config)
    settings: jsonb("settings").$type<IntegrationAccountSettings>().default({}).notNull(),
    // e.g., { phone_number, webhook_secret, webhook_url, default_ai_provider, recording_enabled, voice_config }

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"), // Soft delete
  },
  (table) => [
    index("integration_accounts_company_idx").on(table.companyId),
    index("integration_accounts_provider_idx").on(table.provider),
    index("integration_accounts_active_idx").on(table.isActive),
  ]
);

// Calls Table (Voice Call Sessions)
export const calls = chatappSchema.table(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    conversationId: uuid("conversation_id").references(() => conversations.id), // Optional: Link to conversation if part of omnichannel
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbots.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    endUserId: uuid("end_user_id").references(() => endUsers.id),

    // Call Source & Provider
    source: callSourceEnum("source").notNull(),
    aiProvider: callAiProviderEnum("ai_provider").notNull(),
    status: callStatusEnum("status").default("pending").notNull(),

    // Integration Account (if using Twilio/WhatsApp/Vonage)
    integrationAccountId: uuid("integration_account_id").references(
      () => integrationAccounts.id
    ),

    // External References (provider-specific IDs)
    externalRefs: jsonb("external_refs").default({}).notNull(),
    // e.g., { call_sid (Twilio), call_id (WhatsApp), session_id (Vonage) }

    // Caller Info
    callerInfo: jsonb("caller_info").default({}),
    // e.g., { from_number, to_number, caller_name, caller_email, caller_company }

    // Call Timing
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    answeredAt: timestamp("answered_at"),
    durationSeconds: integer("duration_seconds"), // Total call duration

    // Recording
    recordingUrl: varchar("recording_url", { length: 1000 }),
    recordingStoragePath: varchar("recording_storage_path", { length: 500 }),
    recordingDurationSeconds: integer("recording_duration_seconds"),

    // Call Metrics
    totalTurns: integer("total_turns").default(0).notNull(), // Number of back-and-forth exchanges
    interruptionCount: integer("interruption_count").default(0).notNull(),

    // Voice Configuration (snapshot of config at call time)
    voiceConfig: jsonb("voice_config").default({}),
    // e.g., { voice: 'alloy', vad_threshold: 0.5, silence_duration_ms: 700 }

    // Call End Info
    endReason: varchar("end_reason", { length: 100 }),
    // e.g., 'user_hangup', 'timeout', 'agent_ended', 'error', 'completed'

    // Summary & Analysis
    summary: text("summary"), // AI-generated call summary
    sentimentScore: decimal("sentiment_score", {
      precision: 5,
      scale: 2,
    }), // -100 to +100

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("calls_company_idx").on(table.companyId),
    index("calls_chatbot_idx").on(table.chatbotId),
    index("calls_end_user_idx").on(table.endUserId),
    index("calls_status_idx").on(table.status),
    index("calls_source_idx").on(table.source),
    index("calls_created_at_idx").on(table.createdAt),
    index("calls_integration_account_idx").on(table.integrationAccountId),
  ]
);

// Call Transcripts Table (Real-time transcription during call)
export const callTranscripts = chatappSchema.table(
  "call_transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Call Reference
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),

    // Transcript Info
    role: callTranscriptRoleEnum("role").notNull(),
    content: text("content").notNull(),

    // Timing (relative to call start)
    timestampMs: integer("timestamp_ms").notNull(), // Milliseconds from call start
    durationMs: integer("duration_ms"), // Duration of this speech segment

    // Confidence & Quality
    isFinal: boolean("is_final").default(true).notNull(), // Is this the final transcript or interim?
    confidence: decimal("confidence", { precision: 5, scale: 4 }), // 0.0 to 1.0

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("call_transcripts_call_idx").on(table.callId),
    index("call_transcripts_timestamp_idx").on(table.callId, table.timestampMs),
  ]
);

// Drizzle Relations
export const integrationAccountsRelations = relations(
  integrationAccounts,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [integrationAccounts.companyId],
      references: [companies.id],
    }),
    calls: many(calls),
  })
);

export const callsRelations = relations(calls, ({ one, many }) => ({
  company: one(companies, {
    fields: [calls.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [calls.chatbotId],
    references: [chatbots.id],
  }),
  endUser: one(endUsers, {
    fields: [calls.endUserId],
    references: [endUsers.id],
  }),
  conversation: one(conversations, {
    fields: [calls.conversationId],
    references: [conversations.id],
  }),
  integrationAccount: one(integrationAccounts, {
    fields: [calls.integrationAccountId],
    references: [integrationAccounts.id],
  }),
  transcripts: many(callTranscripts),
}));

export const callTranscriptsRelations = relations(
  callTranscripts,
  ({ one }) => ({
    call: one(calls, {
      fields: [callTranscripts.callId],
      references: [calls.id],
    }),
  })
);

// TypeScript Types
export type IntegrationAccount = typeof integrationAccounts.$inferSelect;
export type NewIntegrationAccount = typeof integrationAccounts.$inferInsert;

export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;

export type CallTranscript = typeof callTranscripts.$inferSelect;
export type NewCallTranscript = typeof callTranscripts.$inferInsert;
