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

import { companies } from "./companies";
import { agentStatusEnum, agentTypeEnum } from "./enums";

// Agent Packages Table (Master Admin templates)
export const agentPackages = pgTable(
  "chatapp_agent_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Package Info
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    category: varchar("category", { length: 100 }),

    // Default Configuration
    defaultSystemPrompt: text("default_system_prompt").notNull(),
    defaultModelId: varchar("default_model_id", { length: 100 }).default("gpt-4o-mini").notNull(),
    defaultTemperature: integer("default_temperature").default(70).notNull(), // Stored as 0-100

    // Default Behavior
    defaultBehavior: jsonb("default_behavior").default({}).notNull(),

    // Features included
    features: jsonb("features").default([]).notNull(),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_packages_slug_idx").on(table.slug),
    index("agent_packages_category_idx").on(table.category),
  ]
);

// Agents Table (Company-specific instances)
export const agents = pgTable(
  "chatapp_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Package Reference (optional - custom agents don't have one)
    packageId: uuid("package_id").references(() => agentPackages.id),

    // Agent Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: agentTypeEnum("type").default("support").notNull(),
    status: agentStatusEnum("status").default("draft").notNull(),

    // Avatar
    avatarUrl: varchar("avatar_url", { length: 500 }),

    // AI Configuration
    systemPrompt: text("system_prompt").notNull(),
    modelId: varchar("model_id", { length: 100 }).default("gpt-4o-mini").notNull(),
    temperature: integer("temperature").default(70).notNull(), // Stored as 0-100

    // Behavior Settings
    behavior: jsonb("behavior")
      .default({
        greeting: "Hello! How can I help you today?",
        fallbackMessage: "I'm sorry, I don't understand. Let me connect you with a human agent.",
        maxTurnsBeforeEscalation: 10,
        autoEscalateOnSentiment: true,
        sentimentThreshold: -0.5,
        collectEmail: true,
        collectName: true,
        workingHours: null,
        offlineMessage: "We're currently offline. Please leave a message and we'll get back to you.",
      })
      .notNull(),

    // Escalation Settings
    escalationEnabled: boolean("escalation_enabled").default(true).notNull(),
    escalationTriggers: jsonb("escalation_triggers").default([]).notNull(),

    // Knowledge Base IDs (linked knowledge sources)
    knowledgeSourceIds: jsonb("knowledge_source_ids").default([]).notNull(),

    // Analytics
    totalConversations: integer("total_conversations").default(0).notNull(),
    avgResolutionTime: integer("avg_resolution_time"), // in seconds
    satisfactionScore: integer("satisfaction_score"), // 0-100

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("agents_company_idx").on(table.companyId),
    index("agents_package_idx").on(table.packageId),
    index("agents_status_idx").on(table.status),
    index("agents_type_idx").on(table.type),
  ]
);

// Agent Versions Table (for version history)
export const agentVersions = pgTable(
  "chatapp_agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Agent Reference
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),

    // Version Info
    version: integer("version").notNull(),
    changelog: text("changelog"),

    // Snapshot of agent config at this version
    systemPrompt: text("system_prompt").notNull(),
    modelId: varchar("model_id", { length: 100 }).notNull(),
    temperature: integer("temperature").notNull(),
    behavior: jsonb("behavior").notNull(),

    // Who made the change
    createdBy: uuid("created_by"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_versions_agent_idx").on(table.agentId),
    index("agent_versions_version_idx").on(table.agentId, table.version),
  ]
);

// Relations
export const agentPackagesRelations = relations(agentPackages, ({ many }) => ({
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  company: one(companies, {
    fields: [agents.companyId],
    references: [companies.id],
  }),
  package: one(agentPackages, {
    fields: [agents.packageId],
    references: [agentPackages.id],
  }),
  versions: many(agentVersions),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one }) => ({
  agent: one(agents, {
    fields: [agentVersions.agentId],
    references: [agents.id],
  }),
}));

// Types
export type AgentPackage = typeof agentPackages.$inferSelect;
export type NewAgentPackage = typeof agentPackages.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;
