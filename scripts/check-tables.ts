import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function checkTables() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Checking tables...");

  try {
    // Check what tables exist in chatapp schema
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'chatapp'
      ORDER BY table_name
    `);

    console.log("Tables in chatapp schema:");
    console.log(tables);

    // Check enums
    const enums = await db.execute(sql`
      SELECT typname, enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      ORDER BY typname, enumlabel
    `);

    console.log("\nEnums:");
    console.log(enums);

  } catch (error) {
    console.error("Check failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

checkTables().catch(console.error);
