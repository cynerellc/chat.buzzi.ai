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
  callAiProviderEnum,
  chatappSchema,
  packageTypeEnum,
} from "./enums";
import { aiModels } from "./models";

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
  // Call-specific system prompt (master admin only)
  callSystemPrompt?: string;
  // Call knowledge base settings
  callKnowledgeBaseEnabled?: boolean; // Whether voice calls can access knowledge base
  callKnowledgeCategories?: string[]; // Category names for RAG filtering during calls
  callKnowledgeBaseThreshold?: number; // Min relevance score for RAG results (0.05-0.95, default 0.3)
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
  knowledge_threshold?: number; // Min relevance score for RAG results (0.05-0.95, default 0.3)
  tools?: unknown[]; // Tool configurations
  managed_agent_ids?: string[]; // For supervisors: worker agent identifiers
  sort_order?: number; // Display order
}

// Type definition for routing strategy
export type EscalationRoutingRule = "round_robin" | "least_busy" | "preferred";

// Type definition for chatbot behavior settings (stored as JSONB)
export interface ChatbotBehavior {
  greeting?: string;
  fallbackMessage?: string;
  collectEmail?: boolean;
  collectName?: boolean;
  workingHours?: unknown;
  offlineMessage?: string;
  // Escalation settings
  maxTurnsBeforeEscalation?: number;
  autoEscalateOnSentiment?: boolean;
  sentimentThreshold?: number;
  escalationRoutingRule?: EscalationRoutingRule;
  escalationPreferredAgentId?: string;
  escalationRules?: string[]; // Custom escalation rule prompts for AI interpretation
}

// Type definition for voice configuration (stored as JSONB)
export interface VoiceConfig {
  // OpenAI voices
  openai_voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse";
  // Gemini voices
  gemini_voice?: "Kore" | "Aoede" | "Puck" | "Charon" | "Fenrir";
  // Voice Activity Detection settings
  vad_threshold?: number; // 0.0-1.0 for OpenAI
  vad_sensitivity?: "LOW" | "MEDIUM" | "HIGH"; // For Gemini
  silence_duration_ms?: number; // Silence duration before turn completion
  prefix_padding_ms?: number; // Padding before start of audio
  // Call-specific prompts
  call_greeting?: string; // Greeting when call starts
  system_prompt_call?: string; // System prompt for call mode (deprecated, use ChatbotSettings.callSystemPrompt)
  callSystemPrompt?: string; // For packages default_voice_config
}

// Type definition for call widget configuration (stored as JSONB)
export interface CallWidgetConfig {
  enabled?: boolean;
  position?: "bottom-right" | "bottom-left";
  colors?: {
    primary?: string;
    primaryHover?: string;
    background?: string;
    text?: string;
  };
  callButton?: {
    style?: "orb" | "pill";
    size?: number;
    animation?: boolean;
    label?: string;
  };
  orb?: {
    glowIntensity?: number;
    pulseSpeed?: number;
    states?: {
      idle?: { color: string; animation: string };
      connecting?: { color: string; animation: string };
      active?: { color: string; animation: string };
      muted?: { color: string; animation: string };
    };
  };
  callDialog?: {
    width?: number;
    showVisualizer?: boolean;
    visualizerStyle?: "waveform" | "bars" | "circle";
    showTranscript?: boolean;
  };
  controls?: {
    showMuteButton?: boolean;
    showEndCallButton?: boolean;
  };
  branding?: {
    showPoweredBy?: boolean;
    companyLogo?: string;
  };
}

// Chat widget configuration (migrated from widget_configs table)
export interface ChatWidgetConfig {
  // Appearance
  theme?: "light" | "dark" | "auto";
  position?: "bottom-right" | "bottom-left";
  placement?: "above-launcher" | "center-screen";
  primaryColor?: string;
  accentColor?: string;
  userBubbleColor?: string;
  overrideAgentColor?: boolean;
  agentBubbleColor?: string;
  borderRadius?: number;
  buttonSize?: number;

  // Branding
  title?: string;
  subtitle?: string;
  welcomeMessage?: string;
  placeholderText?: string;
  logoUrl?: string;
  avatarUrl?: string;

  // Behavior
  autoOpen?: boolean;
  autoOpenDelay?: number;
  showBranding?: boolean;
  playSoundOnMessage?: boolean;
  persistConversation?: boolean;

  // Features
  enableFileUpload?: boolean;
  enableVoiceMessages?: boolean;
  enableFeedback?: boolean;
  requireEmail?: boolean;
  requireName?: boolean;

  // Advanced
  customCss?: string;
  allowedDomains?: string[];
  zIndex?: number;

  // Launcher Customization
  launcherIcon?: "chat" | "message" | "help" | "custom";
  launcherText?: string;
  hideLauncherOnMobile?: boolean;
  launcherIconBorderRadius?: number;
  launcherIconPulseGlow?: boolean;
  showLauncherText?: boolean;
  launcherTextBackgroundColor?: string;
  launcherTextColor?: string;

  // Pre-chat Form
  preChatForm?: {
    enabled: boolean;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };

  // Stream Display Options
  showAgentSwitchNotification?: boolean;
  showThinking?: boolean;
  showInstantUpdates?: boolean;

  // Multi-agent Display Options
  showAgentListOnTop?: boolean;
  agentListMinCards?: number;
  agentListingType?: "minimal" | "compact" | "standard" | "detailed";
}

// Unified widget configuration (combines chat and call)
export interface WidgetConfig {
  chat: ChatWidgetConfig;
  call: CallWidgetConfig;
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

    // Feature Flags
    enabledChat: boolean("enabled_chat").default(true).notNull(),
    enabledCall: boolean("enabled_call").default(false).notNull(),

    // Call Feature Settings
    callAiProvider: callAiProviderEnum("call_ai_provider"),
    defaultCallModelId: uuid("default_call_model_id").references(() => aiModels.id),
    defaultVoiceConfig: jsonb("default_voice_config").$type<VoiceConfig>().default({}).notNull(),

    // Unified Widget Configuration
    defaultWidgetConfig: jsonb("default_widget_config").$type<WidgetConfig>().default({
      chat: {
        theme: "light",
        position: "bottom-right",
        primaryColor: "#6437F3",
        title: "Chat with us",
        welcomeMessage: "Hi there! How can we help you today?",
      },
      call: {
        enabled: true,
        position: "bottom-right",
        callButton: { style: "orb", size: 60, animation: true },
      },
    }).notNull(),

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
      .$type<ChatbotBehavior>()
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
        escalationRoutingRule: "least_busy",
        escalationPreferredAgentId: undefined,
        escalationRules: [],
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

    // Feature Flags
    enabledChat: boolean("enabled_chat").default(true).notNull(),
    enabledCall: boolean("enabled_call").default(false).notNull(),

    // Call Feature Settings
    callAiProvider: callAiProviderEnum("call_ai_provider"),
    callModelId: uuid("call_model_id").references(() => aiModels.id),
    voiceConfig: jsonb("voice_config").$type<VoiceConfig>().default({}).notNull(),

    // Unified Widget Configuration (combines chat and call widget settings)
    widgetConfig: jsonb("widget_config").$type<WidgetConfig>().default({
      chat: {
        theme: "light",
        position: "bottom-right",
        primaryColor: "#6437F3",
        accentColor: "#2b3dd8",
        borderRadius: 16,
        buttonSize: 60,
        title: "Chat with us",
        welcomeMessage: "Hi there! How can we help you today?",
        showBranding: true,
        playSoundOnMessage: true,
        persistConversation: true,
        enableFeedback: true,
        zIndex: 9999,
        launcherIcon: "chat",
        showAgentSwitchNotification: true,
        showInstantUpdates: true,
        showAgentListOnTop: true,
        agentListMinCards: 3,
        agentListingType: "detailed",
      },
      call: {
        enabled: true,
        position: "bottom-right",
        callButton: { style: "orb", size: 60, animation: true },
        orb: {
          glowIntensity: 0.6,
          pulseSpeed: 2,
        },
        callDialog: {
          width: 400,
          showVisualizer: true,
          visualizerStyle: "waveform",
          showTranscript: true,
        },
        controls: {
          showMuteButton: true,
          showEndCallButton: true,
        },
      },
    }).notNull(),

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


// Relations
export const chatbotPackagesRelations = relations(chatbotPackages, ({ many }) => ({
  chatbots: many(chatbots),
}));

export const chatbotsRelations = relations(chatbots, ({ one }) => ({
  company: one(companies, {
    fields: [chatbots.companyId],
    references: [companies.id],
  }),
  package: one(chatbotPackages, {
    fields: [chatbots.packageId],
    references: [chatbotPackages.id],
  }),
}));

// Types
export type ChatbotPackage = typeof chatbotPackages.$inferSelect;
export type NewChatbotPackage = typeof chatbotPackages.$inferInsert;
export type Chatbot = typeof chatbots.$inferSelect;
export type NewChatbot = typeof chatbots.$inferInsert;

// Legacy type aliases for backward compatibility during migration
export type AgentPackage = ChatbotPackage;
export type NewAgentPackage = NewChatbotPackage;
export type Agent = Chatbot;
export type NewAgent = NewChatbot;

// Legacy table aliases for backward compatibility during migration
export const agentPackages = chatbotPackages;
export const agents = chatbots;

// Legacy relation aliases
export const agentPackagesRelations = chatbotPackagesRelations;
export const agentsRelations = chatbotsRelations;
