import { db } from "../src/lib/db";
import { companies } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const result = await db.select().from(companies).where(eq(companies.id, "ba8062be-18d1-45d7-8961-92ef1ce2aeb7"));
  const company = result[0];
  console.log("Company:", company ? { id: company.id, name: company.name, status: company.status, deletedAt: company.deletedAt } : "NOT FOUND");
  process.exit(0);
}

main().catch(console.error);
