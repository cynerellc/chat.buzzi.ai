/**
 * Test the search_knowledge_base tool in AdkExecutor
 */
import { db } from "../src/lib/db";
import { chatbots, type AgentListItem } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { createAdkExecutor } from "../src/lib/ai/execution/adk-executor";
import { createVariableContext } from "../src/lib/ai/types";
import type { AgentContext } from "../src/lib/ai/types";

const CHATBOT_ID = "c00473b0-541f-4429-b47f-10d74013278c";
const TEST_MESSAGE = "list all apple products";

async function testKBSearchTool() {
  console.log("=== KB Search Tool Test ===\n");
  console.log(`Test message: "${TEST_MESSAGE}"\n`);

  // 1. Fetch chatbot
  const [chatbot] = await db.select().from(chatbots).where(eq(chatbots.id, CHATBOT_ID));

  if (!chatbot) {
    console.error("Chatbot not found!");
    process.exit(1);
  }

  console.log(`Chatbot: ${chatbot.name}`);
  console.log(`Package ID: ${chatbot.packageId}\n`);

  const agentsList = (chatbot.agentsList as AgentListItem[]) || [];
  const primaryAgent = agentsList[0];

  if (!primaryAgent) {
    console.error("No primary agent found!");
    process.exit(1);
  }

  // 2. Create AdkExecutor
  const executor = createAdkExecutor({
    chatbotId: CHATBOT_ID,
    companyId: chatbot.companyId,
    packageId: chatbot.packageId!,
    agentConfig: {
      systemPrompt: primaryAgent.default_system_prompt,
      modelId: primaryAgent.default_model_id,
      temperature: primaryAgent.default_temperature,
      knowledgeBaseEnabled: primaryAgent.knowledge_base_enabled ?? false,
      knowledgeCategories: primaryAgent.knowledge_categories ?? [],
    },
    agentsListConfig: agentsList,
  });

  const varContext = createVariableContext([]);
  const context: AgentContext = {
    conversationId: `test-${Date.now()}`,
    companyId: chatbot.companyId,
    agentId: CHATBOT_ID,
    requestId: crypto.randomUUID(),
    message: TEST_MESSAGE,
    endUserId: "test-user",
    channel: "web",
    timestamp: new Date(),
    variables: varContext.variables,
    securedVariables: varContext.securedVariables,
  };

  // 3. Process message and log events
  console.log("=== Processing Message ===\n");

  const events: string[] = [];
  let fullContent = "";

  for await (const event of executor.processMessageStream({
    message: TEST_MESSAGE,
    sessionId: context.conversationId,
    context,
  })) {
    switch (event.type) {
      case "thinking":
        const thinkData = event.data as { step: string };
        console.log(`[thinking] ${thinkData.step}`);
        events.push(`thinking: ${thinkData.step}`);
        break;
      case "tool_call":
        const toolData = event.data as { toolName: string; status: string; arguments?: unknown; result?: unknown };
        console.log(`[tool_call] ${toolData.toolName} - ${toolData.status}`);
        if (toolData.arguments) {
          console.log(`  Arguments: ${JSON.stringify(toolData.arguments)}`);
        }
        if (toolData.result) {
          const resultStr = JSON.stringify(toolData.result);
          console.log(`  Result: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`);
        }
        events.push(`tool_call: ${toolData.toolName} (${toolData.status})`);
        break;
      case "notification":
        const notifData = event.data as { message: string };
        console.log(`[notification] ${notifData.message}`);
        events.push(`notification: ${notifData.message}`);
        break;
      case "delta":
        const deltaData = event.data as { content: string };
        fullContent += deltaData.content;
        break;
      case "complete":
        const completeData = event.data as { content: string; metadata?: { sources?: Array<{ title: string }>; toolsUsed?: string[] } };
        console.log(`\n[complete]`);
        console.log(`  Tools used: ${completeData.metadata?.toolsUsed?.join(', ') ?? 'none'}`);
        console.log(`  Sources: ${completeData.metadata?.sources?.length ?? 0}`);
        events.push(`complete`);
        break;
      case "error":
        const errorData = event.data as { message: string };
        console.log(`[error] ${errorData.message}`);
        events.push(`error: ${errorData.message}`);
        break;
    }
  }

  console.log("\n=== Event Summary ===");
  events.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  console.log("\n=== Response ===");
  console.log(fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : ''));

  console.log("\n=== Test Complete ===");
  process.exit(0);
}

testKBSearchTool().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
