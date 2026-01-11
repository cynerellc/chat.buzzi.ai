/**
 * Support Agent Transfer API
 *
 * POST /api/support-agent/conversations/[conversationId]/transfer - Transfer conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages, escalations } from "@/lib/db/schema/conversations";
import { companyPermissions } from "@/lib/db/schema/company-permissions";
import { users } from "@/lib/db/schema/users";
import { requireSupportAgent } from "@/lib/auth/guards";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";

interface RouteParams {
  conversationId: string;
}

const transferSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  includeNote: z.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { conversationId } = await params;

    // Authenticate user and get company context
    const { user, company } = await requireSupportAgent();

    // Parse and validate body
    const body = await request.json();
    const data = transferSchema.parse(body);

    // Verify conversation exists and belongs to company
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

    // Check if conversation is already resolved
    if (conversation.status === "resolved" || conversation.status === "abandoned") {
      return NextResponse.json(
        { error: "Cannot transfer resolved conversation" },
        { status: 400 }
      );
    }

    // Verify target user exists and belongs to the same company (via company_permissions)
    const [targetUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: companyPermissions.role,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(users.id, data.targetUserId),
          eq(companyPermissions.companyId, company.id),
          eq(users.isActive, true),
          sql`${users.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target agent not found" },
        { status: 404 }
      );
    }

    // Cannot transfer to self
    if (data.targetUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot transfer to yourself" },
        { status: 400 }
      );
    }

    // Get current user info
    const [currentUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const currentUserName = currentUser?.name || "Agent";
    const targetUserName = targetUser.name || "Agent";

    // Update conversation assignment
    await db
      .update(conversations)
      .set({
        assignedUserId: data.targetUserId,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    // Update any pending escalations
    await db
      .update(escalations)
      .set({
        assignedUserId: data.targetUserId,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(escalations.conversationId, conversationId),
          eq(escalations.status, "assigned")
        )
      );

    // Add system message about transfer
    if (data.includeNote) {
      const transferMessage = data.reason
        ? `Conversation transferred from ${currentUserName} to ${targetUserName}. Reason: ${data.reason}`
        : `Conversation transferred from ${currentUserName} to ${targetUserName}`;

      await db.insert(messages).values({
        conversationId,
        role: "system",
        type: "text",
        content: transferMessage,
        agentDetails: {
          agentId: "system",
          agentType: "system",
          agentName: "System",
        },
      });
    }

    return NextResponse.json({
      success: true,
      transfer: {
        conversationId,
        fromUserId: user.id,
        fromUserName: currentUserName,
        toUserId: data.targetUserId,
        toUserName: targetUserName,
        reason: data.reason,
        transferredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Transfer conversation error:", error);
    return NextResponse.json(
      { error: "Failed to transfer conversation" },
      { status: 500 }
    );
  }
}

// GET - List available agents for transfer
export async function GET(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: { params: Promise<RouteParams> }
) {
  try {
    // Authenticate user and get company context
    const { user, company } = await requireSupportAgent();

    // Get all active support agents in the company (excluding current user)
    // via company_permissions table
    const availableAgents = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: companyPermissions.role,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(companyPermissions.companyId, company.id),
          eq(users.isActive, true),
          ne(users.id, user.id),
          sql`${users.deletedAt} IS NULL`
        )
      );

    // Filter to only support agents and company admins
    const agents = availableAgents.filter(
      (agent) => agent.role === "chatapp.support_agent" || agent.role === "chatapp.company_admin"
    );

    return NextResponse.json({
      agents,
    });
  } catch (error) {
    console.error("Get transfer agents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch available agents" },
      { status: 500 }
    );
  }
}
