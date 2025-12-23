/**
 * Handover/Escalation Service
 *
 * Manages conversation handovers between AI agents and human support agents.
 * Features:
 * - Automatic escalation triggers
 * - Queue management for waiting conversations
 * - Agent assignment and routing
 * - Real-time status updates via SSE
 * - Escalation metrics tracking
 */

import { getSSEManager, getConversationChannel, getSupportAgentChannel, getCompanyChannel } from "./sse-manager";
import { getPresenceManager } from "./presence-manager";

// ============================================================================
// Types
// ============================================================================

export type EscalationReason =
  | "user_request"
  | "sentiment_negative"
  | "confidence_low"
  | "complex_query"
  | "repeated_questions"
  | "explicit_keywords"
  | "business_rules"
  | "timeout"
  | "manual";

export type EscalationStatus =
  | "pending"
  | "queued"
  | "assigned"
  | "active"
  | "resolved"
  | "cancelled"
  | "timeout";

export type EscalationPriority = "low" | "normal" | "high" | "urgent";

export interface Escalation {
  id: string;
  conversationId: string;
  companyId: string;
  agentId: string; // AI agent that was handling
  endUserId: string;

  // Escalation details
  reason: EscalationReason;
  status: EscalationStatus;
  priority: EscalationPriority;

  // Context
  summary?: string;
  lastMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  metadata?: Record<string, unknown>;

  // Assignment
  assignedToId?: string;
  assignedToName?: string;
  assignedAt?: Date;

  // Timestamps
  createdAt: Date;
  resolvedAt?: Date;
  queuedAt?: Date;

  // Metrics
  waitTimeSeconds?: number;
  handleTimeSeconds?: number;
}

export interface EscalationTrigger {
  type: EscalationReason;
  threshold?: number;
  keywords?: string[];
  enabled: boolean;
}

export interface QueuedConversation {
  escalation: Escalation;
  queuePosition: number;
  estimatedWaitTime?: number;
}

export interface AgentAssignment {
  agentUserId: string;
  conversationId: string;
  assignedAt: Date;
  status: "active" | "resolved" | "transferred";
}

// ============================================================================
// Handover Service Class
// ============================================================================

export class HandoverService {
  // Active escalations by ID
  private escalations: Map<string, Escalation> = new Map();

  // Queue of pending escalations by company
  private queues: Map<string, string[]> = new Map(); // companyId -> escalationIds

  // Agent assignments
  private agentAssignments: Map<string, Set<string>> = new Map(); // agentUserId -> escalationIds

  // Default triggers
  private defaultTriggers: EscalationTrigger[] = [
    { type: "user_request", enabled: true },
    { type: "sentiment_negative", threshold: 0.3, enabled: true },
    { type: "confidence_low", threshold: 0.4, enabled: true },
    { type: "repeated_questions", threshold: 3, enabled: true },
    {
      type: "explicit_keywords",
      keywords: ["human", "agent", "person", "help", "manager", "supervisor"],
      enabled: true,
    },
  ];

  /**
   * Create a new escalation
   */
  async createEscalation(params: {
    conversationId: string;
    companyId: string;
    agentId: string;
    endUserId: string;
    reason: EscalationReason;
    priority?: EscalationPriority;
    summary?: string;
    lastMessages?: Escalation["lastMessages"];
    metadata?: Record<string, unknown>;
  }): Promise<Escalation> {
    const escalation: Escalation = {
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      companyId: params.companyId,
      agentId: params.agentId,
      endUserId: params.endUserId,
      reason: params.reason,
      status: "pending",
      priority: params.priority ?? this.determinePriority(params.reason),
      summary: params.summary,
      lastMessages: params.lastMessages,
      metadata: params.metadata,
      createdAt: new Date(),
    };

    this.escalations.set(escalation.id, escalation);

    // Add to queue
    this.addToQueue(escalation);

    // Notify relevant parties
    this.notifyEscalationCreated(escalation);

    // Try automatic assignment
    await this.tryAutoAssign(escalation);

    return escalation;
  }

  /**
   * Get escalation by ID
   */
  getEscalation(escalationId: string): Escalation | null {
    return this.escalations.get(escalationId) ?? null;
  }

  /**
   * Get escalation by conversation ID
   */
  getEscalationByConversation(conversationId: string): Escalation | null {
    for (const escalation of this.escalations.values()) {
      if (
        escalation.conversationId === conversationId &&
        ["pending", "queued", "assigned", "active"].includes(escalation.status)
      ) {
        return escalation;
      }
    }
    return null;
  }

  /**
   * Assign escalation to support agent
   */
  async assignToAgent(
    escalationId: string,
    agentUserId: string,
    agentUserName?: string
  ): Promise<boolean> {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) return false;

    // Check if agent is available
    const presenceManager = getPresenceManager();
    const presence = presenceManager.getUserPresence(agentUserId);
    if (!presence || presence.status !== "online") {
      // Agent not available - keep in queue
      return false;
    }

    // Update escalation
    escalation.status = "assigned";
    escalation.assignedToId = agentUserId;
    escalation.assignedToName = agentUserName;
    escalation.assignedAt = new Date();

    // Calculate wait time
    if (escalation.queuedAt) {
      escalation.waitTimeSeconds = Math.floor(
        (Date.now() - escalation.queuedAt.getTime()) / 1000
      );
    }

    // Remove from queue
    this.removeFromQueue(escalation);

    // Track agent assignment
    if (!this.agentAssignments.has(agentUserId)) {
      this.agentAssignments.set(agentUserId, new Set());
    }
    this.agentAssignments.get(agentUserId)!.add(escalationId);

    // Notify parties
    this.notifyEscalationAssigned(escalation);

    return true;
  }

  /**
   * Mark escalation as active (agent started handling)
   */
  activateEscalation(escalationId: string): boolean {
    const escalation = this.escalations.get(escalationId);
    if (!escalation || escalation.status !== "assigned") return false;

    escalation.status = "active";

    // Notify conversation
    this.notifyEscalationStatusChange(escalation);

    return true;
  }

  /**
   * Resolve escalation
   */
  resolveEscalation(
    escalationId: string,
    options?: {
      resolutionNotes?: string;
      transferToAI?: boolean;
    }
  ): boolean {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) return false;

    const wasActive = escalation.status === "active";
    escalation.status = "resolved";
    escalation.resolvedAt = new Date();

    // Calculate handle time
    if (wasActive && escalation.assignedAt) {
      escalation.handleTimeSeconds = Math.floor(
        (Date.now() - escalation.assignedAt.getTime()) / 1000
      );
    }

    if (options?.resolutionNotes) {
      escalation.metadata = {
        ...escalation.metadata,
        resolutionNotes: options.resolutionNotes,
      };
    }

    // Remove from agent assignments
    if (escalation.assignedToId) {
      const assignments = this.agentAssignments.get(escalation.assignedToId);
      if (assignments) {
        assignments.delete(escalationId);
      }
    }

    // Notify parties
    this.notifyEscalationResolved(escalation, options?.transferToAI ?? false);

    return true;
  }

  /**
   * Cancel escalation
   */
  cancelEscalation(escalationId: string, reason?: string): boolean {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) return false;

    escalation.status = "cancelled";
    escalation.metadata = {
      ...escalation.metadata,
      cancellationReason: reason,
    };

    this.removeFromQueue(escalation);

    // Remove from agent assignments
    if (escalation.assignedToId) {
      const assignments = this.agentAssignments.get(escalation.assignedToId);
      if (assignments) {
        assignments.delete(escalationId);
      }
    }

    this.notifyEscalationStatusChange(escalation);

    return true;
  }

  /**
   * Transfer escalation to another agent
   */
  async transferEscalation(
    escalationId: string,
    newAgentUserId: string,
    newAgentUserName?: string,
    reason?: string
  ): Promise<boolean> {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) return false;

    const previousAgentId = escalation.assignedToId;

    // Remove from previous agent
    if (previousAgentId) {
      const assignments = this.agentAssignments.get(previousAgentId);
      if (assignments) {
        assignments.delete(escalationId);
      }
    }

    // Assign to new agent
    escalation.assignedToId = newAgentUserId;
    escalation.assignedToName = newAgentUserName;
    escalation.assignedAt = new Date();
    escalation.metadata = {
      ...escalation.metadata,
      transferReason: reason,
      transferredFrom: previousAgentId,
    };

    // Track new assignment
    if (!this.agentAssignments.has(newAgentUserId)) {
      this.agentAssignments.set(newAgentUserId, new Set());
    }
    this.agentAssignments.get(newAgentUserId)!.add(escalationId);

    // Notify parties
    this.notifyEscalationTransferred(escalation, previousAgentId);

    return true;
  }

  /**
   * Get queue for a company
   */
  getQueue(companyId: string): QueuedConversation[] {
    const queueIds = this.queues.get(companyId) ?? [];
    const result: QueuedConversation[] = [];

    for (let i = 0; i < queueIds.length; i++) {
      const queueId = queueIds[i];
      if (!queueId) continue;
      const escalation = this.escalations.get(queueId);
      if (escalation && ["pending", "queued"].includes(escalation.status)) {
        result.push({
          escalation,
          queuePosition: i + 1,
          estimatedWaitTime: this.estimateWaitTime(i),
        });
      }
    }

    return result;
  }

  /**
   * Get agent's active assignments
   */
  getAgentAssignments(agentUserId: string): Escalation[] {
    const assignmentIds = this.agentAssignments.get(agentUserId);
    if (!assignmentIds) return [];

    const result: Escalation[] = [];
    for (const id of assignmentIds) {
      const escalation = this.escalations.get(id);
      if (escalation && ["assigned", "active"].includes(escalation.status)) {
        result.push(escalation);
      }
    }

    return result;
  }

  /**
   * Check if message should trigger escalation
   */
  shouldEscalate(params: {
    message: string;
    sentiment?: number;
    confidence?: number;
    questionCount?: number;
    triggers?: EscalationTrigger[];
  }): { shouldEscalate: boolean; reason?: EscalationReason } {
    const triggers = params.triggers ?? this.defaultTriggers;

    for (const trigger of triggers) {
      if (!trigger.enabled) continue;

      switch (trigger.type) {
        case "explicit_keywords":
          if (trigger.keywords) {
            const lowerMessage = params.message.toLowerCase();
            for (const keyword of trigger.keywords) {
              if (lowerMessage.includes(keyword.toLowerCase())) {
                return { shouldEscalate: true, reason: "explicit_keywords" };
              }
            }
          }
          break;

        case "sentiment_negative":
          if (params.sentiment !== undefined && trigger.threshold !== undefined) {
            if (params.sentiment < trigger.threshold) {
              return { shouldEscalate: true, reason: "sentiment_negative" };
            }
          }
          break;

        case "confidence_low":
          if (params.confidence !== undefined && trigger.threshold !== undefined) {
            if (params.confidence < trigger.threshold) {
              return { shouldEscalate: true, reason: "confidence_low" };
            }
          }
          break;

        case "repeated_questions":
          if (params.questionCount !== undefined && trigger.threshold !== undefined) {
            if (params.questionCount >= trigger.threshold) {
              return { shouldEscalate: true, reason: "repeated_questions" };
            }
          }
          break;
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Get escalation statistics
   */
  getStats(companyId?: string): {
    totalActive: number;
    totalPending: number;
    totalQueued: number;
    totalResolved: number;
    averageWaitTimeSeconds: number;
    averageHandleTimeSeconds: number;
  } {
    let totalActive = 0;
    let totalPending = 0;
    let totalQueued = 0;
    let totalResolved = 0;
    let totalWaitTime = 0;
    let totalHandleTime = 0;
    let waitTimeCount = 0;
    let handleTimeCount = 0;

    for (const escalation of this.escalations.values()) {
      if (companyId && escalation.companyId !== companyId) continue;

      switch (escalation.status) {
        case "active":
          totalActive++;
          break;
        case "pending":
          totalPending++;
          break;
        case "queued":
        case "assigned":
          totalQueued++;
          break;
        case "resolved":
          totalResolved++;
          break;
      }

      if (escalation.waitTimeSeconds !== undefined) {
        totalWaitTime += escalation.waitTimeSeconds;
        waitTimeCount++;
      }

      if (escalation.handleTimeSeconds !== undefined) {
        totalHandleTime += escalation.handleTimeSeconds;
        handleTimeCount++;
      }
    }

    return {
      totalActive,
      totalPending,
      totalQueued,
      totalResolved,
      averageWaitTimeSeconds: waitTimeCount > 0 ? totalWaitTime / waitTimeCount : 0,
      averageHandleTimeSeconds: handleTimeCount > 0 ? totalHandleTime / handleTimeCount : 0,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private determinePriority(reason: EscalationReason): EscalationPriority {
    switch (reason) {
      case "user_request":
        return "high";
      case "sentiment_negative":
        return "high";
      case "explicit_keywords":
        return "normal";
      case "confidence_low":
        return "normal";
      case "complex_query":
        return "normal";
      case "repeated_questions":
        return "low";
      case "timeout":
        return "low";
      default:
        return "normal";
    }
  }

  private addToQueue(escalation: Escalation): void {
    if (!this.queues.has(escalation.companyId)) {
      this.queues.set(escalation.companyId, []);
    }

    const queue = this.queues.get(escalation.companyId)!;

    // Insert based on priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const insertPriority = priorityOrder[escalation.priority];

    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      const queuedId = queue[i];
      if (!queuedId) continue;
      const queuedEscalation = this.escalations.get(queuedId);
      if (queuedEscalation) {
        const queuedPriority = priorityOrder[queuedEscalation.priority];
        if (insertPriority < queuedPriority) {
          insertIndex = i;
          break;
        }
      }
    }

    queue.splice(insertIndex, 0, escalation.id);
    escalation.status = "queued";
    escalation.queuedAt = new Date();
  }

  private removeFromQueue(escalation: Escalation): void {
    const queue = this.queues.get(escalation.companyId);
    if (!queue) return;

    const index = queue.indexOf(escalation.id);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  private async tryAutoAssign(escalation: Escalation): Promise<boolean> {
    const presenceManager = getPresenceManager();

    // Get available agents for the company
    // In production, you'd look up company's support agents
    const onlineUsers = presenceManager.getOnlineUsers();

    // Find agent with least load
    let bestAgent: { userId: string; load: number } | null = null;

    for (const presence of onlineUsers) {
      // Skip non-agents (check metadata in production)
      if (!presence.metadata?.isSupportAgent) continue;

      const assignments = this.getAgentAssignments(presence.userId);
      const load = assignments.length;

      if (!bestAgent || load < bestAgent.load) {
        bestAgent = { userId: presence.userId, load };
      }
    }

    if (bestAgent) {
      return this.assignToAgent(escalation.id, bestAgent.userId);
    }

    return false;
  }

  private estimateWaitTime(queuePosition: number): number {
    // Rough estimate: 3 minutes per position
    return queuePosition * 180;
  }

  // ============================================================================
  // Notification Methods
  // ============================================================================

  private notifyEscalationCreated(escalation: Escalation): void {
    const sseManager = getSSEManager();

    // Notify conversation
    sseManager.publish(getConversationChannel(escalation.conversationId), "notification", {
      type: "escalation",
      action: "created",
      escalationId: escalation.id,
      reason: escalation.reason,
      status: escalation.status,
      timestamp: Date.now(),
    });

    // Notify company channel (for support agent dashboard)
    sseManager.publish(getCompanyChannel(escalation.companyId), "notification", {
      type: "escalation",
      action: "created",
      escalation: {
        id: escalation.id,
        conversationId: escalation.conversationId,
        reason: escalation.reason,
        priority: escalation.priority,
        summary: escalation.summary,
      },
      timestamp: Date.now(),
    });
  }

  private notifyEscalationAssigned(escalation: Escalation): void {
    const sseManager = getSSEManager();

    // Notify conversation
    sseManager.publish(getConversationChannel(escalation.conversationId), "notification", {
      type: "escalation",
      action: "assigned",
      escalationId: escalation.id,
      assignedTo: {
        id: escalation.assignedToId,
        name: escalation.assignedToName,
      },
      timestamp: Date.now(),
    });

    // Notify assigned agent
    if (escalation.assignedToId) {
      sseManager.publish(getSupportAgentChannel(escalation.assignedToId), "notification", {
        type: "escalation",
        action: "assigned",
        escalation: {
          id: escalation.id,
          conversationId: escalation.conversationId,
          reason: escalation.reason,
          priority: escalation.priority,
          summary: escalation.summary,
          lastMessages: escalation.lastMessages,
        },
        timestamp: Date.now(),
      });
    }
  }

  private notifyEscalationResolved(escalation: Escalation, transferToAI: boolean): void {
    const sseManager = getSSEManager();

    sseManager.publish(getConversationChannel(escalation.conversationId), "notification", {
      type: "escalation",
      action: "resolved",
      escalationId: escalation.id,
      transferToAI,
      timestamp: Date.now(),
    });

    // Notify company
    sseManager.publish(getCompanyChannel(escalation.companyId), "notification", {
      type: "escalation",
      action: "resolved",
      escalationId: escalation.id,
      metrics: {
        waitTimeSeconds: escalation.waitTimeSeconds,
        handleTimeSeconds: escalation.handleTimeSeconds,
      },
      timestamp: Date.now(),
    });
  }

  private notifyEscalationStatusChange(escalation: Escalation): void {
    const sseManager = getSSEManager();

    sseManager.publish(getConversationChannel(escalation.conversationId), "notification", {
      type: "escalation",
      action: "status_change",
      escalationId: escalation.id,
      status: escalation.status,
      timestamp: Date.now(),
    });
  }

  private notifyEscalationTransferred(
    escalation: Escalation,
    previousAgentId?: string
  ): void {
    const sseManager = getSSEManager();

    // Notify conversation
    sseManager.publish(getConversationChannel(escalation.conversationId), "notification", {
      type: "escalation",
      action: "transferred",
      escalationId: escalation.id,
      newAgent: {
        id: escalation.assignedToId,
        name: escalation.assignedToName,
      },
      timestamp: Date.now(),
    });

    // Notify new agent
    if (escalation.assignedToId) {
      sseManager.publish(getSupportAgentChannel(escalation.assignedToId), "notification", {
        type: "escalation",
        action: "transferred",
        escalation: {
          id: escalation.id,
          conversationId: escalation.conversationId,
          reason: escalation.reason,
          priority: escalation.priority,
          summary: escalation.summary,
        },
        timestamp: Date.now(),
      });
    }

    // Notify previous agent
    if (previousAgentId) {
      sseManager.publish(getSupportAgentChannel(previousAgentId), "notification", {
        type: "escalation",
        action: "removed",
        escalationId: escalation.id,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.escalations.clear();
    this.queues.clear();
    this.agentAssignments.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let handoverServiceInstance: HandoverService | null = null;

export function getHandoverService(): HandoverService {
  if (!handoverServiceInstance) {
    handoverServiceInstance = new HandoverService();
  }
  return handoverServiceInstance;
}

export function createHandoverService(): HandoverService {
  return new HandoverService();
}
