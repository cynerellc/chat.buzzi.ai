/**
 * Agent Runner Service
 *
 * This service manages the lifecycle of AI agents:
 * - Loading agent configurations from database
 * - Caching agent instances
 * - Routing messages to appropriate agents
 * - Managing agent execution
 */

import { db } from "@/lib/db";
import { agents, agentPackages, type PackageVariableDefinition } from "@/lib/db/schema/agents";
import { conversations, messages as messagesTable } from "@/lib/db/schema/conversations";
import { companies } from "@/lib/db/schema/companies";
import { eq, and } from "drizzle-orm";

import { BaseAgent, createAgent } from "./base-agent";
import { agentToConfig, createVariableContext } from "../types";

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

class AgentCache {
  private cache: Map<string, { agent: BaseAgent; timestamp: number }> = new Map();
  private readonly ttlMs = 300000; // 5 minutes

  get(agentId: string): BaseAgent | undefined {
    const entry = this.cache.get(agentId);
    if (entry) {
      if (Date.now() - entry.timestamp < this.ttlMs) {
        return entry.agent;
      }
      this.cache.delete(agentId);
    }
    return undefined;
  }

  set(agentId: string, agent: BaseAgent): void {
    this.cache.set(agentId, { agent, timestamp: Date.now() });
  }

  delete(agentId: string): void {
    this.cache.delete(agentId);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Agent Runner Service
// ============================================================================

export class AgentRunnerService {
  private agentCache: AgentCache;

  constructor() {
    this.agentCache = new AgentCache();
  }

  /**
   * Load an agent by ID
   */
  async loadAgent(agentId: string): Promise<BaseAgent | null> {
    // Check cache first
    const cached = this.agentCache.get(agentId);
    if (cached) {
      return cached;
    }

    // Load from database
    const agentData = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.status, "active")))
      .limit(1);

    if (agentData.length === 0) {
      return null;
    }

    // Convert to config and create agent
    const agentRecord = agentData[0];
    if (!agentRecord) {
      return null;
    }
    const config = agentToConfig(agentRecord);
    const agent = createAgent(config);

    // Cache the agent
    this.agentCache.set(agentId, agent);

    return agent;
  }

  /**
   * Create a new chat session (conversation)
   */
  async createSession(options: CreateSessionOptions): Promise<SessionInfo | null> {
    // Verify agent exists and is active
    const agentData = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, options.agentId),
          eq(agents.companyId, options.companyId),
          eq(agents.status, "active")
        )
      )
      .limit(1);

    const agent = agentData[0];
    if (!agent) {
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
        agentId: options.agentId,
        endUserId: options.endUserId || crypto.randomUUID(), // Temporary - should be proper end user
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
    const behavior = agent.behavior as { greeting?: string };
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
      agentId: agent.id,
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

    // Load agent
    const agent = await this.loadAgent(conversation.agentId);
    if (!agent) {
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

    // Load variable context for the agent
    const variableContext = await this.loadVariableContext(conversation.agentId);

    // Build context
    const context: AgentContext = {
      conversationId: options.conversationId,
      companyId: conversation.companyId,
      agentId: conversation.agentId,
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

    // Process message
    const response = await agent.processMessage(context);

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

    // Load agent
    const agent = await this.loadAgent(conversation.agentId);
    if (!agent) {
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

    // Load variable context for the agent
    const variableContext = await this.loadVariableContext(conversation.agentId);

    // Build context
    const context: AgentContext = {
      conversationId: options.conversationId,
      companyId: conversation.companyId,
      agentId: conversation.agentId,
      requestId: crypto.randomUUID(),
      message: options.message,
      endUserId: conversation.endUserId,
      channel: conversation.channel as ChannelType,
      timestamp: new Date(),
      variables: variableContext.variables,
      securedVariables: variableContext.securedVariables,
    };

    // Stream response
    let fullContent = "";
    let metadata: AgentResponse["metadata"];

    for await (const event of agent.processMessageStream(context)) {
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
        processingTimeMs: metadata?.processingTimeMs,
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
   * Load variable values for an agent
   * Variables are now stored as JSONB:
   * - Package variable definitions in agentPackages.variables
   * - Agent variable values in agents.variableValues
   */
  private async loadVariableContext(agentId: string): Promise<VariableContext> {
    // Get agent with its package to read variable definitions and values
    const agentData = await db
      .select({
        variableValues: agents.variableValues,
        packageId: agents.packageId,
        packageVariables: agentPackages.variables,
      })
      .from(agents)
      .leftJoin(agentPackages, eq(agents.packageId, agentPackages.id))
      .where(eq(agents.id, agentId))
      .limit(1);

    const agent = agentData[0];
    if (!agent) {
      return createVariableContext([]);
    }

    // Get package variable definitions and agent's values
    const packageVariablesDefs = (agent.packageVariables as PackageVariableDefinition[]) || [];
    const agentVariableValues = (agent.variableValues as Record<string, string>) || {};

    // Combine definitions with values
    const variableValues: VariableValue[] = packageVariablesDefs.map((pv) => ({
      name: pv.name,
      value: agentVariableValues[pv.name] || null,
      variableType: pv.variableType,
      dataType: pv.dataType,
    }));

    return createVariableContext(variableValues);
  }

  /**
   * Invalidate agent cache
   */
  invalidateAgent(agentId: string): void {
    this.agentCache.delete(agentId);
  }

  /**
   * Clear all agent cache
   */
  clearCache(): void {
    this.agentCache.clear();
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
