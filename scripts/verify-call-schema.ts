/**
 * Script to verify call feature schema and models
 * Run with: npx tsx scripts/verify-call-schema.ts
 */

import "dotenv/config";
import postgres from "postgres";

async function verify() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    // Check ai_models
    const models = await sql`
      SELECT display_name, model_type, supports_audio
      FROM chatapp.ai_models
      ORDER BY sort_order
    `;
    console.log("AI Models:");
    models.forEach((m) =>
      console.log("  -", m.display_name, "| type:", m.model_type, "| audio:", m.supports_audio)
    );

    // Check tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'chatapp'
      AND table_name IN ('calls', 'call_transcripts', 'integration_accounts')
      ORDER BY table_name
    `;
    console.log("\nCall tables created:", tables.map((t) => t.table_name).join(", "));

    // Check enum types
    const enums = await sql`
      SELECT typname FROM pg_type
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'chatapp')
      AND typtype = 'e'
      AND typname LIKE 'call%' OR typname = 'ai_model_type' OR typname = 'integration_account_provider'
      ORDER BY typname
    `;
    console.log("\nCall-related enums:", enums.map((e) => e.typname).join(", "));

    console.log("\n✅ Verification complete!");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

verify().catch((error) => {
  console.error(error);
  process.exit(1);
});
