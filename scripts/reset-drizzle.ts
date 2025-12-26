import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function resetDrizzle() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Resetting drizzle migration state...");

  try {
    // Drop drizzle migrations table to reset migration state
    await db.execute(sql`DROP TABLE IF EXISTS drizzle.__drizzle_migrations`);
    console.log("Dropped drizzle migrations table");

    // Ensure the chatapp schema exists
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS chatapp`);
    console.log("Ensured chatapp schema exists");

    console.log("\nNow run: pnpm drizzle-kit push --force");
  } catch (error) {
    console.error("Reset failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

resetDrizzle().catch(console.error);
