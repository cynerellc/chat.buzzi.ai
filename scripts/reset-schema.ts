/**
 * Reset chatapp schema - drops all tables and recreates them
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

async function resetSchema() {
  console.log("Dropping chatapp schema...");
  await db.execute(sql`DROP SCHEMA IF EXISTS chatapp CASCADE`);

  console.log("Dropping all enum types in public schema...");
  // Query for all enum types in public schema and drop them
  const enumTypesResult = await db.execute(sql`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.typtype = 'e'
  `);

  const enumTypes = enumTypesResult as { typname: string }[];
  for (const { typname } of enumTypes) {
    console.log(`  Dropping type: ${typname}`);
    await db.execute(sql.raw(`DROP TYPE IF EXISTS public."${typname}" CASCADE`));
  }

  console.log("Creating chatapp schema...");
  await db.execute(sql`CREATE SCHEMA chatapp`);

  console.log("Schema reset complete. Run pnpm db:push to recreate tables.");
}

resetSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to reset schema:", error);
    process.exit(1);
  });
