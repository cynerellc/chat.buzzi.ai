/**
 * Test ADK Executor
 *
 * This script tests the ADK executor by:
 * 1. Loading a chatbot
 * 2. Creating a test conversation
 * 3. Sending a test message and streaming the response
 */

import { db } from "@/lib/db";
import { chatbots, chatbotPackages } from "@/lib/db/schema/chatbots";
import { conversations, messages, endUsers } from "@/lib/db/schema/conversations";
import { eq, and, desc } from "drizzle-orm";
import { getAgentRunner } from "@/lib/ai/execution/runner";

// Test chatbot configuration
const CHATBOT_ID = "c00473b0-541f-4429-b47f-10d74013278c";
const COMPANY_ID = "cb573c62-09ce-4969-a4d3-9c74ea612af8";

async function main() {
  console.log("=".repeat(60));
  console.log("ADK Executor Test");
  console.log("=".repeat(60));

  // 1. Load chatbot info
  console.log("\n[1] Loading chatbot...");
  const chatbotData = await db
    .select({
      id: chatbots.id,
      name: chatbots.name,
      companyId: chatbots.companyId,
      packageId: chatbots.packageId,
      packageType: chatbots.packageType,
      agentsList: chatbots.agentsList,
      status: chatbots.status,
      packageSlug: chatbotPackages.slug,
      packageName: chatbotPackages.name,
    })
    .from(chatbots)
    .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
    .where(eq(chatbots.id, CHATBOT_ID))
    .limit(1);

  const chatbot = chatbotData[0];
  if (!chatbot) {
    console.error("Chatbot not found!");
    process.exit(1);
  }

  console.log(`  - Name: ${chatbot.name}`);
  console.log(`  - Package: ${chatbot.packageSlug || chatbot.packageId}`);
  console.log(`  - Type: ${chatbot.packageType}`);
  console.log(`  - Status: ${chatbot.status}`);

  // 2. Get or create conversation
  console.log("\n[2] Getting/creating conversation...");
  const conversationData = await db
    .select()
    .from(conversations)
    .where(and(
      eq(conversations.chatbotId, CHATBOT_ID),
      eq(conversations.status, "active")
    ))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  let conversationId: string;
  if (conversationData.length === 0) {
    console.log("  Creating end user and conversation...");

    // Create end user first
    const [endUser] = await db
      .insert(endUsers)
      .values({
        companyId: COMPANY_ID,
        externalId: "test-user-adk",
        name: "Test User",
        email: "test@example.com",
        channel: "web",
        metadata: { source: "adk-test" },
        lastSeenAt: new Date(),
      })
      .returning();

    if (!endUser) {
      console.error("Failed to create end user");
      process.exit(1);
    }
    console.log(`  Created end user: ${endUser.id}`);

    // Create conversation
    const [conversation] = await db
      .insert(conversations)
      .values({
        companyId: COMPANY_ID,
        chatbotId: CHATBOT_ID,
        endUserId: endUser.id,
        channel: "web",
        status: "active",
        metadata: { test: true },
        lastMessageAt: new Date(),
      })
      .returning();

    if (!conversation) {
      console.error("Failed to create conversation");
      process.exit(1);
    }

    conversationId = conversation.id;
    console.log(`  Created conversation: ${conversationId}`);
  } else {
    conversationId = conversationData[0]!.id;
    console.log(`  Using existing conversation: ${conversationId}`);
  }

  // 3. Get agent runner and test
  console.log("\n[3] Loading executor via AgentRunner...");
  const runner = getAgentRunner();
  const executor = await runner.loadExecutor(CHATBOT_ID);

  if (!executor) {
    console.error("Failed to load executor!");
    process.exit(1);
  }

  const pkgInfo = executor.getPackageInfo();
  console.log(`  - Package ID: ${pkgInfo?.packageId}`);
  console.log(`  - Package Type: ${pkgInfo?.packageType}`);
  console.log(`  - Agent Count: ${pkgInfo?.agentCount}`);

  // 4. Send test message
  console.log("\n[4] Sending test message...");
  const testMessage = "Hello! Can you tell me what products you offer?";
  console.log(`  Message: "${testMessage}"`);

  // Save user message
  await db.insert(messages).values({
    conversationId,
    role: "user",
    type: "text",
    content: testMessage,
  });

  console.log("\n[5] Streaming response...");
  console.log("-".repeat(60));

  let fullResponse = "";
  const toolsUsed: string[] = [];

  for await (const event of runner.sendMessageStream({
    conversationId,
    message: testMessage,
  })) {
    switch (event.type) {
      case "thinking":
        const thinking = event.data as { step: string; progress: number };
        console.log(`  [THINKING] ${thinking.step} (${(thinking.progress * 100).toFixed(0)}%)`);
        break;
      case "tool_call":
        const tool = event.data as { toolName: string; status: string };
        console.log(`  [TOOL] ${tool.toolName}: ${tool.status}`);
        if (tool.status === "completed") {
          toolsUsed.push(tool.toolName);
        }
        break;
      case "delta":
        const delta = event.data as { content: string };
        process.stdout.write(delta.content);
        fullResponse += delta.content;
        break;
      case "notification":
        const notif = event.data as { message: string };
        console.log(`  [NOTIFICATION] ${notif.message}`);
        break;
      case "complete":
        console.log("\n" + "-".repeat(60));
        const complete = event.data as { content: string; metadata: Record<string, unknown> };
        console.log("\n[6] Response complete!");
        console.log(`  - Content length: ${complete.content.length} chars`);
        console.log(`  - Processing time: ${complete.metadata.processingTimeMs}ms`);
        console.log(`  - Model: ${complete.metadata.modelId}`);
        if (toolsUsed.length > 0) {
          console.log(`  - Tools used: ${toolsUsed.join(", ")}`);
        }
        break;
      case "error":
        const err = event.data as { code: string; message: string };
        console.error(`  [ERROR] ${err.code}: ${err.message}`);
        break;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test completed!");
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
