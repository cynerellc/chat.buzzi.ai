/**
 * Migration script to add package_agents table and update agent_packages table
 * Run with: DATABASE_URL="..." npx tsx scripts/migrate-package-agents.ts
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function migrate() {
  console.log("Starting migration...");

  try {
    // Step 1: Create the enums if they don't exist
    console.log("Creating enums...");

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE public.package_type AS ENUM ('single_agent', 'multi_agent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE public.package_agent_type AS ENUM ('worker', 'supervisor');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("✓ Enums created");

    // Step 2: Add new columns to agent_packages table
    console.log("Adding columns to agent_packages...");

    // Add package_type column
    await db.execute(sql`
      ALTER TABLE chatapp.agent_packages
      ADD COLUMN IF NOT EXISTS package_type public.package_type DEFAULT 'single_agent' NOT NULL
    `);

    // Add bundle columns
    await db.execute(sql`
      ALTER TABLE chatapp.agent_packages
      ADD COLUMN IF NOT EXISTS bundle_path varchar(500)
    `);

    await db.execute(sql`
      ALTER TABLE chatapp.agent_packages
      ADD COLUMN IF NOT EXISTS bundle_version varchar(50) DEFAULT '1.0.0'
    `);

    await db.execute(sql`
      ALTER TABLE chatapp.agent_packages
      ADD COLUMN IF NOT EXISTS bundle_checksum varchar(64)
    `);

    // Add execution_config column
    await db.execute(sql`
      ALTER TABLE chatapp.agent_packages
      ADD COLUMN IF NOT EXISTS execution_config jsonb DEFAULT '{"maxExecutionTimeMs":30000,"maxMemoryMb":128,"allowedNetworkDomains":[],"sandboxMode":true}'::jsonb NOT NULL
    `);

    console.log("✓ Columns added to agent_packages");

    // Step 3: Create package_agents table
    console.log("Creating package_agents table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chatapp.package_agents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        package_id uuid NOT NULL REFERENCES chatapp.agent_packages(id) ON DELETE CASCADE,
        agent_identifier varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        designation varchar(255),
        agent_type public.package_agent_type DEFAULT 'worker' NOT NULL,
        system_prompt text NOT NULL,
        model_id varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
        temperature integer DEFAULT 70 NOT NULL,
        tools jsonb DEFAULT '[]'::jsonb NOT NULL,
        managed_agent_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log("✓ package_agents table created");

    // Step 4: Create indexes
    console.log("Creating indexes...");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS package_agents_package_idx ON chatapp.package_agents(package_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS package_agents_identifier_idx ON chatapp.package_agents(package_id, agent_identifier)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS package_agents_type_idx ON chatapp.package_agents(agent_type)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS agent_packages_type_idx ON chatapp.agent_packages(package_type)
    `);

    console.log("✓ Indexes created");

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
