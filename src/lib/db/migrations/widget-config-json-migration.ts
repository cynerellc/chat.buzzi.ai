/**
 * Widget Configuration JSON System Migration
 *
 * This script:
 * 1. Adds settings JSONB field to chatbots table
 * 2. Adds new widget display option fields to widget_configs
 *
 * Run with: DATABASE_URL="..." npx tsx src/lib/db/migrations/widget-config-json-migration.ts
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Starting widget config JSON migration...\n");

  try {
    // Step 1: Add settings to chatbots
    console.log("Step 1: Adding settings column to chatbots...");
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'chatbots'
                       AND column_name = 'settings') THEN
          ALTER TABLE chatapp.chatbots ADD COLUMN settings JSONB DEFAULT '{}' NOT NULL;
        ELSE
          RAISE NOTICE 'Column settings already exists in chatbots';
        END IF;
      END $$;
    `);
    console.log("  ✓ Settings column added to chatbots\n");

    // Step 2: Add new widget config fields
    console.log("Step 2: Adding new widget config fields...");
    await db.execute(sql`
      DO $$
      BEGIN
        -- Add show_agent_switch_notification
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'widget_configs'
                       AND column_name = 'show_agent_switch_notification') THEN
          ALTER TABLE chatapp.widget_configs
            ADD COLUMN show_agent_switch_notification BOOLEAN DEFAULT true NOT NULL;
        END IF;

        -- Add show_thinking
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'widget_configs'
                       AND column_name = 'show_thinking') THEN
          ALTER TABLE chatapp.widget_configs
            ADD COLUMN show_thinking BOOLEAN DEFAULT false NOT NULL;
        END IF;

        -- Add show_tool_calls
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'widget_configs'
                       AND column_name = 'show_tool_calls') THEN
          ALTER TABLE chatapp.widget_configs
            ADD COLUMN show_tool_calls BOOLEAN DEFAULT false NOT NULL;
        END IF;

        -- Add show_instant_updates
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'widget_configs'
                       AND column_name = 'show_instant_updates') THEN
          ALTER TABLE chatapp.widget_configs
            ADD COLUMN show_instant_updates BOOLEAN DEFAULT true NOT NULL;
        END IF;

        -- Add show_agent_list_on_top
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'widget_configs'
                       AND column_name = 'show_agent_list_on_top') THEN
          ALTER TABLE chatapp.widget_configs
            ADD COLUMN show_agent_list_on_top BOOLEAN DEFAULT true NOT NULL;
        END IF;

        -- Add agent_list_min_cards
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp'
                       AND table_name = 'widget_configs'
                       AND column_name = 'agent_list_min_cards') THEN
          ALTER TABLE chatapp.widget_configs
            ADD COLUMN agent_list_min_cards VARCHAR(10) DEFAULT '3' NOT NULL;
        END IF;
      END $$;
    `);
    console.log("  ✓ New widget config fields added\n");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch((error) => {
  console.error("Migration error:", error);
  process.exit(1);
});
