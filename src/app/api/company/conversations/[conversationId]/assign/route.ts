import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companyPermissions, conversations, users } from "@/lib/db/schema";

interface AssignRequest {
  userId: string | null; // null to unassign
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { conversationId } = await params;

    const body: AssignRequest = await request.json();

    // Verify conversation belongs to company
    const [conversation] = await db
      .select({
        id: conversations.id,
        status: conversations.status,
        assignedUserId: conversations.assignedUserId,
      })
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

    // If assigning to a user, verify they belong to the company
    let assignee = null;
    if (body.userId) {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
        .where(and(eq(users.id, body.userId), eq(companyPermissions.companyId, company.id)))
        .limit(1);

      if (!user) {
        return NextResponse.json(
          { error: "User not found in your team" },
          { status: 400 }
        );
      }

      assignee = user;
    }

    // Update conversation assignment
    const updateData: Record<string, unknown> = {
      assignedUserId: body.userId,
      updatedAt: new Date(),
    };

    // If assigning to human, update status
    if (body.userId && conversation.status === "waiting_human") {
      updateData.status = "with_human";
    }

    // If unassigning and was with human, set back to waiting or active
    if (!body.userId && conversation.status === "with_human") {
      updateData.status = "waiting_human";
    }

    const [updatedConversation] = await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, conversationId))
      .returning();

    if (!updatedConversation) {
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: {
        id: updatedConversation.id,
        status: updatedConversation.status,
        assignedTo: assignee
          ? {
              id: assignee.id,
              name: assignee.name,
              email: assignee.email,
              avatarUrl: assignee.avatarUrl,
            }
          : null,
        updatedAt: updatedConversation.updatedAt.toISOString(),
      },
      message: body.userId
        ? `Conversation assigned to ${assignee?.name || assignee?.email}`
        : "Conversation unassigned",
    });
  } catch (error) {
    console.error("Error assigning conversation:", error);
    return NextResponse.json(
      { error: "Failed to assign conversation" },
      { status: 500 }
    );
  }
}
