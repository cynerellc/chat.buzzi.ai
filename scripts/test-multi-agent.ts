/**
 * Test script to verify multi-agent routing in PackageExecutor
 */
import { db } from "../src/lib/db";
import { chatbots, type AgentListItem } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const CHATBOT_ID = "c00473b0-541f-4429-b47f-10d74013278c";

async function testMultiAgentRouting() {
  console.log("=== Multi-Agent Routing Test ===\n");

  // 1. Fetch chatbot config
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(eq(chatbots.id, CHATBOT_ID))
    .limit(1);

  if (!chatbot) {
    console.error("Chatbot not found!");
    process.exit(1);
  }

  console.log(`Chatbot: ${chatbot.name}`);
  console.log(`Package ID: ${chatbot.packageId}`);

  const agentsList = (chatbot.agentsList as AgentListItem[]) || [];
  console.log(`\nAgents List (${agentsList.length} agents):`);

  for (const agent of agentsList) {
    console.log(`  - ${agent.name} (${agent.agent_identifier})`);
    console.log(`    Type: ${agent.agent_type}`);
    console.log(`    Designation: ${agent.designation || "(none)"}`);
    console.log(`    Routing Prompt: ${agent.routing_prompt || "(none)"}`);
    console.log(`    KB Enabled: ${agent.knowledge_base_enabled ?? false}`);
    console.log(`    KB Categories: ${JSON.stringify(agent.knowledge_categories ?? [])}`);
    console.log();
  }

  // 2. Check multi-agent detection logic
  const hasSupervisor = agentsList.some(a => a.agent_type === "supervisor");
  const workers = agentsList.filter(a => a.agent_type === "worker");

  console.log("=== Multi-Agent Detection ===");
  console.log(`Has supervisor: ${hasSupervisor}`);
  console.log(`Worker count: ${workers.length}`);
  console.log(`Is multi-agent: ${hasSupervisor && workers.length > 0}`);

  if (hasSupervisor && workers.length > 0) {
    console.log("\n=== Transfer Tool Would Be Created ===");
    console.log(`Tool: transfer_to_agent`);
    console.log(`Description: Transfer conversation to specialized agent. Available agents:`);
    for (const w of workers) {
      console.log(`  - ${w.name} (${w.agent_identifier}): ${w.routing_prompt || w.designation || "General support"}`);
    }
    console.log(`Parameters: { target_agent_id: enum[${workers.map(w => `"${w.agent_identifier}"`).join(", ")}], context_summary: string }`);
  } else {
    console.log("\n⚠ Multi-agent routing NOT enabled (no supervisor or no workers)");
  }

  console.log("\n=== Test Complete ===");
  process.exit(0);
}

testMultiAgentRouting().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
