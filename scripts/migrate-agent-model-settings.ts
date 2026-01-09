/**
 * Migration Script: Convert default_temperature to model_settings
 *
 * This script migrates existing agents from the old temperature-based configuration
 * to the new dynamic model_settings format:
 * - Sets default_model_id to 'gpt-5-mini' for all agents
 * - Converts default_temperature (0-100) to model_settings.temperature (0-1)
 * - Adds default model settings based on the model's schema
 *
 * Run with: npx tsx scripts/migrate-agent-model-settings.ts
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { chatbots, chatbotPackages, type AgentListItem } from "@/lib/db/schema/chatbots";
import { aiModels, type ModelSettingsSchema } from "@/lib/db/schema/models";

interface OldAgentListItem extends Omit<AgentListItem, "model_settings"> {
  default_temperature?: number;
  model_settings?: Record<string, unknown>;
}

function getDefaultSettings(schema: ModelSettingsSchema): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    settings[key] = def.default;
  }
  return settings;
}

function migrateAgentSettings(
  agent: OldAgentListItem,
  modelSettingsSchema: ModelSettingsSchema,
  defaultModelId: string
): AgentListItem {
  // Get default settings from the model's schema
  const defaultSettings = getDefaultSettings(modelSettingsSchema);

  // Convert old temperature (0-100) to new temperature (0-1)
  const oldTemp = agent.default_temperature;
  const newTemp = oldTemp !== undefined ? oldTemp / 100 : 0.7;

  // Build new model_settings, preferring existing values if present
  const modelSettings: Record<string, unknown> = {
    ...defaultSettings,
    temperature: newTemp,
    ...(agent.model_settings || {}), // Preserve any existing model_settings
  };

  // Create the migrated agent, removing old default_temperature
  const { default_temperature: _removed, ...rest } = agent;

  return {
    ...rest,
    default_model_id: agent.default_model_id || defaultModelId,
    model_settings: modelSettings,
  } as AgentListItem;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Starting agent model settings migration...\n");

  // Get the default model (marked with is_default=true) and its settings schema
  const [defaultModel] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.isDefault, true));

  if (!defaultModel) {
    throw new Error("No default model found in ai_models table (is_default=true). Run seed-ai-models.ts first.");
  }

  const modelSettingsSchema = defaultModel.settingsSchema as ModelSettingsSchema;
  const defaultModelId = defaultModel.modelId;
  console.log(`Using default model: ${defaultModel.displayName} (${defaultModelId})`);
  console.log(`Settings schema: ${JSON.stringify(Object.keys(modelSettingsSchema))}\n`);

  // Migrate chatbots
  console.log("Migrating chatbots...");
  const allChatbots = await db.select().from(chatbots);
  let chatbotsUpdated = 0;

  for (const chatbot of allChatbots) {
    const agentsList = chatbot.agentsList as OldAgentListItem[];
    if (!agentsList || agentsList.length === 0) continue;

    // Check if migration is needed
    const needsMigration = agentsList.some(
      (agent) => agent.default_temperature !== undefined || !agent.model_settings
    );

    if (!needsMigration) continue;

    const migratedAgentsList = agentsList.map((agent) =>
      migrateAgentSettings(agent, modelSettingsSchema, defaultModelId)
    );

    await db
      .update(chatbots)
      .set({
        agentsList: migratedAgentsList,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, chatbot.id));

    chatbotsUpdated++;
    console.log(`  Updated chatbot: ${chatbot.name} (${chatbot.id})`);
  }

  console.log(`  Total chatbots updated: ${chatbotsUpdated}/${allChatbots.length}\n`);

  // Migrate chatbot packages
  console.log("Migrating chatbot packages...");
  const allPackages = await db.select().from(chatbotPackages);
  let packagesUpdated = 0;

  for (const pkg of allPackages) {
    const agentsList = pkg.agentsList as OldAgentListItem[];
    if (!agentsList || agentsList.length === 0) continue;

    // Check if migration is needed
    const needsMigration = agentsList.some(
      (agent) => agent.default_temperature !== undefined || !agent.model_settings
    );

    if (!needsMigration) continue;

    const migratedAgentsList = agentsList.map((agent) =>
      migrateAgentSettings(agent, modelSettingsSchema, defaultModelId)
    );

    await db
      .update(chatbotPackages)
      .set({
        agentsList: migratedAgentsList,
        updatedAt: new Date(),
      })
      .where(eq(chatbotPackages.id, pkg.id));

    packagesUpdated++;
    console.log(`  Updated package: ${pkg.name} (${pkg.id})`);
  }

  console.log(`  Total packages updated: ${packagesUpdated}/${allPackages.length}\n`);

  console.log("Migration complete!");
  console.log(`Summary:`);
  console.log(`  - Chatbots updated: ${chatbotsUpdated}`);
  console.log(`  - Packages updated: ${packagesUpdated}`);

  await client.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
