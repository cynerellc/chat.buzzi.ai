/**
 * HITL (Human-in-the-Loop) Metrics Analytics
 *
 * Tracks and analyzes metrics related to human agent interventions
 * in AI-assisted conversations.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Types
export interface HITLMetrics {
  // Escalation Metrics
  totalEscalations: number;
  escalationRate: number; // Percentage of conversations escalated
  avgTimeToEscalation: number; // Minutes from start to escalation
  escalationsByReason: Record<string, number>;

  // Resolution Metrics
  avgResolutionTime: number; // Minutes to resolve after escalation
  firstContactResolutionRate: number; // Percentage resolved without re-escalation
  resolutionsByAgent: Record<string, number>;

  // Quality Metrics
  avgCustomerSatisfaction: number; // 1-5 scale
  avgAgentPerformance: number; // Composite score
  avgResponseTime: number; // Seconds between customer message and agent response

  // Efficiency Metrics
  aiHandoffAccuracy: number; // Percentage of correct escalation decisions
  avgMessagesBeforeEscalation: number;
  avgMessagesAfterEscalation: number;

  // Volume Metrics
  totalConversations: number;
  aiOnlyConversations: number;
  humanAssistedConversations: number;

  // Time-based breakdown
  escalationsByHour: Record<number, number>;
  escalationsByDayOfWeek: Record<number, number>;
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalConversationsHandled: number;
  avgHandleTime: number; // Minutes
  avgResponseTime: number; // Seconds
  avgCustomerSatisfaction: number;
  escalationsReceived: number;
  escalationsResolved: number;
  firstContactResolutionRate: number;
  utilizationRate: number; // Percentage of time actively handling conversations
}

export interface EscalationTrend {
  date: string;
  totalConversations: number;
  escalations: number;
  escalationRate: number;
  avgResolutionTime: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * HITL Metrics Service
 */
export class HITLMetricsService {
  /**
   * Get comprehensive HITL metrics for a company
   */
  async getMetrics(companyId: string, dateRange: DateRange): Promise<HITLMetrics> {
    const { startDate, endDate } = dateRange;

    // Get base conversation stats
    const conversationStats = await db.execute<{
      total: number;
      escalated: number;
      avg_messages_before: number;
      avg_messages_after: number;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM chatapp.escalations e WHERE e.conversation_id = c.id
        ) THEN 1 END) as escalated,
        AVG(CASE WHEN EXISTS (SELECT 1 FROM chatapp.escalations e2 WHERE e2.conversation_id = c.id) THEN
          (SELECT COUNT(*) FROM chatapp.messages m WHERE m.conversation_id = c.id AND m.created_at <
           (SELECT MIN(e.created_at) FROM chatapp.escalations e WHERE e.conversation_id = c.id))
        END) as avg_messages_before,
        AVG(CASE WHEN EXISTS (SELECT 1 FROM chatapp.escalations e2 WHERE e2.conversation_id = c.id) THEN
          (SELECT COUNT(*) FROM chatapp.messages m WHERE m.conversation_id = c.id AND m.created_at >=
           (SELECT MIN(e.created_at) FROM chatapp.escalations e WHERE e.conversation_id = c.id))
        END) as avg_messages_after
      FROM chatapp.conversations c
      WHERE c.company_id = ${companyId}
        AND c.created_at >= ${startDate}
        AND c.created_at <= ${endDate}
    `);

    // Get escalation stats by reason
    const escalationReasons = await db.execute<{
      reason: string;
      count: number;
    }>(sql`
      SELECT reason, COUNT(*) as count
      FROM chatapp.escalations
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY reason
    `);

    // Get resolution stats
    const resolutionStats = await db.execute<{
      avg_resolution_time: number;
      fcr_rate: number;
      avg_satisfaction: number;
    }>(sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_time,
        COUNT(CASE WHEN NOT EXISTS (
          SELECT 1 FROM chatapp.escalations e2
          WHERE e2.conversation_id = e.conversation_id
          AND e2.created_at > e.resolved_at
        ) THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as fcr_rate,
        AVG(satisfaction_score) as avg_satisfaction
      FROM chatapp.escalations e
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND resolved_at IS NOT NULL
    `);

    // Get hourly breakdown
    const hourlyBreakdown = await db.execute<{
      hour: number;
      count: number;
    }>(sql`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as count
      FROM chatapp.escalations
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY hour
      ORDER BY hour
    `);

    // Get daily breakdown
    const dailyBreakdown = await db.execute<{
      day: number;
      count: number;
    }>(sql`
      SELECT EXTRACT(DOW FROM created_at)::int as day, COUNT(*) as count
      FROM chatapp.escalations
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY day
      ORDER BY day
    `);

    // Get resolutions by agent
    const agentResolutions = await db.execute<{
      agent_id: string;
      count: number;
    }>(sql`
      SELECT assigned_agent_id as agent_id, COUNT(*) as count
      FROM chatapp.escalations
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND resolved_at IS NOT NULL
        AND assigned_agent_id IS NOT NULL
      GROUP BY assigned_agent_id
    `);

    // Get response time stats
    const responseTimeStats = await db.execute<{
      avg_response_time: number;
    }>(sql`
      SELECT AVG(
        EXTRACT(EPOCH FROM (
          (SELECT MIN(m2.created_at) FROM chatapp.messages m2
           WHERE m2.conversation_id = m.conversation_id
           AND m2.sender_type = 'agent'
           AND m2.created_at > m.created_at)
          - m.created_at
        ))
      ) as avg_response_time
      FROM chatapp.messages m
      JOIN chatapp.conversations c ON m.conversation_id = c.id
      WHERE c.company_id = ${companyId}
        AND m.sender_type = 'customer'
        AND m.created_at >= ${startDate}
        AND m.created_at <= ${endDate}
    `);

    const stats = conversationStats[0];
    const resolution = resolutionStats[0];
    const response = responseTimeStats[0];

    return {
      // Escalation Metrics
      totalEscalations: stats?.escalated || 0,
      escalationRate: stats?.total ? (stats.escalated / stats.total) * 100 : 0,
      avgTimeToEscalation: 0, // Calculate from escalation records
      escalationsByReason: Object.fromEntries(
        escalationReasons.map((r) => [r.reason, r.count])
      ),

      // Resolution Metrics
      avgResolutionTime: resolution?.avg_resolution_time || 0,
      firstContactResolutionRate: resolution?.fcr_rate || 0,
      resolutionsByAgent: Object.fromEntries(
        agentResolutions.map((a) => [a.agent_id, a.count])
      ),

      // Quality Metrics
      avgCustomerSatisfaction: resolution?.avg_satisfaction || 0,
      avgAgentPerformance: 0, // Composite metric
      avgResponseTime: response?.avg_response_time || 0,

      // Efficiency Metrics
      aiHandoffAccuracy: 85, // Placeholder - needs ML model
      avgMessagesBeforeEscalation: stats?.avg_messages_before || 0,
      avgMessagesAfterEscalation: stats?.avg_messages_after || 0,

      // Volume Metrics
      totalConversations: stats?.total || 0,
      aiOnlyConversations: (stats?.total || 0) - (stats?.escalated || 0),
      humanAssistedConversations: stats?.escalated || 0,

      // Time-based breakdown
      escalationsByHour: Object.fromEntries(
        hourlyBreakdown.map((h) => [h.hour, h.count])
      ),
      escalationsByDayOfWeek: Object.fromEntries(
        dailyBreakdown.map((d) => [d.day, d.count])
      ),
    };
  }

  /**
   * Get metrics for a specific agent
   */
  async getAgentMetrics(
    companyId: string,
    agentId: string,
    dateRange: DateRange
  ): Promise<AgentMetrics> {
    const { startDate, endDate } = dateRange;

    const stats = await db.execute<{
      agent_name: string;
      total_conversations: number;
      avg_handle_time: number;
      avg_response_time: number;
      avg_satisfaction: number;
      escalations_received: number;
      escalations_resolved: number;
    }>(sql`
      SELECT
        u.name as agent_name,
        COUNT(DISTINCT e.conversation_id) as total_conversations,
        AVG(EXTRACT(EPOCH FROM (e.resolved_at - e.assigned_at))/60) as avg_handle_time,
        0 as avg_response_time,
        AVG(e.satisfaction_score) as avg_satisfaction,
        COUNT(*) as escalations_received,
        COUNT(CASE WHEN e.resolved_at IS NOT NULL THEN 1 END) as escalations_resolved
      FROM chatapp.escalations e
      JOIN chatapp.users u ON e.assigned_agent_id = u.id
      WHERE e.company_id = ${companyId}
        AND e.assigned_agent_id = ${agentId}
        AND e.created_at >= ${startDate}
        AND e.created_at <= ${endDate}
      GROUP BY u.name
    `);

    const agentStats = stats[0];

    return {
      agentId,
      agentName: agentStats?.agent_name || "Unknown",
      totalConversationsHandled: agentStats?.total_conversations || 0,
      avgHandleTime: agentStats?.avg_handle_time || 0,
      avgResponseTime: agentStats?.avg_response_time || 0,
      avgCustomerSatisfaction: agentStats?.avg_satisfaction || 0,
      escalationsReceived: agentStats?.escalations_received || 0,
      escalationsResolved: agentStats?.escalations_resolved || 0,
      firstContactResolutionRate: agentStats?.escalations_received
        ? (agentStats.escalations_resolved / agentStats.escalations_received) * 100
        : 0,
      utilizationRate: 0, // Requires shift tracking
    };
  }

  /**
   * Get escalation trends over time
   */
  async getEscalationTrends(
    companyId: string,
    dateRange: DateRange,
    granularity: "day" | "week" | "month" = "day"
  ): Promise<EscalationTrend[]> {
    const { startDate, endDate } = dateRange;

    const truncate = granularity === "day" ? "day" : granularity === "week" ? "week" : "month";

    const trends = await db.execute<{
      date: Date;
      total_conversations: number;
      escalations: number;
      avg_resolution_time: number;
    }>(sql`
      SELECT
        DATE_TRUNC(${truncate}, c.created_at) as date,
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(DISTINCT e.id) as escalations,
        AVG(EXTRACT(EPOCH FROM (e.resolved_at - e.created_at))/60) as avg_resolution_time
      FROM chatapp.conversations c
      LEFT JOIN chatapp.escalations e ON c.id = e.conversation_id
      WHERE c.company_id = ${companyId}
        AND c.created_at >= ${startDate}
        AND c.created_at <= ${endDate}
      GROUP BY DATE_TRUNC(${truncate}, c.created_at)
      ORDER BY date
    `);

    return trends.map((t) => ({
      date: t.date.toISOString().split("T")[0]!,
      totalConversations: t.total_conversations,
      escalations: t.escalations,
      escalationRate: t.total_conversations
        ? (t.escalations / t.total_conversations) * 100
        : 0,
      avgResolutionTime: t.avg_resolution_time || 0,
    }));
  }

  /**
   * Get top escalation reasons
   */
  async getTopEscalationReasons(
    companyId: string,
    dateRange: DateRange,
    limit: number = 10
  ): Promise<Array<{ reason: string; count: number; percentage: number }>> {
    const { startDate, endDate } = dateRange;

    const reasons = await db.execute<{
      reason: string;
      count: number;
      total: number;
    }>(sql`
      SELECT
        reason,
        COUNT(*) as count,
        (SELECT COUNT(*) FROM chatapp.escalations
         WHERE company_id = ${companyId}
         AND created_at >= ${startDate}
         AND created_at <= ${endDate}) as total
      FROM chatapp.escalations
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY reason
      ORDER BY count DESC
      LIMIT ${limit}
    `);

    return reasons.map((r) => ({
      reason: r.reason,
      count: r.count,
      percentage: r.total ? (r.count / r.total) * 100 : 0,
    }));
  }

  /**
   * Get peak escalation hours
   */
  async getPeakHours(
    companyId: string,
    dateRange: DateRange
  ): Promise<Array<{ hour: number; count: number; avgWaitTime: number }>> {
    const { startDate, endDate } = dateRange;

    const hours = await db.execute<{
      hour: number;
      count: number;
      avg_wait_time: number;
    }>(sql`
      SELECT
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (assigned_at - created_at))) as avg_wait_time
      FROM chatapp.escalations
      WHERE company_id = ${companyId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY hour
      ORDER BY count DESC
    `);

    return hours.map((h) => ({
      hour: h.hour,
      count: h.count,
      avgWaitTime: h.avg_wait_time || 0,
    }));
  }
}

// Singleton instance
let metricsServiceInstance: HITLMetricsService | null = null;

export function getHITLMetricsService(): HITLMetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new HITLMetricsService();
  }
  return metricsServiceInstance;
}
