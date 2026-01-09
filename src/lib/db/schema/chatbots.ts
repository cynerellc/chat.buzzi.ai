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
  chatbotTypeEnum,
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

// Type definition for chatbot settings (widget config, etc.)
export interface ChatbotSettings {
  widgetConfigUrl?: string; // Signed URL to pre-generated JSON config (10-year expiry)
  widgetConfigPath?: string; // Storage path for regeneration
  widgetConfigGeneratedAt?: string; // ISO timestamp of last generation
}

// Type definition for model settings (dynamic per model)
// Settings are defined by the model's settingsSchema in the ai_models table
export type ModelSettings = Record<string, unknown>;

// Type definition for agent list items (stored as JSONB array)
export interface AgentListItem {
  agent_identifier: string; // Unique identifier within the package
  name: string; // Display name
  designation?: string; // e.g., "Sales Specialist", "Support Lead"
  routing_prompt?: string; // Brief description for supervisor routing decisions (labeled "Duties" in UI)
  agent_type: "worker" | "supervisor"; // Role in multi-agent orchestration
  avatar_url?: string; // Profile image URL
  color?: string; // Agent color for chat bubbles and avatar ring (hex format like #FF5733)
  default_system_prompt: string; // LLM system prompt (renamed from system_prompt)
  default_model_id: string; // e.g., "gpt-5-mini", "gemini-3-flash-preview" (model_id from ai_models table)
  model_settings?: ModelSettings; // Dynamic settings based on model's settingsSchema
  knowledge_base_enabled?: boolean; // Whether this agent can access the knowledge base
  knowledge_categories?: string[]; // Category names for RAG filtering
  tools?: unknown[]; // Tool configurations
  managed_agent_ids?: string[]; // For supervisors: worker agent identifiers
  sort_order?: number; // Display order
}

// Chatbot Packages Table (Master Admin templates - Pluggable Agent Framework)
// Renamed from agent_packages
export const chatbotPackages = chatappSchema.table(
  "chatbot_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Package Info
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    category: varchar("category", { length: 100 }),

    // Package Type (single_agent or multi_agent)
    packageType: packageTypeEnum("package_type").default("single_agent").notNull(),

    // Chatbot Type (chat or call)
    chatbotType: chatbotTypeEnum("chatbot_type").default("chat").notNull(),

    // Is Custom Package (created specifically for a company vs. template package)
    isCustomPackage: boolean("is_custom_package").default(false).notNull(),

    // Code Bundle Storage
    // Path to the chatbot package bundle in storage (e.g., /chatbot-packages/{package_id}/index.js)
    bundlePath: varchar("bundle_path", { length: 500 }),
    bundleVersion: varchar("bundle_version", { length: 50 }).default("1.0.0"),
    bundleChecksum: varchar("bundle_checksum", { length: 64 }), // SHA-256 hash

    // NOTE: defaultSystemPrompt, defaultModelId removed
    // These settings now exist ONLY within agentsList items as:
    // - default_system_prompt
    // - default_model_id
    // - model_settings (dynamic settings based on model's settingsSchema)

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

    // Agents list (replaces package_agents table)
    // Contains all agent configurations for this package
    agentsList: jsonb("agents_list").$type<AgentListItem[]>().default([]).notNull(),

    // Status
    isActive: boolean("is_active").default(true).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("chatbot_packages_slug_idx").on(table.slug),
    index("chatbot_packages_category_idx").on(table.category),
    index("chatbot_packages_type_idx").on(table.packageType),
  ]
);

// Chatbots Table (Company-specific instances)
// Renamed from agents
export const chatbots = chatappSchema.table(
  "chatbots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Company Reference
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Package Reference (optional - custom chatbots don't have one)
    packageId: uuid("package_id").references(() => chatbotPackages.id),

    // Package Type (copied from chatbot_packages when creating)
    packageType: packageTypeEnum("package_type").default("single_agent").notNull(),

    // Chatbot Type (copied from chatbot_packages when creating)
    chatbotType: chatbotTypeEnum("chatbot_type").default("chat").notNull(),

    // Is Custom Package (copied from chatbot_packages when creating by master admin)
    isCustomPackage: boolean("is_custom_package").default(false).notNull(),

    // Chatbot Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: agentTypeEnum("type").default("support").notNull(),
    status: agentStatusEnum("status").default("draft").notNull(),

    // Agents list - contains all agent configurations for this deployed chatbot
    // Each item has: agent_identifier, name, default_system_prompt, default_model_id, model_settings, knowledge_categories, etc.
    agentsList: jsonb("agents_list").$type<AgentListItem[]>().default([]).notNull(),

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

    // Package Variable Values (key-value pairs)
    // Record<variableName, value> - values for variables defined in the package
    variableValues: jsonb("variable_values").$type<Record<string, string>>().default({}).notNull(),

    // Settings (widget config URL, etc.)
    settings: jsonb("settings").$type<ChatbotSettings>().default({}).notNull(),

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
    index("chatbots_company_idx").on(table.companyId),
    index("chatbots_package_idx").on(table.packageId),
    index("chatbots_status_idx").on(table.status),
    index("chatbots_type_idx").on(table.type),
  ]
);

// Chatbot Versions Table (for version history)
// Renamed from agent_versions
export const chatbotVersions = chatappSchema.table(
  "chatbot_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Chatbot Reference
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbots.id, { onDelete: "cascade" }),

    // Version Info
    version: integer("version").notNull(),
    changelog: text("changelog"),

    // Snapshot of chatbot config at this version
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
    index("chatbot_versions_chatbot_idx").on(table.chatbotId),
    index("chatbot_versions_version_idx").on(table.chatbotId, table.version),
  ]
);


// Relations
export const chatbotPackagesRelations = relations(chatbotPackages, ({ many }) => ({
  chatbots: many(chatbots),
}));

export const chatbotsRelations = relations(chatbots, ({ one, many }) => ({
  company: one(companies, {
    fields: [chatbots.companyId],
    references: [companies.id],
  }),
  package: one(chatbotPackages, {
    fields: [chatbots.packageId],
    references: [chatbotPackages.id],
  }),
  versions: many(chatbotVersions),
}));

export const chatbotVersionsRelations = relations(chatbotVersions, ({ one }) => ({
  chatbot: one(chatbots, {
    fields: [chatbotVersions.chatbotId],
    references: [chatbots.id],
  }),
}));

// Types
export type ChatbotPackage = typeof chatbotPackages.$inferSelect;
export type NewChatbotPackage = typeof chatbotPackages.$inferInsert;
export type Chatbot = typeof chatbots.$inferSelect;
export type NewChatbot = typeof chatbots.$inferInsert;
export type ChatbotVersion = typeof chatbotVersions.$inferSelect;
export type NewChatbotVersion = typeof chatbotVersions.$inferInsert;

// Legacy type aliases for backward compatibility during migration
export type AgentPackage = ChatbotPackage;
export type NewAgentPackage = NewChatbotPackage;
export type Agent = Chatbot;
export type NewAgent = NewChatbot;
export type AgentVersion = ChatbotVersion;
export type NewAgentVersion = NewChatbotVersion;

// Legacy table aliases for backward compatibility during migration
export const agentPackages = chatbotPackages;
export const agents = chatbots;
export const agentVersions = chatbotVersions;

// Legacy relation aliases
export const agentPackagesRelations = chatbotPackagesRelations;
export const agentsRelations = chatbotsRelations;
export const agentVersionsRelations = chatbotVersionsRelations;
