/**
 * Company Escalations API
 *
 * Endpoints for company admins to manage and view escalations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalations, conversations, endUsers } from "@/lib/db/schema/conversations";
import { users } from "@/lib/db/schema/users";
import { agents } from "@/lib/db/schema/agents";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getEscalationService } from "@/lib/escalation";

/**
 * GET /api/company/escalations
 * List escalations for the company
 */
export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(conversations.companyId, company.id)];

    if (status) {
      conditions.push(eq(escalations.status, status as "pending" | "assigned" | "in_progress" | "resolved"));
    }

    if (priority) {
      conditions.push(eq(escalations.priority, priority as "low" | "medium" | "high" | "urgent"));
    }

    // Query escalations with related data
    const results = await db
      .select({
        id: escalations.id,
        conversationId: escalations.conversationId,
        status: escalations.status,
        priority: escalations.priority,
        reason: escalations.reason,
        triggerType: escalations.triggerType,
        assignedUserId: escalations.assignedUserId,
        assignedUserName: users.name,
        assignedAt: escalations.assignedAt,
        resolvedAt: escalations.resolvedAt,
        resolution: escalations.resolution,
        returnedToAi: escalations.returnedToAi,
        createdAt: escalations.createdAt,
        // Conversation details
        endUserName: endUsers.name,
        endUserEmail: endUsers.email,
        agentName: agents.name,
        messageCount: conversations.messageCount,
        sentiment: conversations.sentiment,
      })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .innerJoin(endUsers, eq(conversations.endUserId, endUsers.id))
      .innerJoin(agents, eq(conversations.agentId, agents.id))
      .leftJoin(users, eq(escalations.assignedUserId, users.id))
      .where(and(...conditions))
      .orderBy(
        asc(escalations.status),
        desc(
          sql`CASE ${escalations.priority}
            WHEN 'urgent' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
          END`
        ),
        desc(escalations.createdAt)
      )
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    return NextResponse.json({
      escalations: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch escalations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch escalations" },
      { status: error instanceof Error && error.message.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

/**
 * POST /api/company/escalations
 * Create a new escalation (manual escalation)
 */
export async function POST(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body = await request.json();
    const { conversationId, reason, priority = "medium" } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to company
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Create escalation
    const escalationService = getEscalationService();
    const result = await escalationService.createEscalation({
      conversationId,
      reason: reason ?? "Manually escalated by admin",
      triggerType: "manual",
      priority,
    });

    return NextResponse.json({
      success: true,
      escalationId: result.escalationId,
      routingResult: result.routingResult,
    });
  } catch (error) {
    console.error("Failed to create escalation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create escalation" },
      { status: 500 }
    );
  }
}
