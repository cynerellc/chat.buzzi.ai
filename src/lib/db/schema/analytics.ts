import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { agents } from "./agents";
import { companies } from "./companies";
import { chatappSchema } from "./enums";

// Daily Analytics Table (aggregated per day)
export const dailyAnalytics = chatappSchema.table(
  "daily_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),

    // Date
    date: date("date").notNull(),

    // Conversation Metrics
    totalConversations: integer("total_conversations").default(0).notNull(),
    newConversations: integer("new_conversations").default(0).notNull(),
    resolvedConversations: integer("resolved_conversations").default(0).notNull(),
    escalatedConversations: integer("escalated_conversations").default(0).notNull(),
    abandonedConversations: integer("abandoned_conversations").default(0).notNull(),

    // Resolution Metrics
    aiResolvedCount: integer("ai_resolved_count").default(0).notNull(),
    humanResolvedCount: integer("human_resolved_count").default(0).notNull(),

    // Message Metrics
    totalMessages: integer("total_messages").default(0).notNull(),
    userMessages: integer("user_messages").default(0).notNull(),
    assistantMessages: integer("assistant_messages").default(0).notNull(),
    humanAgentMessages: integer("human_agent_messages").default(0).notNull(),

    // Response Time (in seconds)
    avgFirstResponseTime: integer("avg_first_response_time"),
    avgResponseTime: integer("avg_response_time"),
    avgResolutionTime: integer("avg_resolution_time"),

    // Satisfaction
    avgSatisfactionScore: numeric("avg_satisfaction_score", { precision: 3, scale: 2 }),
    satisfactionResponses: integer("satisfaction_responses").default(0).notNull(),

    // Sentiment
    avgSentiment: integer("avg_sentiment"),
    positiveSentimentCount: integer("positive_sentiment_count").default(0).notNull(),
    neutralSentimentCount: integer("neutral_sentiment_count").default(0).notNull(),
    negativeSentimentCount: integer("negative_sentiment_count").default(0).notNull(),

    // Unique Users
    uniqueUsers: integer("unique_users").default(0).notNull(),
    returningUsers: integer("returning_users").default(0).notNull(),
    newUsers: integer("new_users").default(0).notNull(),

    // Channel breakdown
    channelBreakdown: jsonb("channel_breakdown").default({}),

    // Peak hours
    peakHours: jsonb("peak_hours").default([]),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("daily_analytics_company_idx").on(table.companyId),
    index("daily_analytics_agent_idx").on(table.agentId),
    index("daily_analytics_date_idx").on(table.date),
    index("daily_analytics_company_date_idx").on(table.companyId, table.date),
  ]
);

// Hourly Analytics Table (for real-time dashboards)
export const hourlyAnalytics = chatappSchema.table(
  "hourly_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),

    // Hour (stored as timestamp of the hour start)
    hour: timestamp("hour").notNull(),

    // Metrics
    conversations: integer("conversations").default(0).notNull(),
    messages: integer("messages").default(0).notNull(),
    escalations: integer("escalations").default(0).notNull(),
    avgResponseTimeMs: integer("avg_response_time_ms"),
    uniqueUsers: integer("unique_users").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("hourly_analytics_company_idx").on(table.companyId),
    index("hourly_analytics_hour_idx").on(table.hour),
    index("hourly_analytics_company_hour_idx").on(table.companyId, table.hour),
  ]
);

// Topic Analytics Table (what users are asking about)
export const topicAnalytics = chatappSchema.table(
  "topic_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Date range
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    // Topic Info
    topic: varchar("topic", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }),

    // Metrics
    occurrences: integer("occurrences").default(0).notNull(),
    avgSentiment: integer("avg_sentiment"),
    resolutionRate: numeric("resolution_rate", { precision: 5, scale: 2 }),
    avgResolutionTime: integer("avg_resolution_time"),

    // Related keywords
    keywords: jsonb("keywords").default([]),

    // Sample conversation IDs
    sampleConversationIds: jsonb("sample_conversation_ids").default([]),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("topic_analytics_company_idx").on(table.companyId),
    index("topic_analytics_date_idx").on(table.startDate, table.endDate),
    index("topic_analytics_topic_idx").on(table.topic),
  ]
);

// Platform Analytics Table (Master Admin - aggregated across all companies)
export const platformAnalytics = chatappSchema.table(
  "platform_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Date
    date: date("date").notNull().unique(),

    // Company Metrics
    totalCompanies: integer("total_companies").default(0).notNull(),
    activeCompanies: integer("active_companies").default(0).notNull(),
    newCompanies: integer("new_companies").default(0).notNull(),
    churnedCompanies: integer("churned_companies").default(0).notNull(),

    // User Metrics
    totalUsers: integer("total_users").default(0).notNull(),
    activeUsers: integer("active_users").default(0).notNull(),
    newUsers: integer("new_users").default(0).notNull(),

    // Conversation Metrics
    totalConversations: integer("total_conversations").default(0).notNull(),
    totalMessages: integer("total_messages").default(0).notNull(),

    // Revenue Metrics
    mrr: numeric("mrr", { precision: 12, scale: 2 }),
    arr: numeric("arr", { precision: 12, scale: 2 }),
    newMrr: numeric("new_mrr", { precision: 12, scale: 2 }),
    churnedMrr: numeric("churned_mrr", { precision: 12, scale: 2 }),

    // Plan Distribution
    planDistribution: jsonb("plan_distribution").default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("platform_analytics_date_idx").on(table.date)]
);

// Relations
export const dailyAnalyticsRelations = relations(dailyAnalytics, ({ one }) => ({
  company: one(companies, {
    fields: [dailyAnalytics.companyId],
    references: [companies.id],
  }),
  agent: one(agents, {
    fields: [dailyAnalytics.agentId],
    references: [agents.id],
  }),
}));

export const hourlyAnalyticsRelations = relations(hourlyAnalytics, ({ one }) => ({
  company: one(companies, {
    fields: [hourlyAnalytics.companyId],
    references: [companies.id],
  }),
  agent: one(agents, {
    fields: [hourlyAnalytics.agentId],
    references: [agents.id],
  }),
}));

export const topicAnalyticsRelations = relations(topicAnalytics, ({ one }) => ({
  company: one(companies, {
    fields: [topicAnalytics.companyId],
    references: [companies.id],
  }),
}));

// Types
export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;
export type NewDailyAnalytics = typeof dailyAnalytics.$inferInsert;
export type HourlyAnalytics = typeof hourlyAnalytics.$inferSelect;
export type NewHourlyAnalytics = typeof hourlyAnalytics.$inferInsert;
export type TopicAnalytics = typeof topicAnalytics.$inferSelect;
export type NewTopicAnalytics = typeof topicAnalytics.$inferInsert;
export type PlatformAnalytics = typeof platformAnalytics.$inferSelect;
export type NewPlatformAnalytics = typeof platformAnalytics.$inferInsert;
