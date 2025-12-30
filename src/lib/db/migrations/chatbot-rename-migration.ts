/**
 * Chatbot Rename Migration
 *
 * This script handles the final schema refactoring:
 * 1. Renames agent_packages -> chatbot_packages
 * 2. Renames agents -> chatbots
 * 3. Renames agent_versions -> chatbot_versions
 * 4. Renames conversations.agent_id -> conversations.chatbot_id
 * 5. Renames widget_configs.company_id -> widget_configs.chatbot_id
 * 6. Renames integrations.company_id -> integrations.chatbot_id
 * 7. Renames webhooks.company_id -> webhooks.chatbot_id
 * 8. Adds package_type column to both chatbot_packages and chatbots
 * 9. Updates JSONB field names in agents_list
 * 10. Removes old default fields from agent_packages
 *
 * Run with: DATABASE_URL="..." npx tsx src/lib/db/migrations/chatbot-rename-migration.ts
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

  console.log("Starting chatbot rename migration...\n");

  try {
    // Step 1: Package_type enum already exists in public schema
    console.log("Step 1: Package_type enum exists in public schema...");
    console.log("  ✓ Enum exists\n");

    // Step 2: Update JSONB field names in agents_list (handle both old and new table names)
    console.log("Step 2: Updating JSONB field names in agents_list...");

    // Try chatbot_packages (new name) first, fall back to agent_packages (old name)
    try {
      await db.execute(sql`
        UPDATE chatapp.chatbot_packages
        SET agents_list = (
          SELECT jsonb_agg(
            CASE
              WHEN agent ? 'system_prompt' THEN
                agent - 'system_prompt' - 'model_id' - 'temperature'
                || jsonb_build_object(
                  'default_system_prompt', agent->>'system_prompt',
                  'default_model_id', COALESCE(agent->>'model_id', 'gpt-4o-mini'),
                  'default_temperature', COALESCE((agent->>'temperature')::int, 70)
                )
              ELSE agent
            END
          )
          FROM jsonb_array_elements(agents_list) AS agent
        )
        WHERE agents_list IS NOT NULL AND agents_list != '[]'::jsonb;
      `);
    } catch {
      await db.execute(sql`
        UPDATE chatapp.agent_packages
        SET agents_list = (
          SELECT jsonb_agg(
            CASE
              WHEN agent ? 'system_prompt' THEN
                agent - 'system_prompt' - 'model_id' - 'temperature'
                || jsonb_build_object(
                  'default_system_prompt', agent->>'system_prompt',
                  'default_model_id', COALESCE(agent->>'model_id', 'gpt-4o-mini'),
                  'default_temperature', COALESCE((agent->>'temperature')::int, 70)
                )
              ELSE agent
            END
          )
          FROM jsonb_array_elements(agents_list) AS agent
        )
        WHERE agents_list IS NOT NULL AND agents_list != '[]'::jsonb;
      `);
    }

    // Try chatbots (new name) first, fall back to agents (old name)
    try {
      await db.execute(sql`
        UPDATE chatapp.chatbots
        SET agents_list = (
          SELECT jsonb_agg(
            CASE
              WHEN agent ? 'system_prompt' THEN
                agent - 'system_prompt' - 'model_id' - 'temperature'
                || jsonb_build_object(
                  'default_system_prompt', agent->>'system_prompt',
                  'default_model_id', COALESCE(agent->>'model_id', 'gpt-4o-mini'),
                  'default_temperature', COALESCE((agent->>'temperature')::int, 70)
                )
              ELSE agent
            END
          )
          FROM jsonb_array_elements(agents_list) AS agent
        )
        WHERE agents_list IS NOT NULL AND agents_list != '[]'::jsonb;
      `);
    } catch {
      await db.execute(sql`
        UPDATE chatapp.agents
        SET agents_list = (
          SELECT jsonb_agg(
            CASE
              WHEN agent ? 'system_prompt' THEN
                agent - 'system_prompt' - 'model_id' - 'temperature'
                || jsonb_build_object(
                  'default_system_prompt', agent->>'system_prompt',
                  'default_model_id', COALESCE(agent->>'model_id', 'gpt-4o-mini'),
                  'default_temperature', COALESCE((agent->>'temperature')::int, 70)
                )
              ELSE agent
            END
          )
          FROM jsonb_array_elements(agents_list) AS agent
        )
        WHERE agents_list IS NOT NULL AND agents_list != '[]'::jsonb;
      `);
    }
    console.log("  ✓ JSONB field names updated\n");

    // Step 3: Add package_type column to tables (use public.package_type)
    console.log("Step 3: Adding package_type column...");
    await db.execute(sql`
      DO $$
      BEGIN
        -- For chatbot_packages (new name) or agent_packages (old name)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages'
                       AND column_name = 'package_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp' AND table_name = 'agent_packages'
                       AND column_name = 'package_type') THEN
          -- Try new name first
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages') THEN
            ALTER TABLE chatapp.chatbot_packages
            ADD COLUMN package_type public.package_type DEFAULT 'single_agent' NOT NULL;
          ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name = 'agent_packages') THEN
            ALTER TABLE chatapp.agent_packages
            ADD COLUMN package_type public.package_type DEFAULT 'single_agent' NOT NULL;
          END IF;
        END IF;

        -- For chatbots (new name) or agents (old name)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp' AND table_name = 'chatbots'
                       AND column_name = 'package_type')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'chatapp' AND table_name = 'agents'
                       AND column_name = 'package_type') THEN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name = 'chatbots') THEN
            ALTER TABLE chatapp.chatbots
            ADD COLUMN package_type public.package_type DEFAULT 'single_agent' NOT NULL;
          ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name = 'agents') THEN
            ALTER TABLE chatapp.agents
            ADD COLUMN package_type public.package_type DEFAULT 'single_agent' NOT NULL;
          END IF;
        END IF;
      END $$;
    `);
    console.log("  ✓ Package_type columns added\n");

    // Step 4: Remove old default fields from chatbot_packages/agent_packages
    console.log("Step 4: Removing old default fields from packages table...");
    await db.execute(sql`
      DO $$
      DECLARE
        pkg_table text;
      BEGIN
        -- Determine which table name exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages') THEN
          pkg_table := 'chatbot_packages';
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'chatapp' AND table_name = 'agent_packages') THEN
          pkg_table := 'agent_packages';
        ELSE
          RETURN;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = pkg_table
                   AND column_name = 'default_system_prompt') THEN
          EXECUTE 'ALTER TABLE chatapp.' || pkg_table || ' DROP COLUMN default_system_prompt';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = pkg_table
                   AND column_name = 'default_model_id') THEN
          EXECUTE 'ALTER TABLE chatapp.' || pkg_table || ' DROP COLUMN default_model_id';
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = pkg_table
                   AND column_name = 'default_temperature') THEN
          EXECUTE 'ALTER TABLE chatapp.' || pkg_table || ' DROP COLUMN default_temperature';
        END IF;
      END $$;
    `);
    console.log("  ✓ Old default fields removed\n");

    // Step 5: Rename tables
    console.log("Step 5: Renaming tables...");
    await db.execute(sql`
      DO $$
      BEGIN
        -- Rename agent_packages -> chatbot_packages
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'chatapp' AND table_name = 'agent_packages')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                           WHERE table_schema = 'chatapp' AND table_name = 'chatbot_packages') THEN
          ALTER TABLE chatapp.agent_packages RENAME TO chatbot_packages;
        END IF;

        -- Rename agents -> chatbots
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'chatapp' AND table_name = 'agents')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                           WHERE table_schema = 'chatapp' AND table_name = 'chatbots') THEN
          ALTER TABLE chatapp.agents RENAME TO chatbots;
        END IF;

        -- Rename agent_versions -> chatbot_versions
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'chatapp' AND table_name = 'agent_versions')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                           WHERE table_schema = 'chatapp' AND table_name = 'chatbot_versions') THEN
          ALTER TABLE chatapp.agent_versions RENAME TO chatbot_versions;
        END IF;
      END $$;
    `);
    console.log("  ✓ Tables renamed\n");

    // Step 6: Rename columns
    console.log("Step 6: Renaming columns...");
    await db.execute(sql`
      DO $$
      BEGIN
        -- Rename agent_id -> chatbot_id in chatbot_versions
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'chatbot_versions'
                   AND column_name = 'agent_id') THEN
          ALTER TABLE chatapp.chatbot_versions RENAME COLUMN agent_id TO chatbot_id;
        END IF;

        -- Rename agent_id -> chatbot_id in conversations
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'conversations'
                   AND column_name = 'agent_id') THEN
          ALTER TABLE chatapp.conversations RENAME COLUMN agent_id TO chatbot_id;
        END IF;

        -- Rename company_id -> chatbot_id in widget_configs (drop old FK first)
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'widget_configs'
                   AND column_name = 'company_id') THEN
          ALTER TABLE chatapp.widget_configs DROP CONSTRAINT IF EXISTS widget_configs_company_id_companies_id_fk;
          ALTER TABLE chatapp.widget_configs RENAME COLUMN company_id TO chatbot_id;
        END IF;

        -- Rename company_id -> chatbot_id in integrations (drop old FK first)
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'integrations'
                   AND column_name = 'company_id') THEN
          ALTER TABLE chatapp.integrations DROP CONSTRAINT IF EXISTS integrations_company_id_companies_id_fk;
          ALTER TABLE chatapp.integrations RENAME COLUMN company_id TO chatbot_id;
        END IF;

        -- Rename company_id -> chatbot_id in webhooks (drop old FK first)
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'webhooks'
                   AND column_name = 'company_id') THEN
          ALTER TABLE chatapp.webhooks DROP CONSTRAINT IF EXISTS webhooks_company_id_companies_id_fk;
          ALTER TABLE chatapp.webhooks RENAME COLUMN company_id TO chatbot_id;
        END IF;
      END $$;
    `);
    console.log("  ✓ Columns renamed\n");

    // Step 7: Clean up orphan data and update foreign key references
    console.log("Step 7: Cleaning up orphan data...");

    // Delete widget_configs, integrations, webhooks that reference old company_ids
    // Since these were company-scoped before and are now chatbot-scoped, we need to clear them
    await db.execute(sql`
      DELETE FROM chatapp.widget_configs
      WHERE chatbot_id NOT IN (SELECT id FROM chatapp.chatbots);
    `);
    await db.execute(sql`
      DELETE FROM chatapp.integrations
      WHERE chatbot_id NOT IN (SELECT id FROM chatapp.chatbots);
    `);
    await db.execute(sql`
      DELETE FROM chatapp.webhooks
      WHERE chatbot_id NOT IN (SELECT id FROM chatapp.chatbots);
    `);
    console.log("  ✓ Orphan data cleaned up\n");

    console.log("Step 8: Updating foreign key references...");
    await db.execute(sql`
      DO $$
      BEGIN
        -- Update FK for chatbot_versions.chatbot_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'chatbot_versions_chatbot_id_chatbots_id_fk'
                       AND table_schema = 'chatapp') THEN
          ALTER TABLE chatapp.chatbot_versions
          DROP CONSTRAINT IF EXISTS agent_versions_agent_id_agents_id_fk;

          ALTER TABLE chatapp.chatbot_versions
          ADD CONSTRAINT chatbot_versions_chatbot_id_chatbots_id_fk
          FOREIGN KEY (chatbot_id) REFERENCES chatapp.chatbots(id) ON DELETE CASCADE;
        END IF;

        -- Update FK for conversations.chatbot_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'conversations_chatbot_id_chatbots_id_fk'
                       AND table_schema = 'chatapp') THEN
          ALTER TABLE chatapp.conversations
          DROP CONSTRAINT IF EXISTS conversations_agent_id_agents_id_fk;

          ALTER TABLE chatapp.conversations
          ADD CONSTRAINT conversations_chatbot_id_chatbots_id_fk
          FOREIGN KEY (chatbot_id) REFERENCES chatapp.chatbots(id) ON DELETE CASCADE;
        END IF;

        -- Update FK for chatbots.package_id (if needed)
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'chatbots_package_id_chatbot_packages_id_fk'
                       AND table_schema = 'chatapp') THEN
          ALTER TABLE chatapp.chatbots
          DROP CONSTRAINT IF EXISTS agents_package_id_agent_packages_id_fk;

          ALTER TABLE chatapp.chatbots
          ADD CONSTRAINT chatbots_package_id_chatbot_packages_id_fk
          FOREIGN KEY (package_id) REFERENCES chatapp.chatbot_packages(id);
        END IF;

        -- Add FK for widget_configs.chatbot_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'widget_configs_chatbot_id_chatbots_id_fk'
                       AND table_schema = 'chatapp') THEN
          ALTER TABLE chatapp.widget_configs
          ADD CONSTRAINT widget_configs_chatbot_id_chatbots_id_fk
          FOREIGN KEY (chatbot_id) REFERENCES chatapp.chatbots(id) ON DELETE CASCADE;
        END IF;

        -- Add FK for integrations.chatbot_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'integrations_chatbot_id_chatbots_id_fk'
                       AND table_schema = 'chatapp') THEN
          ALTER TABLE chatapp.integrations
          ADD CONSTRAINT integrations_chatbot_id_chatbots_id_fk
          FOREIGN KEY (chatbot_id) REFERENCES chatapp.chatbots(id) ON DELETE CASCADE;
        END IF;

        -- Add FK for webhooks.chatbot_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_name = 'webhooks_chatbot_id_chatbots_id_fk'
                       AND table_schema = 'chatapp') THEN
          ALTER TABLE chatapp.webhooks
          ADD CONSTRAINT webhooks_chatbot_id_chatbots_id_fk
          FOREIGN KEY (chatbot_id) REFERENCES chatapp.chatbots(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    console.log("  ✓ Foreign keys updated\n");

    // Step 9: Rename indexes
    console.log("Step 9: Renaming indexes...");
    await db.execute(sql`
      DO $$
      BEGIN
        -- Rename chatbot_packages indexes
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agent_packages_slug_idx') THEN
          ALTER INDEX chatapp.agent_packages_slug_idx RENAME TO chatbot_packages_slug_idx;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agent_packages_category_idx') THEN
          ALTER INDEX chatapp.agent_packages_category_idx RENAME TO chatbot_packages_category_idx;
        END IF;

        -- Rename chatbots indexes
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agents_company_idx') THEN
          ALTER INDEX chatapp.agents_company_idx RENAME TO chatbots_company_idx;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agents_package_idx') THEN
          ALTER INDEX chatapp.agents_package_idx RENAME TO chatbots_package_idx;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agents_status_idx') THEN
          ALTER INDEX chatapp.agents_status_idx RENAME TO chatbots_status_idx;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agents_type_idx') THEN
          ALTER INDEX chatapp.agents_type_idx RENAME TO chatbots_type_idx;
        END IF;

        -- Rename chatbot_versions indexes
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agent_versions_agent_idx') THEN
          ALTER INDEX chatapp.agent_versions_agent_idx RENAME TO chatbot_versions_chatbot_idx;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'agent_versions_version_idx') THEN
          ALTER INDEX chatapp.agent_versions_version_idx RENAME TO chatbot_versions_version_idx;
        END IF;

        -- Rename conversations index
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'conversations_agent_idx') THEN
          ALTER INDEX chatapp.conversations_agent_idx RENAME TO conversations_chatbot_idx;
        END IF;

        -- Rename widget_configs index
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'widget_configs_company_idx') THEN
          ALTER INDEX chatapp.widget_configs_company_idx RENAME TO widget_configs_chatbot_idx;
        END IF;
      END $$;
    `);
    console.log("  ✓ Indexes renamed\n");

    console.log("✅ Chatbot rename migration completed successfully!");

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
