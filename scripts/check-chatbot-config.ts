import { db } from "../src/lib/db";
import { chatbots } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const CHATBOT_ID = "c00473b0-541f-4429-b47f-10d74013278c";

  const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.id, CHATBOT_ID));

  if (!chatbot) {
    console.log("Chatbot not found");
    process.exit(1);
  }

  console.log("Chatbot:", chatbot.name);
  console.log("Package ID:", chatbot.packageId);
  console.log("\nAgents list:");
  const agents = chatbot.agentsList as any[];
  for (const agent of agents) {
    console.log(`\n  ${agent.name} (${agent.agent_identifier})`);
    console.log(`    Type: ${agent.agent_type}`);
    console.log(`    KB Enabled: ${agent.knowledge_base_enabled}`);
    console.log(`    KB Categories: ${JSON.stringify(agent.knowledge_categories)}`);
    console.log(`    Routing Prompt: ${agent.routing_prompt ?? "(none)"}`);
  }

  process.exit(0);
}

main().catch(console.error);
