/**
 * Test script for the chatbot ADK executor
 */

import { createAdkExecutor } from "../src/lib/ai/execution/adk-executor";
import { createVariableContext } from "../src/lib/ai/types";

async function main() {
  console.log("=".repeat(60));
  console.log("Testing Chatbot ADK Executor");
  console.log("=".repeat(60));

  // Create variable context (simulating what comes from DB)
  const varContext = createVariableContext([
    { name: "COMPANY_NAME", value: "TechCorp", variableType: "variable", dataType: "string" },
    { name: "SALES_EMAIL", value: "sales@techcorp.com", variableType: "variable", dataType: "string" },
  ]);

  // Create the ADK executor
  const executor = createAdkExecutor({
    chatbotId: "c00473b0-541f-4429-b47f-10d74013278c",
    companyId: "cb573c62-09ce-4969-a4d3-9c74ea612af8",
    packageId: "1c33f609-ae08-4340-9dbb-e82cebed608a",
    agentConfig: {
      systemPrompt: `You are a helpful sales assistant for TechCorp.
You help customers learn about our products and services.
We sell various tech products including:
- Apple products (iPhones, iPads, MacBooks, Apple Watch, AirPods)
- Samsung products (Galaxy phones, tablets)
- Microsoft products (Surface, Xbox)
- Accessories and peripherals

Be friendly, helpful, and informative. When asked about products, provide details about what we offer.`,
      modelId: "gpt-4o-mini",
      temperature: 70,
      knowledgeBaseEnabled: false,
      knowledgeCategories: [],
    },
  });

  // Initialize the executor
  console.log("\n📦 Initializing ADK executor...");
  const initialized = executor.initialize();

  if (!initialized) {
    console.error("❌ Failed to initialize package executor");
    process.exit(1);
  }

  const pkgInfo = executor.getPackageInfo();
  console.log("✅ Package loaded:", pkgInfo);

  // Build context for the request
  const testSessionId = crypto.randomUUID();
  const context = {
    conversationId: testSessionId,
    companyId: "cb573c62-09ce-4969-a4d3-9c74ea612af8",
    agentId: "c00473b0-541f-4429-b47f-10d74013278c",
    requestId: crypto.randomUUID(),
    message: "list all apple products",
    endUserId: "test-user",
    channel: "web" as const,
    timestamp: new Date(),
    variables: varContext.variables,
    securedVariables: varContext.securedVariables,
  };

  console.log("\n💬 Sending message: 'list all apple products'");
  console.log("-".repeat(60));

  // Process the message with streaming
  let fullContent = "";

  try {
    for await (const event of executor.processMessageStream({
      message: "list all apple products",
      sessionId: testSessionId,
      context,
    })) {
      switch (event.type) {
        case "thinking":
          const thinkingData = event.data as { step: string; progress: number };
          console.log(`🧠 Thinking: ${thinkingData.step} (${Math.round(thinkingData.progress * 100)}%)`);
          break;
        case "tool_call":
          const toolData = event.data as { toolName: string; status: string };
          console.log(`🔧 Tool: ${toolData.toolName} - ${toolData.status}`);
          break;
        case "delta":
          const deltaData = event.data as { content: string };
          process.stdout.write(deltaData.content);
          fullContent += deltaData.content;
          break;
        case "complete":
          const completeData = event.data as { content: string; metadata?: Record<string, unknown> };
          if (!fullContent) {
            fullContent = completeData.content;
            console.log(fullContent);
          }
          console.log("\n" + "-".repeat(60));
          console.log("✅ Complete!");
          if (completeData.metadata) {
            console.log("📊 Metadata:", JSON.stringify(completeData.metadata, null, 2));
          }
          break;
        case "error":
          const errorData = event.data as { message: string };
          console.error("❌ Error:", errorData.message);
          break;
      }
    }
  } catch (error) {
    console.error("❌ Error processing message:", error);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test complete!");
  console.log("=".repeat(60));
}

main().catch(console.error);
