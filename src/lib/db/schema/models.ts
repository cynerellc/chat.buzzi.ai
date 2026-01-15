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

import { aiModelProviderEnum, aiModelTypeEnum, chatappSchema } from "./enums";

// ============================================================================
// Model Settings Schema Types
// ============================================================================

/**
 * Definition for a single model setting field.
 * These define what settings are available for each model and how they should be rendered.
 */
export interface ModelSettingDefinition {
  type: "slider" | "number" | "select" | "toggle";
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: string[]; // For select type
  label: string;
  description?: string;
}

/**
 * Schema defining all available settings for a model.
 * Keys are setting names (e.g., "temperature", "top_p", "reasoning_effort")
 */
export type ModelSettingsSchema = Record<string, ModelSettingDefinition>;

// ============================================================================
// AI Models Table
// ============================================================================

/**
 * AI Models table - stores all available AI models with their configurations.
 * Master admin can manage models, set pricing, and define per-model settings.
 */
export const aiModels = chatappSchema.table(
  "ai_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Model Identification
    provider: aiModelProviderEnum("provider").notNull(),
    modelId: varchar("model_id", { length: 100 }).notNull().unique(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),

    // Model Capabilities
    modelType: aiModelTypeEnum("model_type").default("chat").notNull(), // chat, call, or both
    supportsAudio: boolean("supports_audio").default(false).notNull(), // Real-time audio streaming

    // Token Limits
    inputLimit: integer("input_limit").notNull(), // Max input tokens
    outputLimit: integer("output_limit").notNull(), // Max output tokens

    // Pricing (per million tokens) - Master admin only visibility
    inputPricePerMillion: decimal("input_price_per_million", {
      precision: 10,
      scale: 4,
    }),
    outputPricePerMillion: decimal("output_price_per_million", {
      precision: 10,
      scale: 4,
    }),
    cachedInputPrice: decimal("cached_input_price", {
      precision: 10,
      scale: 4,
    }),

    // Dynamic Settings Schema
    // Defines what settings this model supports (e.g., temperature, top_p, reasoning_effort)
    settingsSchema: jsonb("settings_schema")
      .$type<ModelSettingsSchema>()
      .default({})
      .notNull(),

    // Status Flags
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),

    // Display Order
    sortOrder: integer("sort_order").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_models_provider_idx").on(table.provider),
    index("ai_models_is_active_idx").on(table.isActive),
    index("ai_models_sort_order_idx").on(table.sortOrder),
  ]
);

// ============================================================================
// Types
// ============================================================================

export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;

// Provider type derived from enum
export type AiModelProvider = "openai" | "google" | "anthropic";
