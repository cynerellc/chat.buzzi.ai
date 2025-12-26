import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

async function verify() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  const email = process.argv[2] || "joseph@buzzi.ai";
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });

  console.log("User found:", user ? {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    isActive: user.isActive,
    hasPassword: !!user.hashedPassword
  } : "NOT FOUND");

  await client.end();
}

verify();
