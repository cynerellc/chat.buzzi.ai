/**
 * C5: Server-side data fetching for Company Admin Dashboard
 *
 * These functions are wrapped with React.cache() for request-level deduplication.
 * Use in Server Components to fetch dashboard data directly without HTTP overhead.
 */
import { cache } from "react";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  agents,
  auditLogs,
  companySubscriptions,
  conversations,
  endUsers,
  messages,
  subscriptionPlans,
  users,
} from "@/lib/db/schema";
import { cacheThrough } from "@/lib/redis/cache";
import { REDIS_KEYS, REDIS_TTL } from "@/lib/redis/client";

// Types
export interface DashboardStats {
  activeConversations: number;
  activeConversationsChange: number;
  aiResolutionRate: number;
  aiResolutionChange: number;
  humanEscalations: number;
  humanEscalationsChange: number;
  avgResponseTime: number;
  avgResponseTimeChange: number;
}

export interface AgentOverview {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "paused" | "draft";
  type: string;
  todayConversations: number;
  aiResolutionRate: number;
}

export interface RecentConversation {
  id: string;
  endUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  agent: {
    id: string;
    name: string;
  };
  status: string;
  lastMessage: string | null;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  userName: string | null;
  createdAt: string;
}

export interface UsageItem {
  name: string;
  current: number;
  limit: number;
  percentage: number;
}

export interface UsageOverview {
  planName: string;
  usage: UsageItem[];
}

export interface CompanyDashboardData {
  stats: DashboardStats;
  agents: AgentOverview[];
  conversations: RecentConversation[];
  activities: ActivityItem[];
  usage: UsageOverview;
}

// Internal data fetching functions

async function fetchDashboardStats(companyId: string): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [
    activeConversationsResult,
    yesterdayActiveResult,
    aiResolvedToday,
    totalResolvedToday,
    humanEscalationsToday,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.status} IN ('active', 'waiting')`
        )
      ),
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.status} IN ('active', 'waiting')`,
          gte(conversations.createdAt, yesterday),
          sql`${conversations.createdAt} < ${today}`
        )
      ),
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          eq(conversations.resolutionType, "ai"),
          gte(conversations.resolvedAt, today)
        )
      ),
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.resolutionType} IS NOT NULL`,
          gte(conversations.resolvedAt, today)
        )
      ),
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          sql`${conversations.assignedUserId} IS NOT NULL`,
          gte(conversations.updatedAt, today)
        )
      ),
  ]);

  const totalResolved = totalResolvedToday[0]?.count ?? 0;
  const aiResolved = aiResolvedToday[0]?.count ?? 0;
  const aiResolutionRate =
    totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0;

  const avgResponseTime = 1.2; // placeholder

  const activeCount = activeConversationsResult[0]?.count ?? 0;
  const yesterdayCount = yesterdayActiveResult[0]?.count ?? 0;
  const escalationsCount = humanEscalationsToday[0]?.count ?? 0;

  return {
    activeConversations: activeCount,
    activeConversationsChange:
      yesterdayCount > 0
        ? Math.round(((activeCount - yesterdayCount) / yesterdayCount) * 100)
        : 0,
    aiResolutionRate,
    aiResolutionChange: 0,
    humanEscalations: escalationsCount,
    humanEscalationsChange: 0,
    avgResponseTime,
    avgResponseTimeChange: 0,
  };
}

async function fetchAgentsOverview(companyId: string): Promise<AgentOverview[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const companyAgentsRaw = await db
    .select({
      id: agents.id,
      name: agents.name,
      agentsList: agents.agentsList,
      status: agents.status,
      type: agents.type,
    })
    .from(agents)
    .where(eq(agents.companyId, companyId))
    .orderBy(agents.name);

  const companyAgents = companyAgentsRaw.map((agent) => {
    const agentsListData = (agent.agentsList as { avatar_url?: string }[] | null) || [];
    return {
      id: agent.id,
      name: agent.name,
      avatarUrl: agentsListData[0]?.avatar_url || null,
      status: agent.status,
      type: agent.type,
    };
  });

  const agentIds = companyAgents.map((a) => a.id);
  let statsMap: Map<string, { todayConversations: number; aiResolved: number; totalResolved: number }> = new Map();

  if (agentIds.length > 0) {
    const batchedStats = await db
      .select({
        chatbotId: conversations.chatbotId,
        todayConversations: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${today})`,
        aiResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} = 'ai' AND ${conversations.resolvedAt} >= ${today})`,
        totalResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} IS NOT NULL AND ${conversations.resolvedAt} >= ${today})`,
      })
      .from(conversations)
      .where(inArray(conversations.chatbotId, agentIds))
      .groupBy(conversations.chatbotId);

    statsMap = new Map(
      batchedStats.map((s) => [
        s.chatbotId,
        {
          todayConversations: Number(s.todayConversations) || 0,
          aiResolved: Number(s.aiResolved) || 0,
          totalResolved: Number(s.totalResolved) || 0,
        },
      ])
    );
  }

  return companyAgents.map((agent) => {
    const stats = statsMap.get(agent.id) || { todayConversations: 0, aiResolved: 0, totalResolved: 0 };
    const aiResolutionRate =
      stats.totalResolved > 0 ? Math.round((stats.aiResolved / stats.totalResolved) * 100) : 0;

    return {
      id: agent.id,
      name: agent.name,
      avatarUrl: agent.avatarUrl,
      status: agent.status as "active" | "paused" | "draft",
      type: agent.type,
      todayConversations: stats.todayConversations,
      aiResolutionRate,
    };
  });
}

async function fetchRecentConversations(companyId: string, limit: number = 5): Promise<RecentConversation[]> {
  const recentConversations = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      subject: conversations.subject,
      createdAt: conversations.createdAt,
      lastMessageAt: conversations.lastMessageAt,
      endUser: {
        id: endUsers.id,
        name: endUsers.name,
        email: endUsers.email,
        avatarUrl: endUsers.avatarUrl,
      },
      agent: {
        id: agents.id,
        name: agents.name,
      },
    })
    .from(conversations)
    .innerJoin(endUsers, eq(conversations.endUserId, endUsers.id))
    .innerJoin(agents, eq(conversations.chatbotId, agents.id))
    .where(eq(conversations.companyId, companyId))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
    .limit(limit);

  return recentConversations.map((conv) => ({
    id: conv.id,
    endUser: conv.endUser,
    agent: conv.agent,
    status: conv.status,
    lastMessage: conv.subject,
    createdAt: conv.createdAt.toISOString(),
    lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
  }));
}

async function fetchActivityFeed(companyId: string, limit: number = 10): Promise<ActivityItem[]> {
  const recentActivity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return recentActivity.map((log) => {
    let description = "";
    const details = log.details as Record<string, unknown> | null;

    switch (log.action) {
      case "agent.created":
        description = `created agent "${details?.name || "Unknown"}"`;
        break;
      case "agent.updated":
        description = `updated agent "${details?.name || "Unknown"}"`;
        break;
      case "knowledge.created":
        description = `added knowledge source "${details?.title || "Unknown"}"`;
        break;
      case "knowledge.updated":
        description = `updated knowledge source "${details?.title || "Unknown"}"`;
        break;
      case "team.user_invited":
        description = `invited ${details?.email || "a team member"}`;
        break;
      case "team.user_joined":
        description = "joined the team";
        break;
      case "settings.updated":
        description = "updated company settings";
        break;
      case "conversation.resolved":
        description = `resolved conversation`;
        break;
      default:
        description = log.action.replace(/\./g, " ").replace(/_/g, " ");
    }

    return {
      id: log.id,
      action: log.action,
      description,
      userName: log.userName || log.userEmail || "System",
      createdAt: log.createdAt.toISOString(),
    };
  });
}

async function fetchUsageOverview(companyId: string): Promise<UsageOverview> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Parallel fetch for subscription and counts
  const [subscription, messageCountResult, conversationCountResult] = await Promise.all([
    db
      .select({
        planName: subscriptionPlans.name,
        maxConversationsPerMonth: subscriptionPlans.maxConversationsPerMonth,
        maxStorageGb: subscriptionPlans.maxStorageGb,
      })
      .from(companySubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(companySubscriptions.planId, subscriptionPlans.id)
      )
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          eq(companySubscriptions.status, "active")
        )
      )
      .limit(1),
    db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.companyId, companyId),
          gte(messages.createdAt, monthStart)
        )
      ),
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, companyId),
          gte(conversations.createdAt, monthStart)
        )
      ),
  ]);

  const planName = subscription[0]?.planName || "Free";
  const maxConversations = subscription[0]?.maxConversationsPerMonth || 100;
  const maxStorageGb = subscription[0]?.maxStorageGb || 1;

  const messageCount = messageCountResult[0]?.count ?? 0;
  const conversationCount = conversationCountResult[0]?.count ?? 0;
  const messagesLimit = maxConversations * 10;

  return {
    planName,
    usage: [
      {
        name: "Messages",
        current: messageCount,
        limit: messagesLimit,
        percentage: Math.min(Math.round((messageCount / messagesLimit) * 100), 100),
      },
      {
        name: "Conversations",
        current: conversationCount,
        limit: maxConversations,
        percentage: Math.min(
          Math.round((conversationCount / maxConversations) * 100),
          100
        ),
      },
      {
        name: "Storage",
        current: 0,
        limit: maxStorageGb * 1024,
        percentage: 0,
      },
      {
        name: "API Calls",
        current: 0,
        limit: 100000,
        percentage: 0,
      },
    ],
  };
}

// Cached exports for Server Components

/**
 * Cached dashboard stats - includes Redis caching with 5 min TTL
 */
export const cachedGetDashboardStats = cache(async (companyId: string): Promise<DashboardStats> => {
  return cacheThrough(
    REDIS_KEYS.dashboardCompanyStats(companyId),
    () => fetchDashboardStats(companyId),
    REDIS_TTL.DASHBOARD_STATS
  );
});

/**
 * Cached agents overview
 */
export const cachedGetAgentsOverview = cache(async (companyId: string): Promise<AgentOverview[]> => {
  return fetchAgentsOverview(companyId);
});

/**
 * Cached recent conversations
 */
export const cachedGetRecentConversations = cache(async (companyId: string, limit: number = 5): Promise<RecentConversation[]> => {
  return fetchRecentConversations(companyId, limit);
});

/**
 * Cached activity feed
 */
export const cachedGetActivityFeed = cache(async (companyId: string, limit: number = 10): Promise<ActivityItem[]> => {
  return fetchActivityFeed(companyId, limit);
});

/**
 * Cached usage overview
 */
export const cachedGetUsageOverview = cache(async (companyId: string): Promise<UsageOverview> => {
  return fetchUsageOverview(companyId);
});

/**
 * Fetch all dashboard data in parallel for Server Components
 * This is the main entry point for the dashboard Server Component
 */
export const cachedGetCompanyDashboardData = cache(async (companyId: string): Promise<CompanyDashboardData> => {
  const [stats, agentsData, conversationsData, activities, usage] = await Promise.all([
    cachedGetDashboardStats(companyId),
    cachedGetAgentsOverview(companyId),
    cachedGetRecentConversations(companyId, 5),
    cachedGetActivityFeed(companyId, 10),
    cachedGetUsageOverview(companyId),
  ]);

  return {
    stats,
    agents: agentsData,
    conversations: conversationsData,
    activities,
    usage,
  };
});
