/**
 * Escalation Routing Service
 *
 * Handles routing of escalated conversations to available support agents:
 * - Round-robin assignment
 * - Load-based assignment
 * - Skills-based routing
 * - Priority queue management
 */

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { supportAgentStatus } from "@/lib/db/schema/conversations";
import { escalations } from "@/lib/db/schema/conversations";
import { eq, and, lt, asc, desc, sql, isNull } from "drizzle-orm";

// Types
export interface RoutingOptions {
  strategy?: RoutingStrategy;
  priority?: "low" | "medium" | "high" | "urgent";
  requiredSkills?: string[];
  preferredAgentId?: string;
  companyId: string;
}

export type RoutingStrategy =
  | "round_robin"
  | "least_busy"
  | "random"
  | "preferred";

export interface AvailableAgent {
  userId: string;
  userName: string;
  status: string;
  currentChatCount: number;
  maxConcurrentChats: number;
  availableSlots: number;
}

export interface RoutingResult {
  success: boolean;
  assignedAgentId?: string;
  assignedAgentName?: string;
  reason?: string;
  queuePosition?: number;
}

// Default configuration
const DEFAULT_STRATEGY: RoutingStrategy = "least_busy";

/**
 * Escalation Routing Service
 */
export class RoutingService {
  /**
   * Find and assign an available agent
   */
  async routeEscalation(
    escalationId: string,
    options: RoutingOptions
  ): Promise<RoutingResult> {
    const {
      strategy = DEFAULT_STRATEGY,
      priority = "medium",
      preferredAgentId,
      companyId,
    } = options;

    // Try preferred agent first if specified
    if (preferredAgentId && strategy === "preferred") {
      const preferredResult = await this.tryAssignAgent(
        escalationId,
        preferredAgentId
      );
      if (preferredResult.success) {
        return preferredResult;
      }
    }

    // Get available agents
    const availableAgents = await this.getAvailableAgents(companyId);

    if (availableAgents.length === 0) {
      // No agents available - add to queue
      return await this.addToQueue(escalationId, priority);
    }

    // Select agent based on strategy
    const selectedAgent = this.selectAgent(availableAgents, strategy);

    if (!selectedAgent) {
      return await this.addToQueue(escalationId, priority);
    }

    // Assign the escalation
    return await this.assignToAgent(escalationId, selectedAgent);
  }

  /**
   * Get all available agents for a company
   */
  async getAvailableAgents(companyId: string): Promise<AvailableAgent[]> {
    const results = await db
      .select({
        userId: users.id,
        userName: users.name,
        status: supportAgentStatus.status,
        currentChatCount: supportAgentStatus.currentChatCount,
        maxConcurrentChats: supportAgentStatus.maxConcurrentChats,
      })
      .from(users)
      .innerJoin(supportAgentStatus, eq(users.id, supportAgentStatus.userId))
      .where(
        and(
          eq(users.companyId, companyId),
          eq(supportAgentStatus.status, "online"),
          lt(
            supportAgentStatus.currentChatCount,
            supportAgentStatus.maxConcurrentChats
          )
        )
      )
      .orderBy(asc(supportAgentStatus.currentChatCount));

    return results.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? "Unknown",
      status: r.status,
      currentChatCount: r.currentChatCount,
      maxConcurrentChats: r.maxConcurrentChats,
      availableSlots: r.maxConcurrentChats - r.currentChatCount,
    }));
  }

  /**
   * Select an agent based on routing strategy
   */
  private selectAgent(
    agents: AvailableAgent[],
    strategy: RoutingStrategy
  ): AvailableAgent | null {
    if (agents.length === 0) return null;

    switch (strategy) {
      case "round_robin":
        // Already sorted by current chat count, just take first
        return agents[0] ?? null;

      case "least_busy":
        // Sort by available slots (descending) and take the least busy
        const sortedBySlots = [...agents].sort(
          (a, b) => b.availableSlots - a.availableSlots
        );
        return sortedBySlots[0] ?? null;

      case "random":
        const randomIndex = Math.floor(Math.random() * agents.length);
        return agents[randomIndex] ?? null;

      default:
        return agents[0] ?? null;
    }
  }

  /**
   * Try to assign a specific agent
   */
  private async tryAssignAgent(
    escalationId: string,
    agentId: string
  ): Promise<RoutingResult> {
    // Check if agent is available
    const [agentStatus] = await db
      .select()
      .from(supportAgentStatus)
      .where(eq(supportAgentStatus.userId, agentId))
      .limit(1);

    if (!agentStatus) {
      return { success: false, reason: "Agent status not found" };
    }

    if (agentStatus.status !== "online") {
      return { success: false, reason: "Agent is not online" };
    }

    if (agentStatus.currentChatCount >= agentStatus.maxConcurrentChats) {
      return { success: false, reason: "Agent at maximum capacity" };
    }

    // Get agent name
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);

    return await this.assignToAgent(escalationId, {
      userId: agentId,
      userName: user?.name ?? "Unknown",
      status: agentStatus.status,
      currentChatCount: agentStatus.currentChatCount,
      maxConcurrentChats: agentStatus.maxConcurrentChats,
      availableSlots: agentStatus.maxConcurrentChats - agentStatus.currentChatCount,
    });
  }

  /**
   * Assign escalation to an agent
   */
  private async assignToAgent(
    escalationId: string,
    agent: AvailableAgent
  ): Promise<RoutingResult> {
    try {
      // Update escalation
      await db
        .update(escalations)
        .set({
          assignedUserId: agent.userId,
          assignedAt: new Date(),
          status: "assigned",
          updatedAt: new Date(),
        })
        .where(eq(escalations.id, escalationId));

      // Increment agent's chat count
      await db
        .update(supportAgentStatus)
        .set({
          currentChatCount: sql`${supportAgentStatus.currentChatCount} + 1`,
          lastActivityAt: new Date(),
        })
        .where(eq(supportAgentStatus.userId, agent.userId));

      return {
        success: true,
        assignedAgentId: agent.userId,
        assignedAgentName: agent.userName,
      };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : "Assignment failed",
      };
    }
  }

  /**
   * Add escalation to queue (no agents available)
   */
  private async addToQueue(
    escalationId: string,
    priority: string
  ): Promise<RoutingResult> {
    await db
      .update(escalations)
      .set({
        status: "pending",
        priority: priority as "low" | "medium" | "high" | "urgent",
        updatedAt: new Date(),
      })
      .where(eq(escalations.id, escalationId));

    // Calculate queue position
    const queuePosition = await this.getQueuePosition(escalationId);

    return {
      success: false,
      reason: "No agents available, added to queue",
      queuePosition,
    };
  }

  /**
   * Get queue position for an escalation
   */
  async getQueuePosition(escalationId: string): Promise<number> {
    const result = await db.execute<{ position: number }>(sql`
      SELECT COUNT(*) + 1 as position
      FROM chatapp_escalations
      WHERE status = 'pending'
        AND created_at < (
          SELECT created_at FROM chatapp_escalations WHERE id = ${escalationId}
        )
    `);

    const firstRow = Array.isArray(result) ? result[0] : null;
    return firstRow?.position ?? 1;
  }

  /**
   * Get pending escalations in queue
   */
  async getPendingQueue(
    companyId: string,
    limit: number = 10
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      priority: string;
      reason: string | null;
      createdAt: Date;
      queuePosition: number;
    }>
  > {
    const pending = await db
      .select({
        id: escalations.id,
        conversationId: escalations.conversationId,
        priority: escalations.priority,
        reason: escalations.reason,
        createdAt: escalations.createdAt,
      })
      .from(escalations)
      .where(
        and(
          eq(escalations.status, "pending"),
          isNull(escalations.assignedUserId)
        )
      )
      .orderBy(
        desc(
          sql`CASE ${escalations.priority}
            WHEN 'urgent' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
          END`
        ),
        asc(escalations.createdAt)
      )
      .limit(limit);

    return pending.map((p, index) => ({
      ...p,
      queuePosition: index + 1,
    }));
  }

  /**
   * Process the queue - assign pending escalations to available agents
   */
  async processQueue(companyId: string): Promise<RoutingResult[]> {
    const results: RoutingResult[] = [];
    const pendingQueue = await this.getPendingQueue(companyId, 20);

    for (const pending of pendingQueue) {
      const result = await this.routeEscalation(pending.id, { companyId });
      results.push(result);

      if (!result.success) {
        // No more agents available, stop processing
        break;
      }
    }

    return results;
  }

  /**
   * Release an agent's slot when conversation ends
   */
  async releaseAgentSlot(agentId: string): Promise<void> {
    await db
      .update(supportAgentStatus)
      .set({
        currentChatCount: sql`GREATEST(0, ${supportAgentStatus.currentChatCount} - 1)`,
        lastActivityAt: new Date(),
      })
      .where(eq(supportAgentStatus.userId, agentId));

    // Check if there are pending escalations to assign
    const [agent] = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);

    if (agent?.companyId) {
      // Try to assign next pending escalation to this agent
      const pending = await this.getPendingQueue(agent.companyId, 1);
      if (pending.length > 0 && pending[0]) {
        await this.routeEscalation(pending[0].id, {
          companyId: agent.companyId,
          preferredAgentId: agentId,
          strategy: "preferred",
        });
      }
    }
  }
}

// Export singleton
let routingServiceInstance: RoutingService | null = null;

export function getRoutingService(): RoutingService {
  if (!routingServiceInstance) {
    routingServiceInstance = new RoutingService();
  }
  return routingServiceInstance;
}

// Export convenience functions
export async function routeEscalation(
  escalationId: string,
  options: RoutingOptions
): Promise<RoutingResult> {
  const service = getRoutingService();
  return service.routeEscalation(escalationId, options);
}

export async function getAvailableAgents(companyId: string): Promise<AvailableAgent[]> {
  const service = getRoutingService();
  return service.getAvailableAgents(companyId);
}

export async function processEscalationQueue(companyId: string): Promise<RoutingResult[]> {
  const service = getRoutingService();
  return service.processQueue(companyId);
}
