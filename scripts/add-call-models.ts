/**
 * Script to add call models to an existing database
 * Run with: npx tsx scripts/add-call-models.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

async function addCallModels() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("Adding call models...\n");

  try {
    // Check if call models already exist
    const existingModels = await db
      .select()
      .from(schema.aiModels)
      .where(eq(schema.aiModels.modelType, "call"));

    if (existingModels.length > 0) {
      console.log(`Found ${existingModels.length} existing call models:`);
      existingModels.forEach((m) => console.log(`  - ${m.displayName} (${m.modelId})`));
      console.log("\nSkipping creation of call models.");
    } else {
      // Add the call models
      const callModels = await db
        .insert(schema.aiModels)
        .values([
          // OpenAI Realtime API
          {
            provider: "openai",
            modelId: "gpt-4o-realtime-preview-2024-10-01",
            displayName: "GPT-4o Realtime",
            description: "OpenAI's real-time voice model with low latency for voice calls",
            modelType: "call",
            supportsAudio: true,
            inputLimit: 128000,
            outputLimit: 4096,
            inputPricePerMillion: "5.0000",
            outputPricePerMillion: "20.0000",
            settingsSchema: {
              voice: {
                type: "select",
                options: ["alloy", "echo", "shimmer", "ash", "ballad", "coral", "sage", "verse"],
                default: "alloy",
                label: "Voice",
                description: "The voice to use for audio responses",
              },
              vad_threshold: {
                type: "slider",
                min: 0,
                max: 1,
                step: 0.05,
                default: 0.5,
                label: "VAD Threshold",
                description: "Voice activity detection sensitivity",
              },
              silence_duration_ms: {
                type: "number",
                min: 100,
                max: 2000,
                default: 500,
                label: "Silence Duration (ms)",
                description: "Silence duration before end of turn",
              },
            },
            isActive: true,
            isDefault: false,
            sortOrder: 20,
          },
          // Google Gemini Live API
          {
            provider: "google",
            modelId: "gemini-2.0-flash-exp",
            displayName: "Gemini 2.0 Flash Live",
            description: "Google's real-time voice model with multimodal support",
            modelType: "call",
            supportsAudio: true,
            inputLimit: 1000000,
            outputLimit: 8192,
            inputPricePerMillion: "0.0750",
            outputPricePerMillion: "0.3000",
            settingsSchema: {
              voice: {
                type: "select",
                options: ["Puck", "Charon", "Kore", "Fenrir", "Aoede"],
                default: "Puck",
                label: "Voice",
                description: "The voice to use for audio responses",
              },
              vad_sensitivity: {
                type: "slider",
                min: 0,
                max: 1,
                step: 0.1,
                default: 0.5,
                label: "VAD Sensitivity",
                description: "Voice activity detection sensitivity",
              },
            },
            isActive: true,
            isDefault: false,
            sortOrder: 21,
          },
        ])
        .returning();

      console.log(`Created ${callModels.length} call models:`);
      callModels.forEach((m) => console.log(`  - ${m.displayName} (${m.modelId})`));
    }

    // Update existing chat models to have explicit modelType="chat"
    console.log("\nUpdating existing models with modelType='chat'...");
    const updated = await db
      .update(schema.aiModels)
      .set({ modelType: "chat" })
      .where(eq(schema.aiModels.modelType, "chat"))
      .returning();

    console.log(`Updated ${updated.length} chat models.`);

    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addCallModels().catch((error) => {
  console.error(error);
  process.exit(1);
});
