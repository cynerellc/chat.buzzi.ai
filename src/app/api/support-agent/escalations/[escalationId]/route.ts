/**
 * Support Agent Escalation Actions API
 *
 * Endpoints for support agents to take action on escalations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalations, conversations, messages } from "@/lib/db/schema/conversations";
import { eq, and, desc } from "drizzle-orm";
import { requireSupportAgent } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { getEscalationService } from "@/lib/escalation";

interface RouteParams {
  params: Promise<{ escalationId: string }>;
}

/**
 * GET /api/support-agent/escalations/[escalationId]
 * Get escalation details with conversation history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { escalationId } = await params;
    await requireSupportAgent();
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

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

    // Get full escalation details
    const escalationService = getEscalationService();
    const details = await escalationService.getEscalation(escalationId);

    // Get conversation messages
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, escalation.chatapp_escalations.conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(50);

    return NextResponse.json({
      escalation: details,
      messages: conversationMessages.reverse(),
    });
  } catch (error) {
    console.error("Failed to fetch escalation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch escalation" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/support-agent/escalations/[escalationId]
 * Take action on an escalation (accept, resolve, return)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { escalationId } = await params;
    const user = await requireSupportAgent();
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, resolution, returnToAi } = body;

    // Verify escalation belongs to company
    const [existing] = await db
      .select({ id: escalations.id, conversationId: escalations.conversationId })
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

    const escalationService = getEscalationService();

    switch (action) {
      case "accept": {
        // Accept/claim the escalation
        const result = await escalationService.acceptEscalation(escalationId, user.id);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, action: "accepted" });
      }

      case "resolve": {
        // Resolve the escalation
        if (!resolution) {
          return NextResponse.json(
            { error: "Resolution message is required" },
            { status: 400 }
          );
        }
        const result = await escalationService.resolveEscalation(escalationId, {
          resolution,
          returnToAi: returnToAi ?? false,
          resolvedBy: user.id,
        });
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, action: "resolved" });
      }

      case "return_to_ai": {
        // Return conversation to AI
        const result = await escalationService.returnToAi(escalationId, user.id);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, action: "returned_to_ai" });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: accept, resolve, or return_to_ai" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Failed to process escalation action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process action" },
      { status: 500 }
    );
  }
}
