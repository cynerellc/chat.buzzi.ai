/**
 * Company Escalation Details API
 *
 * Endpoints for viewing and managing individual escalations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalations, conversations } from "@/lib/db/schema/conversations";
import { eq, and } from "drizzle-orm";
import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getEscalationService } from "@/lib/escalation";

interface RouteParams {
  params: Promise<{ escalationId: string }>;
}

/**
 * GET /api/company/escalations/[escalationId]
 * Get escalation details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { escalationId } = await params;
    const { company } = await requireCompanyAdmin();

    // Verify escalation belongs to company
    const [escalation] = await db
      .select()
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .where(
        and(
          eq(escalations.id, escalationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!escalation) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    // Get full details
    const escalationService = getEscalationService();
    const details = await escalationService.getEscalation(escalationId);

    return NextResponse.json({ escalation: details });
  } catch (error) {
    console.error("Failed to fetch escalation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch escalation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/company/escalations/[escalationId]
 * Update escalation (priority, reassign, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { escalationId } = await params;
    const { company } = await requireCompanyAdmin();

    const body = await request.json();
    const { priority, assignedUserId, status } = body;

    // Verify escalation belongs to company
    const [existing] = await db
      .select({ id: escalations.id })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .where(
        and(
          eq(escalations.id, escalationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Partial<{
      priority: "low" | "medium" | "high" | "urgent";
      assignedUserId: string | null;
      assignedAt: Date;
      status: "pending" | "assigned" | "in_progress" | "resolved";
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (priority) {
      updateData.priority = priority;
    }

    if (assignedUserId !== undefined) {
      updateData.assignedUserId = assignedUserId;
      updateData.assignedAt = assignedUserId ? new Date() : undefined;
      updateData.status = assignedUserId ? "assigned" : "pending";
    }

    if (status) {
      updateData.status = status;
    }

    await db
      .update(escalations)
      .set(updateData)
      .where(eq(escalations.id, escalationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update escalation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update escalation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/company/escalations/[escalationId]
 * Cancel/delete an escalation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { escalationId } = await params;
    const { company } = await requireCompanyAdmin();

    // Verify escalation belongs to company
    const [existing] = await db
      .select({
        id: escalations.id,
        conversationId: escalations.conversationId,
        status: escalations.status,
      })
      .from(escalations)
      .innerJoin(conversations, eq(escalations.conversationId, conversations.id))
      .where(
        and(
          eq(escalations.id, escalationId),
          eq(conversations.companyId, company.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    // Can only cancel pending/assigned escalations
    if (existing.status !== "pending" && existing.status !== "assigned") {
      return NextResponse.json(
        { error: "Cannot cancel escalation in current status" },
        { status: 400 }
      );
    }

    // Delete escalation
    await db.delete(escalations).where(eq(escalations.id, escalationId));

    // Return conversation to AI
    await db
      .update(conversations)
      .set({
        status: "active",
        assignedUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, existing.conversationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete escalation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete escalation" },
      { status: 500 }
    );
  }
}
