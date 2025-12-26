import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

async function createTables() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("Creating tables from schema...");

  try {
    // Use drizzle-kit push style approach - just run drizzle-kit push
    console.log("Please run: pnpm drizzle-kit push --force");
    console.log("\nOr manually import and sync tables.");
  } finally {
    await client.end();
  }
}

createTables().catch(console.error);
