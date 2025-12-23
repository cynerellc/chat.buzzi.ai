/**
 * Support Agent Escalations API
 *
 * Endpoints for support agents to view and manage their escalations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalations, conversations, endUsers, messages } from "@/lib/db/schema/conversations";
import { agents } from "@/lib/db/schema/agents";
import { users } from "@/lib/db/schema/users";
import { eq, and, desc, asc, sql, or, isNull } from "drizzle-orm";
import { requireSupportAgent } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { getEscalationService, getAvailableAgents } from "@/lib/escalation";

/**
 * GET /api/support-agent/escalations
 * Get escalations for the current support agent
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSupportAgent();
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "mine"; // mine, queue, all
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = (page - 1) * limit;

    // Build conditions based on view
    const conditions = [eq(conversations.companyId, company.id)];

    if (view === "mine") {
      // Only assigned to me or in progress by me
      conditions.push(eq(escalations.assignedUserId, user.id));
    } else if (view === "queue") {
      // Unassigned pending escalations
      conditions.push(eq(escalations.status, "pending"));
      conditions.push(isNull(escalations.assignedUserId));
    }
    // "all" shows everything in the company

    if (status) {
      conditions.push(eq(escalations.status, status as "pending" | "assigned" | "in_progress" | "resolved"));
    }

    // Query escalations
    const results = await db
      .select({
        id: escalations.id,
        conversationId: escalations.conversationId,
        status: escalations.status,
        priority: escalations.priority,
        reason: escalations.reason,
        triggerType: escalations.triggerType,
        assignedAt: escalations.assignedAt,
        createdAt: escalations.createdAt,
        endUserName: endUsers.name,
        endUserEmail: endUsers.email,
        agentName: agents.name,
        messageCount: conversations.messageCount,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .innerJoin(endUsers, eq(conversations.endUserId, endUsers.id))
      .innerJoin(agents, eq(conversations.agentId, agents.id))
      .where(and(...conditions))
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
      .limit(limit)
      .offset(offset);

    // Get counts for badges
    const [counts] = await db
      .select({
        mine: sql<number>`count(*) FILTER (WHERE ${escalations.assignedUserId} = ${user.id})::int`,
        queue: sql<number>`count(*) FILTER (WHERE ${escalations.status} = 'pending' AND ${escalations.assignedUserId} IS NULL)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .where(eq(conversations.companyId, company.id));

    return NextResponse.json({
      escalations: results,
      counts: {
        mine: counts?.mine ?? 0,
        queue: counts?.queue ?? 0,
        total: counts?.total ?? 0,
      },
      pagination: {
        page,
        limit,
        total: view === "mine" ? (counts?.mine ?? 0) : view === "queue" ? (counts?.queue ?? 0) : (counts?.total ?? 0),
      },
    });
  } catch (error) {
    console.error("Failed to fetch escalations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch escalations" },
      { status: 500 }
    );
  }
}
