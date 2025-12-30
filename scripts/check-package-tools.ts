import { db } from "../src/lib/db";
import { chatbotPackages } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const PACKAGE_ID = "1c33f609-ae08-4340-9dbb-e82cebed608a";

  const [pkg] = await db.select().from(chatbotPackages).where(eq(chatbotPackages.id, PACKAGE_ID));

  if (!pkg) {
    console.log("Package not found");
    process.exit(1);
  }

  console.log("Package:", pkg.name);
  console.log("Type:", pkg.packageType);
  console.log("\nTools config:", JSON.stringify(pkg.toolsConfig, null, 2));
  console.log("\nAgents list:");
  const agents = pkg.agentsList as any[];
  for (const agent of agents) {
    console.log(`  - ${agent.name} (${agent.agent_identifier})`);
    console.log(`    KB Enabled: ${agent.knowledge_base_enabled}`);
    console.log(`    KB Categories: ${JSON.stringify(agent.knowledge_categories)}`);
  }

  process.exit(0);
}

main().catch(console.error);
