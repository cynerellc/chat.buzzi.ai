/**
 * Agent Runner Service
 *
 * This service manages the lifecycle of AI agents:
 * - Loading agent configurations from database
 * - Caching agent instances
 * - Routing messages to appropriate agents
 * - Managing agent execution
 *
 * Uses AdkExecutor for chatbot execution via Google ADK
 */

import { db } from "@/lib/db";
import {
  chatbots,
  chatbotPackages,
  type PackageVariableDefinition,
  type AgentListItem,
} from "@/lib/db/schema/chatbots";
import { conversations, messages as messagesTable } from "@/lib/db/schema/conversations";
import { companies } from "@/lib/db/schema/companies";
import { eq, and } from "drizzle-orm";

import { AdkExecutor, createAdkExecutor } from "./adk-executor";
import { createVariableContext } from "../types";

import type {
  AgentContext,
  AgentResponse,
  AgentStreamEvent,
  ChannelType,
  VariableValue,
  VariableContext,
} from "../types";

// ============================================================================
// Types
// ============================================================================

export interface CreateSessionOptions {
  agentId: string;
  companyId: string;
  channel: ChannelType;
  endUserId?: string;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
  pageUrl?: string;
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionInfo {
  conversationId: string;
  agentId: string;
  companyId: string;
  greeting: string;
}

export interface SendMessageOptions {
  conversationId: string;
  message: string;
  attachments?: Array<{
    type: "image" | "file" | "audio";
    url: string;
    mimeType: string;
    fileName?: string;
  }>;
}

// ============================================================================
// Agent Cache
// ============================================================================

class ExecutorCache {
  private cache: Map<string, { executor: AdkExecutor; timestamp: number }> = new Map();
  private readonly ttlMs = 300000; // 5 minutes

  get(chatbotId: string): AdkExecutor | undefined {
    const entry = this.cache.get(chatbotId);
    if (entry) {
      if (Date.now() - entry.timestamp < this.ttlMs) {
        return entry.executor;
      }
      this.cache.delete(chatbotId);
    }
    return undefined;
  }

  set(chatbotId: string, executor: AdkExecutor): void {
    this.cache.set(chatbotId, { executor, timestamp: Date.now() });
  }

  delete(chatbotId: string): void {
    this.cache.delete(chatbotId);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Agent Runner Service
// ============================================================================

export class AgentRunnerService {
  private executorCache: ExecutorCache;

  constructor() {
    this.executorCache = new ExecutorCache();
  }

  /**
   * Load a chatbot executor by ID
   */
  async loadExecutor(chatbotId: string): Promise<AdkExecutor | null> {
    // Check cache first
    const cached = this.executorCache.get(chatbotId);
    if (cached) {
      return cached;
    }

    // Load chatbot with package info
    const chatbotData = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        packageId: chatbots.packageId,
        packageType: chatbots.packageType,
        agentsList: chatbots.agentsList,
        variableValues: chatbots.variableValues,
        status: chatbots.status,
        // Package fields
        packageSlug: chatbotPackages.slug,
        packageVariables: chatbotPackages.variables,
      })
      .from(chatbots)
      .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.status, "active")))
      .limit(1);

    if (chatbotData.length === 0) {
      console.error(`[AgentRunner] Chatbot ${chatbotId} not found or not active`);
      return null;
    }

    const chatbot = chatbotData[0];
    if (!chatbot) {
      return null;
    }

    // Get agents list
    const agentsList = chatbot.agentsList as AgentListItem[] || [];
    if (agentsList.length === 0) {
      console.error(`[AgentRunner] Chatbot ${chatbotId} has no agents configured`);
      return null;
    }

    // Find the primary agent (first supervisor or first agent)
    const primaryAgent = agentsList.find((a) => a.agent_type === "supervisor") || agentsList[0];
    if (!primaryAgent) {
      console.error(`[AgentRunner] Chatbot ${chatbotId} has no primary agent`);
      return null;
    }

    // Determine knowledge categories (combine all agents' categories)
    const allCategories: string[] = [];
    for (const agent of agentsList) {
      if (agent.knowledge_categories && agent.knowledge_categories.length > 0) {
        allCategories.push(...agent.knowledge_categories);
      }
    }
    const uniqueCategories = [...new Set(allCategories)];

    // Check if knowledge base is enabled for any agent
    const kbEnabled = agentsList.some((a) => a.knowledge_base_enabled === true);

    // Build AdkExecutor options
    const executorOptions = {
      chatbotId: chatbot.id,
      companyId: chatbot.companyId,
      packageId: chatbot.packageId || chatbot.id, // Use package UUID for registry lookup
      agentConfig: {
        systemPrompt: primaryAgent.default_system_prompt,
        modelId: primaryAgent.default_model_id,
        temperature: primaryAgent.default_temperature,
        knowledgeBaseEnabled: kbEnabled,
        knowledgeCategories: uniqueCategories,
      },
      agentsListConfig: agentsList,
    };

    // Create executor
    const executor = createAdkExecutor(executorOptions);

    // Initialize the executor (load package)
    if (!executor.initialize()) {
      console.error(`[AgentRunner] Failed to initialize executor for ${chatbotId}`);
      return null;
    }

    // Cache the executor
    this.executorCache.set(chatbotId, executor);

    console.log(`[AgentRunner] Loaded executor for chatbot ${chatbotId}`);
    return executor;
  }

  /**
   * Load an agent by ID (legacy method - now loads executor)
   * @deprecated Use loadExecutor instead
   */
  async loadAgent(agentId: string): Promise<AdkExecutor | null> {
    return this.loadExecutor(agentId);
  }

  /**
   * Create a new chat session (conversation)
   */
  async createSession(options: CreateSessionOptions): Promise<SessionInfo | null> {
    // Verify chatbot exists and is active
    const chatbotData = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, options.agentId),
          eq(chatbots.companyId, options.companyId),
          eq(chatbots.status, "active")
        )
      )
      .limit(1);

    const chatbot = chatbotData[0];
    if (!chatbot) {
      return null;
    }

    // Verify company subscription is active
    const companyData = await db
      .select()
      .from(companies)
      .where(eq(companies.id, options.companyId))
      .limit(1);

    const companyRecord = companyData[0];
    if (!companyRecord || companyRecord.status !== "active") {
      return null;
    }

    // Create conversation
    const conversationResults = await db
      .insert(conversations)
      .values({
        companyId: options.companyId,
        chatbotId: options.agentId,
        endUserId: options.endUserId || crypto.randomUUID(),
        channel: options.channel,
        status: "active",
        metadata: options.metadata || {},
        pageUrl: options.pageUrl,
        referrer: options.referrer,
        lastMessageAt: new Date(),
      })
      .returning();

    const conversation = conversationResults[0];
    if (!conversation) {
      return null;
    }

    // Get greeting message
    const behavior = chatbot.behavior as { greeting?: string };
    const greeting = behavior?.greeting || "Hello! How can I help you today?";

    // Save greeting as first message
    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "assistant",
      type: "text",
      content: greeting,
    });

    return {
      conversationId: conversation.id,
      agentId: chatbot.id,
      companyId: options.companyId,
      greeting,
    };
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(options: SendMessageOptions): Promise<AgentResponse | null> {
    // Load conversation
    const conversationData = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, options.conversationId))
      .limit(1);

    const conversation = conversationData[0];
    if (!conversation) {
      return null;
    }

    // Check if conversation is active
    if (conversation.status !== "active") {
      return {
        content: "This conversation has ended. Please start a new conversation.",
        metadata: {},
      };
    }

    // Check if assigned to human
    if (conversation.assignedUserId) {
      return {
        content: "A support agent is handling your request. Please wait for their response.",
        metadata: {},
      };
    }

    // Load executor
    const executor = await this.loadExecutor(conversation.chatbotId);
    if (!executor) {
      return {
        content: "The agent is currently unavailable. Please try again later.",
        metadata: {},
      };
    }

    // Save user message
    await db.insert(messagesTable).values({
      conversationId: options.conversationId,
      role: "user",
      type: "text",
      content: options.message,
      attachments: options.attachments || [],
    });

    // Update conversation
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 1,
        userMessageCount: conversation.userMessageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, options.conversationId));

    // Load variable context
    const variableContext = await this.loadVariableContext(conversation.chatbotId);

    // Build context
    const context: AgentContext = {
      conversationId: options.conversationId,
      companyId: conversation.companyId,
      agentId: conversation.chatbotId,
      requestId: crypto.randomUUID(),
      message: options.message,
      attachments: options.attachments?.map((a) => ({
        id: crypto.randomUUID(),
        ...a,
      })),
      endUserId: conversation.endUserId,
      channel: conversation.channel as ChannelType,
      timestamp: new Date(),
      variables: variableContext.variables,
      securedVariables: variableContext.securedVariables,
    };

    // Process message using ADK executor
    const response = await executor.processMessage({
      message: options.message,
      sessionId: options.conversationId,
      context,
    });

    // Save assistant response
    await db.insert(messagesTable).values({
      conversationId: options.conversationId,
      role: "assistant",
      type: "text",
      content: response.content,
      tokenCount: response.metadata?.tokensUsed?.totalTokens,
      processingTimeMs: response.metadata?.processingTimeMs,
      sourceChunkIds: response.metadata?.sources?.map((s) => s.id) || [],
      toolCalls: response.metadata?.toolsUsed || [],
    });

    // Update conversation
    await db
      .update(conversations)
      .set({
        messageCount: conversation.messageCount + 2, // User + Assistant
        assistantMessageCount: conversation.assistantMessageCount + 1,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, options.conversationId));

    // Handle escalation if needed
    if (response.metadata?.shouldEscalate) {
      await this.handleEscalation(
        options.conversationId,
        response.metadata.escalationReason || "Escalation requested"
      );
    }

    return response;
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessageStream(
    options: SendMessageOptions
  ): AsyncGenerator<AgentStreamEvent> {
    // Load conversation
    const conversationData = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, options.conversationId))
      .limit(1);

    const conversation = conversationData[0];
    if (!conversation) {
      yield {
        type: "error",
        data: {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found",
          retryable: false,
        },
        timestamp: Date.now(),
      };
      return;
    }

    // Check if conversation is active
    if (conversation.status !== "active") {
      yield {
        type: "error",
        data: {
          code: "CONVERSATION_CLOSED",
          message: "This conversation has ended",
          retryable: false,
        },
        timestamp: Date.now(),
      };
      return;
    }

    // Load executor
    const executor = await this.loadExecutor(conversation.chatbotId);
    if (!executor) {
      yield {
        type: "error",
        data: {
          code: "AGENT_NOT_FOUND",
          message: "Agent not available",
          retryable: true,
        },
        timestamp: Date.now(),
      };
      return;
    }

    // Save user message
    await db.insert(messagesTable).values({
      conversationId: options.conversationId,
      role: "user",
      type: "text",
      content: options.message,
    });

    // Load variable context
    const variableContext = await this.loadVariableContext(conversation.chatbotId);

    // Build context
    const context: AgentContext = {
      conversationId: options.conversationId,
      companyId: conversation.companyId,
      agentId: conversation.chatbotId,
      requestId: crypto.randomUUID(),
      message: options.message,
      endUserId: conversation.endUserId,
      channel: conversation.channel as ChannelType,
      timestamp: new Date(),
      variables: variableContext.variables,
      securedVariables: variableContext.securedVariables,
    };

    // Stream response using ADK executor
    let fullContent = "";
    let metadata: AgentResponse["metadata"];

    for await (const event of executor.processMessageStream({
      message: options.message,
      sessionId: options.conversationId,
      context,
    })) {
      yield event;

      if (event.type === "delta") {
        fullContent += (event.data as { content: string }).content;
      } else if (event.type === "complete") {
        const completeData = event.data as { content: string; metadata: AgentResponse["metadata"] };
        fullContent = completeData.content;
        metadata = completeData.metadata;
      }
    }

    // Save assistant response
    if (fullContent) {
      await db.insert(messagesTable).values({
        conversationId: options.conversationId,
        role: "assistant",
        type: "text",
        content: fullContent,
        tokenCount: metadata?.tokensUsed?.totalTokens,
        processingTimeMs: metadata?.processingTimeMs ? Math.round(metadata.processingTimeMs) : undefined,
      });

      // Update conversation
      await db
        .update(conversations)
        .set({
          messageCount: conversation.messageCount + 2,
          userMessageCount: conversation.userMessageCount + 1,
          assistantMessageCount: conversation.assistantMessageCount + 1,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, options.conversationId));
    }
  }

  /**
   * Handle conversation escalation
   */
  private async handleEscalation(
    conversationId: string,
    reason: string
  ): Promise<void> {
    // Update conversation status to waiting for human
    await db
      .update(conversations)
      .set({
        status: "waiting_human",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // TODO: Create escalation record
    // TODO: Notify available support agents
    // TODO: Emit escalation event

    console.log(`Conversation ${conversationId} escalated: ${reason}`);
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string): Promise<Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>> {
    const messagesList = await db
      .select({
        role: messagesTable.role,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    return messagesList;
  }

  /**
   * End a conversation
   */
  async endConversation(
    conversationId: string,
    _resolution?: string
  ): Promise<void> {
    await db
      .update(conversations)
      .set({
        status: "resolved",
        resolutionType: "ai",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * Load variable values for a chatbot
   */
  private async loadVariableContext(chatbotId: string): Promise<VariableContext> {
    // Get chatbot with its package to read variable definitions and values
    const chatbotData = await db
      .select({
        variableValues: chatbots.variableValues,
        packageId: chatbots.packageId,
        packageVariables: chatbotPackages.variables,
      })
      .from(chatbots)
      .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
      .where(eq(chatbots.id, chatbotId))
      .limit(1);

    const chatbot = chatbotData[0];
    if (!chatbot) {
      return createVariableContext([]);
    }

    // Get package variable definitions and chatbot's values
    const packageVariablesDefs = (chatbot.packageVariables as PackageVariableDefinition[]) || [];
    const chatbotVariableValues = (chatbot.variableValues as Record<string, string>) || {};

    // Combine definitions with values
    const variableValues: VariableValue[] = packageVariablesDefs.map((pv) => ({
      name: pv.name,
      value: chatbotVariableValues[pv.name] || null,
      variableType: pv.variableType,
      dataType: pv.dataType,
    }));

    return createVariableContext(variableValues);
  }

  /**
   * Invalidate executor cache for a chatbot
   */
  invalidateAgent(chatbotId: string): void {
    this.executorCache.delete(chatbotId);
  }

  /**
   * Clear all executor cache
   */
  clearCache(): void {
    this.executorCache.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let runnerInstance: AgentRunnerService | null = null;

export function getAgentRunner(): AgentRunnerService {
  if (!runnerInstance) {
    runnerInstance = new AgentRunnerService();
  }
  return runnerInstance;
}

export function createAgentRunner(): AgentRunnerService {
  return new AgentRunnerService();
}
