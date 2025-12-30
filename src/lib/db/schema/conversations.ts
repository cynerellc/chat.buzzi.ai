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

import { chatbots } from "./chatbots";
import { companies } from "./companies";
import {
  channelTypeEnum,
  chatappSchema,
  conversationStatusEnum,
  escalationPriorityEnum,
  escalationStatusEnum,
  messageRoleEnum,
  messageTypeEnum,
  resolutionTypeEnum,
} from "./enums";
import { users } from "./users";

// End Users Table (visitors/customers who chat)
export const endUsers = chatappSchema.table(
  "end_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Identification
    externalId: varchar("external_id", { length: 255 }), // For integrations
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    name: varchar("name", { length: 255 }),

    // Channel Info
    channel: channelTypeEnum("channel").default("web").notNull(),
    channelUserId: varchar("channel_user_id", { length: 255 }), // WhatsApp number, Telegram ID, etc.

    // Profile
    avatarUrl: varchar("avatar_url", { length: 500 }),
    metadata: jsonb("metadata").default({}), // Custom attributes

    // Browser/Device Info
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    location: jsonb("location").default({}), // { country, city, timezone }

    // Analytics
    totalConversations: integer("total_conversations").default(0).notNull(),
    lastSeenAt: timestamp("last_seen_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("end_users_company_idx").on(table.companyId),
    index("end_users_email_idx").on(table.email),
    index("end_users_external_id_idx").on(table.companyId, table.externalId),
    index("end_users_channel_user_idx").on(table.channel, table.channelUserId),
  ]
);

// Conversations Table
export const conversations = chatappSchema.table(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbots.id),
    endUserId: uuid("end_user_id")
      .notNull()
      .references(() => endUsers.id),

    // Conversation Info
    channel: channelTypeEnum("channel").default("web").notNull(),
    status: conversationStatusEnum("status").default("active").notNull(),
    subject: varchar("subject", { length: 255 }),

    // Current handler (null = AI, userId = human agent)
    assignedUserId: uuid("assigned_user_id").references(() => users.id),

    // Message counts
    messageCount: integer("message_count").default(0).notNull(),
    userMessageCount: integer("user_message_count").default(0).notNull(),
    assistantMessageCount: integer("assistant_message_count").default(0).notNull(),

    // Resolution
    resolutionType: resolutionTypeEnum("resolution_type"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id),

    // Sentiment Analysis
    sentiment: integer("sentiment"), // -100 to 100
    sentimentHistory: jsonb("sentiment_history").default([]),

    // Satisfaction
    satisfactionRating: integer("satisfaction_rating"), // 1-5
    satisfactionFeedback: text("satisfaction_feedback"),

    // Session Info
    sessionId: varchar("session_id", { length: 255 }),
    pageUrl: varchar("page_url", { length: 500 }),
    referrer: varchar("referrer", { length: 500 }),

    // Metadata
    metadata: jsonb("metadata").default({}),
    tags: jsonb("tags").default([]),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at"),
  },
  (table) => [
    index("conversations_company_idx").on(table.companyId),
    index("conversations_chatbot_idx").on(table.chatbotId),
    index("conversations_end_user_idx").on(table.endUserId),
    index("conversations_status_idx").on(table.status),
    index("conversations_assigned_user_idx").on(table.assignedUserId),
    index("conversations_created_at_idx").on(table.createdAt),
  ]
);

// Messages Table
export const messages = chatappSchema.table(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Conversation Reference
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),

    // Message Info
    role: messageRoleEnum("role").notNull(),
    type: messageTypeEnum("type").default("text").notNull(),
    content: text("content").notNull(),

    // For human_agent messages
    userId: uuid("user_id").references(() => users.id),

    // Attachments
    attachments: jsonb("attachments").default([]),

    // AI Specific
    modelId: varchar("model_id", { length: 100 }),
    tokenCount: integer("token_count"),
    processingTimeMs: integer("processing_time_ms"),

    // Tool calls (for AI)
    toolCalls: jsonb("tool_calls").default([]),
    toolResults: jsonb("tool_results").default([]),

    // Knowledge sources used
    sourceChunkIds: jsonb("source_chunk_ids").default([]),

    // Read status
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId),
    index("messages_role_idx").on(table.role),
    index("messages_created_at_idx").on(table.createdAt),
  ]
);

// Escalations Table
export const escalations = chatappSchema.table(
  "escalations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Conversation Reference
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),

    // Status
    status: escalationStatusEnum("status").default("pending").notNull(),
    priority: escalationPriorityEnum("priority").default("medium").notNull(),

    // Assignment
    assignedUserId: uuid("assigned_user_id").references(() => users.id),
    assignedAt: timestamp("assigned_at"),

    // Reason for escalation
    reason: text("reason"),
    triggerType: varchar("trigger_type", { length: 50 }), // manual, sentiment, keyword, turns

    // Resolution
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolution: text("resolution"),

    // Returned to AI
    returnedToAi: boolean("returned_to_ai").default(false).notNull(),
    returnedAt: timestamp("returned_at"),

    // Metrics (in seconds)
    waitTime: integer("wait_time"), // Time from creation to assignment
    handleTime: integer("handle_time"), // Time from assignment to resolution

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("escalations_conversation_idx").on(table.conversationId),
    index("escalations_status_idx").on(table.status),
    index("escalations_assigned_user_idx").on(table.assignedUserId),
    index("escalations_priority_idx").on(table.priority),
  ]
);

// Canned Responses Table (quick reply templates for support agents)
export const cannedResponses = chatappSchema.table(
  "canned_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Optional user ownership (personal vs shared)
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

    // Response Info
    name: varchar("name", { length: 255 }).notNull(),
    shortcut: varchar("shortcut", { length: 50 }), // e.g., "/thanks"
    content: text("content").notNull(),
    category: varchar("category", { length: 100 }),

    // Metadata
    tags: jsonb("tags").default([]),
    usageCount: integer("usage_count").default(0).notNull(),
    isShared: boolean("is_shared").default(true).notNull(), // Available to all team members

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("canned_responses_company_idx").on(table.companyId),
    index("canned_responses_user_idx").on(table.userId),
    index("canned_responses_shortcut_idx").on(table.companyId, table.shortcut),
  ]
);

// Conversation Notes Table (internal notes from support agents)
export const conversationNotes = chatappSchema.table(
  "conversation_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Conversation Reference
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),

    // Author
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    // Note Content
    content: text("content").notNull(),

    // Note Type (general, escalation, resolution, follow-up)
    noteType: varchar("note_type", { length: 50 }).default("general").notNull(),

    // Visibility (team-visible or private)
    isPrivate: boolean("is_private").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("conversation_notes_conversation_idx").on(table.conversationId),
    index("conversation_notes_user_idx").on(table.userId),
    index("conversation_notes_type_idx").on(table.noteType),
  ]
);

// Support Agent Status Table
export const supportAgentStatus = chatappSchema.table(
  "support_agent_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // User Reference
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),

    // Status
    status: varchar("status", { length: 20 }).default("offline").notNull(),

    // Capacity
    maxConcurrentChats: integer("max_concurrent_chats").default(5).notNull(),
    currentChatCount: integer("current_chat_count").default(0).notNull(),

    // Timestamps
    lastStatusChange: timestamp("last_status_change").defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at"),
  },
  (table) => [index("support_agent_status_user_idx").on(table.userId)]
);

// Relations
export const endUsersRelations = relations(endUsers, ({ one, many }) => ({
  company: one(companies, {
    fields: [endUsers.companyId],
    references: [companies.id],
  }),
  conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  company: one(companies, {
    fields: [conversations.companyId],
    references: [companies.id],
  }),
  chatbot: one(chatbots, {
    fields: [conversations.chatbotId],
    references: [chatbots.id],
  }),
  endUser: one(endUsers, {
    fields: [conversations.endUserId],
    references: [endUsers.id],
  }),
  assignedUser: one(users, {
    fields: [conversations.assignedUserId],
    references: [users.id],
  }),
  messages: many(messages),
  escalations: many(escalations),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const escalationsRelations = relations(escalations, ({ one }) => ({
  conversation: one(conversations, {
    fields: [escalations.conversationId],
    references: [conversations.id],
  }),
  assignedUser: one(users, {
    fields: [escalations.assignedUserId],
    references: [users.id],
  }),
}));

export const supportAgentStatusRelations = relations(supportAgentStatus, ({ one }) => ({
  user: one(users, {
    fields: [supportAgentStatus.userId],
    references: [users.id],
  }),
}));

export const cannedResponsesRelations = relations(cannedResponses, ({ one }) => ({
  company: one(companies, {
    fields: [cannedResponses.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [cannedResponses.userId],
    references: [users.id],
  }),
}));

export const conversationNotesRelations = relations(conversationNotes, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationNotes.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationNotes.userId],
    references: [users.id],
  }),
}));

// Types
export type EndUser = typeof endUsers.$inferSelect;
export type NewEndUser = typeof endUsers.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Escalation = typeof escalations.$inferSelect;
export type NewEscalation = typeof escalations.$inferInsert;
export type SupportAgentStatus = typeof supportAgentStatus.$inferSelect;
export type NewSupportAgentStatus = typeof supportAgentStatus.$inferInsert;
export type CannedResponse = typeof cannedResponses.$inferSelect;
export type NewCannedResponse = typeof cannedResponses.$inferInsert;
export type ConversationNote = typeof conversationNotes.$inferSelect;
export type NewConversationNote = typeof conversationNotes.$inferInsert;
