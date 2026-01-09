/**
 * Test script to trace the full message flow through the widget API
 * Uses a fresh executor to bypass cache
 */

import { db } from '../src/lib/db';
import { conversations } from '../src/lib/db/schema/conversations';
import { chatbots } from '../src/lib/db/schema/chatbots';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AdkExecutor } from '../src/lib/ai/execution/adk-executor';

const uuidv4 = () => randomUUID();

async function main() {
  const chatbotId = 'f0fb28b6-9c33-4e1f-b2a3-0cafca0a5dd4';
  const companyId = 'e26c57e9-0c4e-4d0a-b261-5d89e2db58ae';

  console.log('=== Testing Message Flow (Fresh Executor) ===');
  console.log('Chatbot ID:', chatbotId);
  console.log('Company ID:', companyId);

  // Get the chatbot
  const [chatbot] = await db
    .select()
    .from(chatbots)
    .where(eq(chatbots.id, chatbotId))
    .limit(1);

  if (!chatbot) {
    console.error('Chatbot not found');
    process.exit(1);
  }

  // Use a fresh session ID for this test (bypasses history)
  const sessionId = uuidv4();

  // Get an existing conversation for context
  const [existingConv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.chatbotId, chatbotId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  const conversationId = existingConv?.id || uuidv4();
  console.log('Using conversation:', conversationId);
  console.log('Using fresh session:', sessionId);

  // Get agentsList from chatbot
  const agentsList = (chatbot.agentsList || []) as Array<{
    agent_identifier: string;
    name: string;
    default_system_prompt: string;
    default_model_id: string;
    model_settings?: Record<string, unknown>;
    knowledge_base_enabled?: boolean;
    knowledge_categories?: string[];
    routing_prompt?: string;
    designation?: string;
    avatar_url?: string;
    color?: string;
    agent_type: 'worker' | 'supervisor';
    managed_agent_ids?: string[];
  }>;

  // Find primary agent (supervisor or first agent)
  const primaryAgent = agentsList.find(a => a.agent_type === 'supervisor') || agentsList[0];

  // Check if knowledge base is enabled for any agent
  const kbEnabled = agentsList.some((a) => a.knowledge_base_enabled === true);

  // Collect all knowledge categories
  const allCategories: string[] = [];
  for (const agent of agentsList) {
    if (agent.knowledge_categories && agent.knowledge_categories.length > 0) {
      allCategories.push(...agent.knowledge_categories);
    }
  }
  const uniqueCategories = [...new Set(allCategories)];

  console.log('KB Enabled:', kbEnabled);
  console.log('Categories:', uniqueCategories);

  console.log('Primary agent model:', primaryAgent?.default_model_id);

  // Create a fresh executor (bypassing cache)
  const executor = new AdkExecutor({
    chatbotId: chatbot.id,
    companyId: chatbot.companyId,
    packageId: chatbot.packageId || chatbot.id,
    agentConfig: {
      systemPrompt: primaryAgent?.default_system_prompt || '',
      modelId: primaryAgent?.default_model_id || 'gpt-4o-mini',
      modelSettings: (primaryAgent?.model_settings ?? { temperature: 0.7 }) as { temperature: number },
      knowledgeBaseEnabled: kbEnabled,
      knowledgeCategories: uniqueCategories,
    },
    agentsListConfig: agentsList,
  });

  // Initialize the executor
  await executor.initialize();
  console.log('Executor initialized');

  // Test message
  const testMessage = 'list all apple products';
  console.log('\nSending message:', testMessage);
  console.log('\n=== Events ===');

  // Stream the message
  let eventCount = 0;
  let toolCallCount = 0;

  try {
    for await (const event of executor.processMessageStream({
      sessionId,
      message: testMessage,
      context: {
        conversationId,
        companyId: chatbot.companyId,
        chatbotId: chatbot.id,
        sessionId,
      },
    })) {
      eventCount++;

      // Only log non-delta events in full, summarize deltas
      if (event.type === 'delta') {
        // Just count deltas, don't log each one
      } else if (event.type === 'tool_call') {
        toolCallCount++;
        const toolData = event.data as { toolName: string; notification?: string; status?: string };
        console.log(`\n>>> TOOL CALL [${toolData.status}]: ${toolData.toolName} - ${toolData.notification || ''}`);
      } else if (event.type === 'notification') {
        const notifData = event.data as { message?: string; targetAgentName?: string };
        console.log(`\n>>> NOTIFICATION: ${notifData.message || ''} (agent: ${notifData.targetAgentName || 'unknown'})`);
      } else if (event.type === 'complete') {
        const completeData = event.data as { content: string };
        console.log('\n=== Final Response (first 800 chars) ===');
        console.log(completeData.content.substring(0, 800));
        if (completeData.content.length > 800) console.log('...[truncated]');
      } else {
        console.log(`\nEvent [${event.type}]:`, JSON.stringify(event.data, null, 2));
      }
    }

    console.log('\n=== Summary ===');
    console.log('Total events:', eventCount);
    console.log('Tool calls:', toolCallCount);
    console.log('\nKB tool should have been called if instructions are working correctly.');
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error);
  }

}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
