import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Starting migration...");

  try {
    // Drop all tables in chatapp schema
    console.log("Dropping chatapp schema tables...");

    await db.execute(sql`
      DROP TABLE IF EXISTS chatapp.escalations CASCADE;
      DROP TABLE IF EXISTS chatapp.escalation_assignments CASCADE;
      DROP TABLE IF EXISTS chatapp.customer_sessions CASCADE;
      DROP TABLE IF EXISTS chatapp.messages CASCADE;
      DROP TABLE IF EXISTS chatapp.conversations CASCADE;
      DROP TABLE IF EXISTS chatapp.customers CASCADE;
      DROP TABLE IF EXISTS chatapp.knowledge_embeddings CASCADE;
      DROP TABLE IF EXISTS chatapp.knowledge_chunks CASCADE;
      DROP TABLE IF EXISTS chatapp.knowledge_sources CASCADE;
      DROP TABLE IF EXISTS chatapp.agent_channels CASCADE;
      DROP TABLE IF EXISTS chatapp.agent_versions CASCADE;
      DROP TABLE IF EXISTS chatapp.agents CASCADE;
      DROP TABLE IF EXISTS chatapp.agent_packages CASCADE;
      DROP TABLE IF EXISTS chatapp.widget_configs CASCADE;
      DROP TABLE IF EXISTS chatapp.integrations CASCADE;
      DROP TABLE IF EXISTS chatapp.webhooks CASCADE;
      DROP TABLE IF EXISTS chatapp.invitations CASCADE;
      DROP TABLE IF EXISTS chatapp.audit_logs CASCADE;
      DROP TABLE IF EXISTS chatapp.api_keys CASCADE;
      DROP TABLE IF EXISTS chatapp.rate_limits CASCADE;
      DROP TABLE IF EXISTS chatapp.usage_records CASCADE;
      DROP TABLE IF EXISTS chatapp.channel_configs CASCADE;
      DROP TABLE IF EXISTS chatapp.payment_history CASCADE;
      DROP TABLE IF EXISTS chatapp.company_subscriptions CASCADE;
      DROP TABLE IF EXISTS chatapp.subscription_plans CASCADE;
      DROP TABLE IF EXISTS chatapp.magic_link_tokens CASCADE;
      DROP TABLE IF EXISTS chatapp.device_sessions CASCADE;
      DROP TABLE IF EXISTS chatapp.verification_tokens CASCADE;
      DROP TABLE IF EXISTS chatapp.sessions CASCADE;
      DROP TABLE IF EXISTS chatapp.accounts CASCADE;
      DROP TABLE IF EXISTS chatapp.users CASCADE;
      DROP TABLE IF EXISTS chatapp.companies CASCADE;
      DROP TABLE IF EXISTS chatapp.company_permissions CASCADE;
      DROP TABLE IF EXISTS chatapp.conversation_analytics CASCADE;
      DROP TABLE IF EXISTS chatapp.agent_analytics CASCADE;
      DROP TABLE IF EXISTS chatapp.daily_analytics CASCADE;
    `);

    console.log("Dropping existing enums...");
    await db.execute(sql`DROP TYPE IF EXISTS public.user_role CASCADE`);
    await db.execute(sql`DROP TYPE IF EXISTS public.company_permission_role CASCADE`);

    console.log("Creating new enums...");
    await db.execute(sql`CREATE TYPE public.user_role AS ENUM ('chatapp.master_admin', 'chatapp.user')`);
    await db.execute(sql`CREATE TYPE public.company_permission_role AS ENUM ('chatapp.company_admin', 'chatapp.support_agent')`);

    console.log("Migration completed successfully!");
    console.log("Now run: pnpm drizzle-kit push");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch(console.error);
