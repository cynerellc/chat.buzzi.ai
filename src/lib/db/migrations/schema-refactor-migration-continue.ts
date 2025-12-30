/**
 * Database Schema Refactoring Migration - Continuation
 *
 * This script continues the migration from Step 4 onwards.
 * Steps 1-3 completed successfully in the previous run.
 *
 * Run with: DATABASE_URL="..." npx tsx src/lib/db/migrations/schema-refactor-migration-continue.ts
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

  console.log("Continuing schema refactoring migration from Step 4...\n");

  try {
    // Step 4: Migrate package_agents to agent_packages.agents_list
    console.log("Step 4: Migrating package_agents to agents_list...");

    await db.execute(sql`
      UPDATE chatapp.agent_packages ap
      SET agents_list = (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'agent_identifier', pa.agent_identifier,
            'name', pa.name,
            'designation', pa.designation,
            'agent_type', pa.agent_type,
            'system_prompt', pa.system_prompt,
            'model_id', pa.model_id,
            'temperature', pa.temperature,
            'tools', COALESCE(pa.tools, '[]'),
            'managed_agent_ids', COALESCE(pa.managed_agent_ids, '[]'),
            'sort_order', pa.sort_order
          ) ORDER BY pa.sort_order
        ), '[]')
        FROM chatapp.package_agents pa WHERE pa.package_id = ap.id
      )
      WHERE EXISTS (SELECT 1 FROM chatapp.package_agents pa WHERE pa.package_id = ap.id)
        AND (ap.agents_list IS NULL OR ap.agents_list = '[]'::jsonb);
    `);
    console.log("  ✓ Package agents migrated to agents_list\n");

    // Step 5: Migrate agents config to agents_list
    console.log("Step 5: Migrating agents config to agents_list...");

    await db.execute(sql`
      UPDATE chatapp.agents a
      SET agents_list = CASE
        -- If agent has a package, copy from package
        WHEN a.package_id IS NOT NULL THEN (
          SELECT COALESCE(ap.agents_list, '[]')
          FROM chatapp.agent_packages ap WHERE ap.id = a.package_id
        )
        -- Otherwise, create single agent from existing fields
        ELSE jsonb_build_array(jsonb_build_object(
          'agent_identifier', 'main',
          'name', a.name,
          'agent_type', 'worker',
          'avatar_url', a.avatar_url,
          'system_prompt', COALESCE(a.system_prompt, ''),
          'model_id', COALESCE(a.model_id, 'gpt-4o-mini'),
          'temperature', COALESCE(a.temperature, 70),
          'knowledge_categories', '[]',
          'tools', '[]',
          'sort_order', 0
        ))
      END
      WHERE a.agents_list IS NULL OR a.agents_list = '[]'::jsonb;
    `);
    console.log("  ✓ Agents config migrated to agents_list\n");

    // Step 6: Drop old columns and tables
    console.log("Step 6: Cleaning up old columns and tables...");

    await db.execute(sql`
      DO $$
      BEGIN
        -- Drop old agent columns if they exist
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'agents'
                   AND column_name = 'avatar_url') THEN
          ALTER TABLE chatapp.agents DROP COLUMN avatar_url;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'agents'
                   AND column_name = 'system_prompt') THEN
          ALTER TABLE chatapp.agents DROP COLUMN system_prompt;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'agents'
                   AND column_name = 'model_id') THEN
          ALTER TABLE chatapp.agents DROP COLUMN model_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'agents'
                   AND column_name = 'temperature') THEN
          ALTER TABLE chatapp.agents DROP COLUMN temperature;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'agents'
                   AND column_name = 'knowledge_source_ids') THEN
          ALTER TABLE chatapp.agents DROP COLUMN knowledge_source_ids;
        END IF;

        -- Drop category_id from knowledge_sources
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'chatapp' AND table_name = 'knowledge_sources'
                   AND column_name = 'category_id') THEN
          ALTER TABLE chatapp.knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_category_id_fkey;
          ALTER TABLE chatapp.knowledge_sources DROP COLUMN category_id;
        END IF;

        -- Drop package_agents table
        DROP TABLE IF EXISTS chatapp.package_agents;

        -- Drop knowledge_chunks table
        DROP TABLE IF EXISTS chatapp.knowledge_chunks;

        -- Drop knowledge_categories table
        DROP TABLE IF EXISTS chatapp.knowledge_categories;
      END $$;
    `);
    console.log("  ✓ Old columns and tables removed\n");

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
