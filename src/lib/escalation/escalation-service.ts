/**
 * Escalation Service
 *
 * Main service for handling Human-in-the-Loop (HITL) escalations:
 * - Create escalations from conversations
 * - Route to available agents
 * - Handle takeover and return-to-AI
 * - Track escalation lifecycle
 */

import { db } from "@/lib/db";
import { escalations, conversations, messages } from "@/lib/db/schema/conversations";
import { agents } from "@/lib/db/schema/chatbots";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  TriggerDetector,
  TriggerConfig,
  ConversationContext,
  EscalationTrigger,
} from "./triggers";
import {
  RoutingService,
  RoutingOptions,
  RoutingResult,
} from "./routing";
import { getSSEManager } from "@/lib/realtime/sse-manager";

// Types
export interface CreateEscalationOptions {
  conversationId: string;
  reason?: string;
  triggerType?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}

export interface EscalationDetails {
  id: string;
  conversationId: string;
  status: string;
  priority: string;
  reason: string | null;
  triggerType: string | null;
  assignedUserId: string | null;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  returnedToAi: boolean;
  createdAt: Date;
  conversation?: {
    id: string;
    endUserId: string;
    agentId: string;
    messageCount: number;
    sentiment: number | null;
  };
}

export interface ResolveOptions {
  resolution: string;
  returnToAi?: boolean;
  resolvedBy: string;
}

/**
 * Escalation Service Class
 */
export class EscalationService {
  private triggerDetector: TriggerDetector;
  private routingService: RoutingService;

  constructor(triggerConfig?: TriggerConfig) {
    this.triggerDetector = new TriggerDetector(triggerConfig);
    this.routingService = new RoutingService();
  }

  /**
   * Check if a conversation should be escalated
   */
  async shouldEscalate(conversationId: string): Promise<{
    shouldEscalate: boolean;
    triggers: EscalationTrigger[];
    reason: string | null;
  }> {
    // Get conversation context
    const context = await this.buildConversationContext(conversationId);
    if (!context) {
      return { shouldEscalate: false, triggers: [], reason: null };
    }

    // Analyze for triggers
    const triggers = this.triggerDetector.analyze(context);
    const shouldEscalate = triggers.some((t) => t.triggered);
    const reason = this.triggerDetector.getEscalationReason(context);

    return { shouldEscalate, triggers, reason };
  }

  /**
   * Create a new escalation
   */
  async createEscalation(
    options: CreateEscalationOptions
  ): Promise<{ escalationId: string; routingResult: RoutingResult }> {
    const {
      conversationId,
      reason = "Escalated by system",
      triggerType = "manual",
      priority = "medium",
      metadata,
    } = options;

    // Get conversation details
    const [conversation] = await db
      .select({
        id: conversations.id,
        companyId: conversations.companyId,
        agentId: conversations.chatbotId,
        status: conversations.status,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Check if there's already an active escalation
    const [existingEscalation] = await db
      .select()
      .from(escalations)
      .where(
        and(
          eq(escalations.conversationId, conversationId),
          eq(escalations.status, "pending")
        )
      )
      .limit(1);

    if (existingEscalation) {
      // Return existing escalation
      return {
        escalationId: existingEscalation.id,
        routingResult: {
          success: false,
          reason: "Escalation already exists",
          assignedAgentId: existingEscalation.assignedUserId ?? undefined,
        },
      };
    }

    // Create escalation record
    const [newEscalation] = await db
      .insert(escalations)
      .values({
        conversationId,
        status: "pending",
        priority,
        reason,
        triggerType,
      })
      .returning({ id: escalations.id });

    if (!newEscalation) {
      throw new Error("Failed to create escalation");
    }

    // Update conversation status
    await db
      .update(conversations)
      .set({
        status: "waiting_human",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // Route the escalation
    const routingResult = await this.routingService.routeEscalation(
      newEscalation.id,
      {
        companyId: conversation.companyId,
        priority,
      }
    );

    // Send real-time notification
    await this.notifyEscalation(newEscalation.id, conversation.companyId, routingResult);

    return {
      escalationId: newEscalation.id,
      routingResult,
    };
  }

  /**
   * Auto-escalate a conversation based on triggers
   */
  async autoEscalate(conversationId: string): Promise<{
    escalated: boolean;
    escalationId?: string;
    reason?: string;
    routingResult?: RoutingResult;
  }> {
    // Check if should escalate
    const { shouldEscalate, triggers, reason } = await this.shouldEscalate(
      conversationId
    );

    if (!shouldEscalate) {
      return { escalated: false };
    }

    // Determine trigger type
    const primaryTrigger = triggers.find((t) => t.triggered);
    const triggerType = primaryTrigger?.type ?? "auto";

    // Determine priority based on trigger
    const priority = this.determinePriority(triggers);

    // Create escalation
    const { escalationId, routingResult } = await this.createEscalation({
      conversationId,
      reason: reason ?? "Auto-escalated by system",
      triggerType,
      priority,
      metadata: { triggers },
    });

    return {
      escalated: true,
      escalationId,
      reason: reason ?? undefined,
      routingResult,
    };
  }

  /**
   * Accept/claim an escalation (support agent)
   */
  async acceptEscalation(
    escalationId: string,
    agentUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const [escalation] = await db
      .select()
      .from(escalations)
      .where(eq(escalations.id, escalationId))
      .limit(1);

    if (!escalation) {
      return { success: false, error: "Escalation not found" };
    }

    if (escalation.status !== "pending" && escalation.status !== "assigned") {
      return { success: false, error: "Escalation cannot be accepted" };
    }

    // Update escalation
    await db
      .update(escalations)
      .set({
        assignedUserId: agentUserId,
        assignedAt: new Date(),
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, escalationId));

    // Update conversation to assign the human agent
    await db
      .update(conversations)
      .set({
        assignedUserId: agentUserId,
        status: "with_human",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, escalation.conversationId));

    return { success: true };
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(
    escalationId: string,
    options: ResolveOptions
  ): Promise<{ success: boolean; error?: string }> {
    const { resolution, returnToAi = false, resolvedBy } = options;

    const [escalation] = await db
      .select()
      .from(escalations)
      .where(eq(escalations.id, escalationId))
      .limit(1);

    if (!escalation) {
      return { success: false, error: "Escalation not found" };
    }

    // Update escalation
    await db
      .update(escalations)
      .set({
        status: "resolved",
        resolution,
        resolvedAt: new Date(),
        resolvedBy,
        returnedToAi: returnToAi,
        returnedAt: returnToAi ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, escalationId));

    // Update conversation
    if (returnToAi) {
      await db
        .update(conversations)
        .set({
          assignedUserId: null, // Return to AI
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, escalation.conversationId));
    } else {
      await db
        .update(conversations)
        .set({
          status: "resolved",
          resolutionType: "human",
          resolvedAt: new Date(),
          resolvedBy,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, escalation.conversationId));
    }

    // Release agent slot
    if (escalation.assignedUserId) {
      await this.routingService.releaseAgentSlot(escalation.assignedUserId);
    }

    return { success: true };
  }

  /**
   * Return conversation to AI
   */
  async returnToAi(
    escalationId: string,
    agentUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.resolveEscalation(escalationId, {
      resolution: "Returned to AI by agent",
      returnToAi: true,
      resolvedBy: agentUserId,
    });
  }

  /**
   * Get escalation details
   */
  async getEscalation(escalationId: string): Promise<EscalationDetails | null> {
    const [result] = await db
      .select({
        id: escalations.id,
        conversationId: escalations.conversationId,
        status: escalations.status,
        priority: escalations.priority,
        reason: escalations.reason,
        triggerType: escalations.triggerType,
        assignedUserId: escalations.assignedUserId,
        assignedAt: escalations.assignedAt,
        resolvedAt: escalations.resolvedAt,
        returnedToAi: escalations.returnedToAi,
        createdAt: escalations.createdAt,
        convId: conversations.id,
        endUserId: conversations.endUserId,
        agentId: conversations.chatbotId,
        messageCount: conversations.messageCount,
        sentiment: conversations.sentiment,
      })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .where(eq(escalations.id, escalationId))
      .limit(1);

    if (!result) return null;

    return {
      id: result.id,
      conversationId: result.conversationId,
      status: result.status,
      priority: result.priority,
      reason: result.reason,
      triggerType: result.triggerType,
      assignedUserId: result.assignedUserId,
      assignedAt: result.assignedAt,
      resolvedAt: result.resolvedAt,
      returnedToAi: result.returnedToAi,
      createdAt: result.createdAt,
      conversation: {
        id: result.convId,
        endUserId: result.endUserId,
        agentId: result.agentId,
        messageCount: result.messageCount,
        sentiment: result.sentiment,
      },
    };
  }

  /**
   * Get escalation statistics for a company
   */
  async getEscalationStats(
    companyId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    averageResponseTime: number | null;
    averageResolutionTime: number | null;
    byTriggerType: Record<string, number>;
    returnToAiRate: number;
  }> {
    const baseQuery = sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE e.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE e.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE e.status = 'resolved') as resolved,
        AVG(EXTRACT(EPOCH FROM (e.assigned_at - e.created_at))) FILTER (WHERE e.assigned_at IS NOT NULL) as avg_response_time,
        AVG(EXTRACT(EPOCH FROM (e.resolved_at - e.created_at))) FILTER (WHERE e.resolved_at IS NOT NULL) as avg_resolution_time,
        COUNT(*) FILTER (WHERE e.returned_to_ai = true) as returned_to_ai_count
      FROM chatapp_escalations e
      INNER JOIN chatapp_conversations c ON e.conversation_id = c.id
      WHERE c.company_id = ${companyId}
    `;

    const result = await db.execute<{
      total: string;
      pending: string;
      in_progress: string;
      resolved: string;
      avg_response_time: string | null;
      avg_resolution_time: string | null;
      returned_to_ai_count: string;
    }>(baseQuery);

    const stats = Array.isArray(result) ? result[0] : null;

    // Get by trigger type
    const triggerResult = await db.execute<{
      trigger_type: string;
      count: string;
    }>(sql`
      SELECT e.trigger_type, COUNT(*) as count
      FROM chatapp_escalations e
      INNER JOIN chatapp_conversations c ON e.conversation_id = c.id
      WHERE c.company_id = ${companyId}
      GROUP BY e.trigger_type
    `);

    const byTriggerType: Record<string, number> = {};
    if (Array.isArray(triggerResult)) {
      for (const row of triggerResult) {
        if (row.trigger_type) {
          byTriggerType[row.trigger_type] = parseInt(row.count, 10);
        }
      }
    }

    const total = parseInt(stats?.total ?? "0", 10);
    const returnedCount = parseInt(stats?.returned_to_ai_count ?? "0", 10);

    return {
      total,
      pending: parseInt(stats?.pending ?? "0", 10),
      inProgress: parseInt(stats?.in_progress ?? "0", 10),
      resolved: parseInt(stats?.resolved ?? "0", 10),
      averageResponseTime: stats?.avg_response_time
        ? parseFloat(stats.avg_response_time)
        : null,
      averageResolutionTime: stats?.avg_resolution_time
        ? parseFloat(stats.avg_resolution_time)
        : null,
      byTriggerType,
      returnToAiRate: total > 0 ? returnedCount / total : 0,
    };
  }

  /**
   * Build conversation context for trigger analysis
   */
  private async buildConversationContext(
    conversationId: string
  ): Promise<ConversationContext | null> {
    // Get conversation
    const [conversation] = await db
      .select({
        sentiment: conversations.sentiment,
        messageCount: conversations.messageCount,
        userMessageCount: conversations.userMessageCount,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) return null;

    // Get recent user messages
    const recentMessages = await db
      .select({ content: messages.content })
      .from(messages)
      .where(
        and(eq(messages.conversationId, conversationId), eq(messages.role, "user"))
      )
      .orderBy(desc(messages.createdAt))
      .limit(5);

    // Convert sentiment from -100..100 to -1..1
    const normalizedSentiment = conversation.sentiment
      ? conversation.sentiment / 100
      : undefined;

    return {
      sentiment: normalizedSentiment,
      turnCount: conversation.userMessageCount,
      lastMessages: recentMessages.map((m) => m.content),
    };
  }

  /**
   * Determine priority based on triggers
   */
  private determinePriority(
    triggers: EscalationTrigger[]
  ): "low" | "medium" | "high" | "urgent" {
    // Explicit request = high priority
    if (triggers.some((t) => t.type === "explicit_request")) {
      return "high";
    }

    // Very negative sentiment = urgent
    const sentimentTrigger = triggers.find((t) => t.type === "sentiment");
    if (sentimentTrigger && sentimentTrigger.confidence && sentimentTrigger.confidence > 0.8) {
      return "urgent";
    }

    // Frustration = high
    if (triggers.some((t) => t.type === "frustration")) {
      return "high";
    }

    // Keywords like lawsuit, refund = high
    const keywordTrigger = triggers.find((t) => t.type === "keyword");
    if (keywordTrigger?.metadata) {
      const keywords = keywordTrigger.metadata.matchedKeywords as string[] | undefined;
      if (
        keywords?.some((k) =>
          ["lawsuit", "lawyer", "attorney", "refund", "cancel"].includes(k)
        )
      ) {
        return "high";
      }
    }

    // Turn limit = medium
    if (triggers.some((t) => t.type === "turns")) {
      return "medium";
    }

    return "medium";
  }

  /**
   * Send real-time notification for escalation
   */
  private async notifyEscalation(
    escalationId: string,
    companyId: string,
    routingResult: RoutingResult
  ): Promise<void> {
    try {
      const sseManager = getSSEManager();

      // Notify all support agents in the company (using company channel)
      sseManager.publish(`company:${companyId}:escalations`, "notification", {
        type: "escalation",
        data: {
          escalationId,
          assignedAgentId: routingResult.assignedAgentId,
          assignedAgentName: routingResult.assignedAgentName,
          queuePosition: routingResult.queuePosition,
        },
      });

      // If assigned to a specific agent, send direct notification
      if (routingResult.assignedAgentId) {
        sseManager.publish(`user:${routingResult.assignedAgentId}`, "notification", {
          type: "escalation",
          data: {
            escalationId,
            assigned: true,
          },
        });
      }
    } catch (error) {
      // Non-critical - log and continue
      console.error("Failed to send escalation notification:", error);
    }
  }
}

// Export singleton
let escalationServiceInstance: EscalationService | null = null;

export function getEscalationService(config?: TriggerConfig): EscalationService {
  if (!escalationServiceInstance || config) {
    escalationServiceInstance = new EscalationService(config);
  }
  return escalationServiceInstance;
}

// Export convenience functions
export async function createEscalation(
  options: CreateEscalationOptions
): Promise<{ escalationId: string; routingResult: RoutingResult }> {
  const service = getEscalationService();
  return service.createEscalation(options);
}

export async function autoEscalateConversation(
  conversationId: string
): Promise<{ escalated: boolean; escalationId?: string; reason?: string }> {
  const service = getEscalationService();
  return service.autoEscalate(conversationId);
}

export async function resolveEscalation(
  escalationId: string,
  options: ResolveOptions
): Promise<{ success: boolean; error?: string }> {
  const service = getEscalationService();
  return service.resolveEscalation(escalationId, options);
}
