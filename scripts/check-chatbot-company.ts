import { db } from "../src/lib/db";
import { chatbots, companies } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Check chatbot
  const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.id, "c00473b0-541f-4429-b47f-10d74013278c"));
  console.log("Chatbot:", chatbot ? { id: chatbot.id, name: chatbot.name, companyId: chatbot.companyId, deletedAt: chatbot.deletedAt } : "NOT FOUND");

  if (chatbot) {
    // Check if company exists
    const [company] = await db.select().from(companies).where(eq(companies.id, chatbot.companyId));
    console.log("Company:", company ? { id: company.id, name: company.name, status: company.status, deletedAt: company.deletedAt } : "NOT FOUND");
  }

  // List all companies
  const allCompanies = await db.select({ id: companies.id, name: companies.name, status: companies.status }).from(companies).limit(10);
  console.log("All companies:", allCompanies);

  process.exit(0);
}

main().catch(console.error);
