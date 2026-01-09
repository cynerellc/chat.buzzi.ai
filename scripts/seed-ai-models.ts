/**
 * Seed script for AI Models table
 *
 * Run with:
 * DATABASE_URL="..." npx tsx scripts/seed-ai-models.ts
 */

import postgres from "postgres";
import type { ModelSettingsSchema } from "../src/lib/db/schema/models";

const sql = postgres(process.env.DATABASE_URL!);

// Common settings schemas
const standardSettings: ModelSettingsSchema = {
  temperature: {
    type: "slider",
    min: 0,
    max: 2,
    step: 0.1,
    default: 0.7,
    label: "Temperature",
    description: "Controls randomness. Lower values are more focused and deterministic.",
  },
  max_tokens: {
    type: "number",
    min: 1,
    max: 16384,
    default: 4096,
    label: "Max Output Tokens",
    description: "Maximum number of tokens to generate in the response.",
  },
  top_p: {
    type: "slider",
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
    label: "Top P",
    description: "Nucleus sampling: only consider tokens with cumulative probability up to this value.",
  },
};

const gpt5ReasoningSettings: ModelSettingsSchema = {
  ...standardSettings,
  reasoning_effort: {
    type: "select",
    options: ["low", "medium", "high"],
    default: "medium",
    label: "Reasoning Effort",
    description: "How much effort the model puts into reasoning through the problem.",
  },
};

const geminiSettings: ModelSettingsSchema = {
  ...standardSettings,
  top_k: {
    type: "number",
    min: 1,
    max: 100,
    default: 40,
    label: "Top K",
    description: "Number of top tokens to consider for sampling.",
  },
};

// Models to seed
const models = [
  // OpenAI GPT-5 Series
  {
    provider: "openai",
    model_id: "gpt-5-2025-08-07",
    display_name: "GPT-5.2",
    description: "Most capable GPT-5 model with extended reasoning capabilities.",
    input_limit: 400000,
    output_limit: 100000,
    input_price_per_million: "2.50",
    output_price_per_million: "10.00",
    cached_input_price: "1.25",
    settings_schema: gpt5ReasoningSettings,
    is_active: true,
    is_default: false,
    sort_order: 1,
  },
  {
    provider: "openai",
    model_id: "gpt-5-mini-2025-08-07",
    display_name: "GPT-5 Mini",
    description: "Balanced performance and cost. Recommended for most use cases.",
    input_limit: 400000,
    output_limit: 100000,
    input_price_per_million: "0.40",
    output_price_per_million: "1.60",
    cached_input_price: "0.10",
    settings_schema: standardSettings,
    is_active: true,
    is_default: true,
    sort_order: 2,
  },
  {
    provider: "openai",
    model_id: "gpt-5-nano-2025-08-07",
    display_name: "GPT-5 Nano",
    description: "Fastest and most cost-effective GPT-5 variant.",
    input_limit: 400000,
    output_limit: 100000,
    input_price_per_million: "0.10",
    output_price_per_million: "0.40",
    cached_input_price: "0.025",
    settings_schema: standardSettings,
    is_active: true,
    is_default: false,
    sort_order: 3,
  },

  // Google Gemini Series
  {
    provider: "google",
    model_id: "gemini-3-pro-preview",
    display_name: "Gemini 3 Pro",
    description: "Google's most capable reasoning model with multimodal support.",
    input_limit: 2000000,
    output_limit: 65536,
    input_price_per_million: "1.25",
    output_price_per_million: "10.00",
    cached_input_price: "0.31",
    settings_schema: geminiSettings,
    is_active: true,
    is_default: false,
    sort_order: 10,
  },
  {
    provider: "google",
    model_id: "gemini-3-flash-preview",
    display_name: "Gemini 3 Flash",
    description: "Fast and efficient Gemini 3 variant for high-throughput applications.",
    input_limit: 1000000,
    output_limit: 65536,
    input_price_per_million: "0.10",
    output_price_per_million: "0.40",
    cached_input_price: "0.025",
    settings_schema: geminiSettings,
    is_active: true,
    is_default: false,
    sort_order: 11,
  },
  {
    provider: "google",
    model_id: "gemini-2.5-flash",
    display_name: "Gemini 2.5 Flash",
    description: "Stable Gemini model with excellent speed and cost efficiency.",
    input_limit: 1000000,
    output_limit: 65536,
    input_price_per_million: "0.075",
    output_price_per_million: "0.30",
    cached_input_price: "0.01875",
    settings_schema: geminiSettings,
    is_active: true,
    is_default: false,
    sort_order: 12,
  },
];

async function seedModels() {
  console.log("Seeding AI models...");

  for (const model of models) {
    try {
      // Upsert: insert or update on conflict
      await sql`
        INSERT INTO chatapp.ai_models (
          provider,
          model_id,
          display_name,
          description,
          input_limit,
          output_limit,
          input_price_per_million,
          output_price_per_million,
          cached_input_price,
          settings_schema,
          is_active,
          is_default,
          sort_order
        ) VALUES (
          ${model.provider},
          ${model.model_id},
          ${model.display_name},
          ${model.description},
          ${model.input_limit},
          ${model.output_limit},
          ${model.input_price_per_million},
          ${model.output_price_per_million},
          ${model.cached_input_price},
          ${JSON.stringify(model.settings_schema)},
          ${model.is_active},
          ${model.is_default},
          ${model.sort_order}
        )
        ON CONFLICT (model_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          input_limit = EXCLUDED.input_limit,
          output_limit = EXCLUDED.output_limit,
          input_price_per_million = EXCLUDED.input_price_per_million,
          output_price_per_million = EXCLUDED.output_price_per_million,
          cached_input_price = EXCLUDED.cached_input_price,
          settings_schema = EXCLUDED.settings_schema,
          is_active = EXCLUDED.is_active,
          is_default = EXCLUDED.is_default,
          sort_order = EXCLUDED.sort_order,
          updated_at = NOW()
      `;
      console.log(`  ✓ ${model.display_name} (${model.model_id})`);
    } catch (error) {
      console.error(`  ✗ Failed to seed ${model.model_id}:`, error);
    }
  }

  console.log("\nDone!");
  await sql.end();
}

seedModels().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
