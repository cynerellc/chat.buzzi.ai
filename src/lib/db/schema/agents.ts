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
import {
  agentStatusEnum,
  agentTypeEnum,
  chatappSchema,
  packageAgentTypeEnum,
  packageTypeEnum,
} from "./enums";

// Type definitions for package variables (stored as JSONB)
export interface PackageVariableDefinition {
  name: string; // e.g., "EMAIL_HOST", "API_KEY"
  displayName: string; // Human-readable label
  description?: string; // Help text
  variableType: "variable" | "secured_variable";
  dataType: "string" | "number" | "boolean" | "json";
  defaultValue?: string; // Only for non-secured variables
  required: boolean;
  validationPattern?: string; // Optional regex
  placeholder?: string; // Input placeholder
}

// Agent Packages Table (Master Admin templates - Pluggable Agent Framework)
export const agentPackages = chatappSchema.table(
  "agent_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Package Info
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    category: varchar("category", { length: 100 }),

    // Package Type (single_agent or multi_agent)
    packageType: packageTypeEnum("package_type").default("single_agent").notNull(),

    // Code Bundle Storage
    // Path to the agent package bundle in storage (e.g., /agent-packages/{package_id}/index.js)
    bundlePath: varchar("bundle_path", { length: 500 }),
    bundleVersion: varchar("bundle_version", { length: 50 }).default("1.0.0"),
    bundleChecksum: varchar("bundle_checksum", { length: 64 }), // SHA-256 hash

    // Legacy fields (kept for backward compatibility with existing packages)
    // New packages should use packageAgents table instead
    defaultSystemPrompt: text("default_system_prompt").default("").notNull(),
    defaultModelId: varchar("default_model_id", { length: 100 }).default("gpt-4o-mini").notNull(),
    defaultTemperature: integer("default_temperature").default(70).notNull(),

    // Default Behavior (shared across all agents in the package)
    defaultBehavior: jsonb("default_behavior").default({}).notNull(),

    // Features/capabilities included in this package
    features: jsonb("features").default([]).notNull(),

    // Security & Execution Settings
    executionConfig: jsonb("execution_config").default({
      maxExecutionTimeMs: 30000,
      maxMemoryMb: 128,
      allowedNetworkDomains: [],
      sandboxMode: true,
    }).notNull(),

    // Package Variables (definitions without values)
    // Array of PackageVariableDefinition objects
    variables: jsonb("variables").$type<PackageVariableDefinition[]>().default([]).notNull(),

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
    index("agent_packages_type_idx").on(table.packageType),
  ]
);

// Package Agents Table (Individual agents within a package)
// Each package has one or more agents configured here
export const packageAgents = chatappSchema.table(
  "package_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Package Reference
    packageId: uuid("package_id")
      .notNull()
      .references(() => agentPackages.id, { onDelete: "cascade" }),

    // Agent Identity within the package (used in code: createBuzziAgent({ agentId: "..." }))
    agentIdentifier: varchar("agent_identifier", { length: 100 }).notNull(),

    // Agent Info (editable by Master Admin)
    name: varchar("name", { length: 255 }).notNull(),
    designation: varchar("designation", { length: 255 }), // e.g., "Sales Specialist", "Support Lead"

    // Agent Type for multi-agent orchestration
    agentType: packageAgentTypeEnum("agent_type").default("worker").notNull(),

    // AI Configuration
    systemPrompt: text("system_prompt").notNull(),
    modelId: varchar("model_id", { length: 100 }).default("gpt-4o-mini").notNull(),
    temperature: integer("temperature").default(70).notNull(), // Stored as 0-100

    // Tools configuration (references to tools available to this agent)
    tools: jsonb("tools").default([]).notNull(),

    // For supervisor agents: list of worker agent identifiers this supervisor manages
    managedAgentIds: jsonb("managed_agent_ids").default([]).notNull(),

    // Display order in the UI
    sortOrder: integer("sort_order").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("package_agents_package_idx").on(table.packageId),
    index("package_agents_identifier_idx").on(table.packageId, table.agentIdentifier),
    index("package_agents_type_idx").on(table.agentType),
  ]
);

// Agents Table (Company-specific instances)
export const agents = chatappSchema.table(
  "agents",
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
        fallbackMessage: "I am sorry, I do not understand. Let me connect you with a human agent.",
        maxTurnsBeforeEscalation: 10,
        autoEscalateOnSentiment: true,
        sentimentThreshold: -0.5,
        collectEmail: true,
        collectName: true,
        workingHours: null,
        offlineMessage: "We are currently offline. Please leave a message and we will get back to you.",
      })
      .notNull(),

    // Escalation Settings
    escalationEnabled: boolean("escalation_enabled").default(true).notNull(),
    escalationTriggers: jsonb("escalation_triggers").default([]).notNull(),

    // Business Hours Configuration
    // { enabled: boolean, timezone: string, schedule: { day: { start: string, end: string }[] } }
    businessHours: jsonb("business_hours").default({
      enabled: false,
      timezone: "UTC",
      schedule: {
        monday: [{ start: "09:00", end: "17:00" }],
        tuesday: [{ start: "09:00", end: "17:00" }],
        wednesday: [{ start: "09:00", end: "17:00" }],
        thursday: [{ start: "09:00", end: "17:00" }],
        friday: [{ start: "09:00", end: "17:00" }],
        saturday: [],
        sunday: [],
      },
    }),

    // Knowledge Base IDs (linked knowledge sources)
    knowledgeSourceIds: jsonb("knowledge_source_ids").default([]).notNull(),

    // Package Variable Values (key-value pairs)
    // Record<variableName, value> - values for variables defined in the package
    variableValues: jsonb("variable_values").$type<Record<string, string>>().default({}).notNull(),

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
export const agentVersions = chatappSchema.table(
  "agent_versions",
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
  packageAgents: many(packageAgents),
}));

export const packageAgentsRelations = relations(packageAgents, ({ one }) => ({
  package: one(agentPackages, {
    fields: [packageAgents.packageId],
    references: [agentPackages.id],
  }),
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
export type PackageAgent = typeof packageAgents.$inferSelect;
export type NewPackageAgent = typeof packageAgents.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;
