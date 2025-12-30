/**
 * Update agent routing prompts for proper multi-agent routing
 */
import { db } from "../src/lib/db";
import { chatbots, type AgentListItem } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const CHATBOT_ID = "c00473b0-541f-4429-b47f-10d74013278c";

async function updateRoutingPrompts() {
  console.log("=== Updating Agent Routing Prompts ===\n");

  // 1. Fetch chatbot
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(eq(chatbots.id, CHATBOT_ID))
    .limit(1);

  if (!chatbot) {
    console.error("Chatbot not found!");
    process.exit(1);
  }

  const agentsList = (chatbot.agentsList as AgentListItem[]) || [];

  // 2. Update routing prompts
  const updatedAgents = agentsList.map(agent => {
    if (agent.agent_identifier === "salesman") {
      return {
        ...agent,
        routing_prompt: "Handles product inquiries, product listings, pricing questions, and sales-related requests. Use for questions about what products are available, product details, or purchasing.",
        designation: "Sales Representative",
      };
    } else if (agent.agent_identifier === "accounts") {
      return {
        ...agent,
        routing_prompt: "Handles billing inquiries, payment issues, account management, and invoicing questions. Use for questions about payments, subscriptions, or account status.",
        designation: "Accounts Specialist",
      };
    } else if (agent.agent_identifier === "orchestrator") {
      return {
        ...agent,
        designation: "Customer Support Orchestrator",
      };
    }
    return agent;
  });

  // 3. Save updated agents list
  await db
    .update(chatbots)
    .set({ agentsList: updatedAgents })
    .where(eq(chatbots.id, CHATBOT_ID));

  console.log("Updated agents:");
  for (const agent of updatedAgents) {
    console.log(`  - ${agent.name} (${agent.agent_identifier})`);
    console.log(`    Designation: ${agent.designation || "(none)"}`);
    console.log(`    Routing Prompt: ${agent.routing_prompt || "(none)"}`);
    console.log();
  }

  console.log("=== Done ===");
  process.exit(0);
}

updateRoutingPrompts().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
