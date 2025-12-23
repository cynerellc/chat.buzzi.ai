/**
 * Support Agent Status API
 *
 * GET /api/support-agent/status - Get agent status
 * PUT /api/support-agent/status - Update agent status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportAgentStatus, conversations } from "@/lib/db/schema/conversations";
import { users } from "@/lib/db/schema/users";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { and, eq, or, sql } from "drizzle-orm";

type AgentStatus = "online" | "busy" | "away" | "invisible" | "offline";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get or create agent status
    let [status] = await db
      .select()
      .from(supportAgentStatus)
      .where(eq(supportAgentStatus.userId, session.user.id))
      .limit(1);

    if (!status) {
      // Create default status
      [status] = await db
        .insert(supportAgentStatus)
        .values({
          userId: session.user.id,
          status: "offline",
          maxConcurrentChats: 5,
          currentChatCount: 0,
        })
        .returning();
    }

    // Get current active chat count
    const [activeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          eq(conversations.assignedUserId, session.user.id),
          or(
            eq(conversations.status, "active"),
            eq(conversations.status, "with_human")
          )
        )
      );

    // Get online teammates (for capacity display)
    const onlineTeammates = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: supportAgentStatus.status,
        currentChatCount: supportAgentStatus.currentChatCount,
        maxConcurrentChats: supportAgentStatus.maxConcurrentChats,
      })
      .from(supportAgentStatus)
      .innerJoin(users, eq(supportAgentStatus.userId, users.id))
      .where(
        and(
          eq(users.companyId, company.id),
          or(
            eq(supportAgentStatus.status, "online"),
            eq(supportAgentStatus.status, "busy")
          )
        )
      );

    return NextResponse.json({
      status: status?.status ?? "offline",
      maxConcurrentChats: status?.maxConcurrentChats ?? 5,
      currentChatCount: activeCount?.count ?? 0,
      lastStatusChange: status?.lastStatusChange,
      lastActivityAt: status?.lastActivityAt,
      teammates: onlineTeammates.filter((t) => t.id !== session.user.id),
    });
  } catch (error) {
    console.error("Get agent status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent status" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status, maxConcurrentChats } = body as {
      status?: AgentStatus;
      maxConcurrentChats?: number;
    };

    // Validate status
    const validStatuses: AgentStatus[] = ["online", "busy", "away", "invisible", "offline"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Validate max concurrent chats
    if (maxConcurrentChats !== undefined && (maxConcurrentChats < 1 || maxConcurrentChats > 20)) {
      return NextResponse.json(
        { error: "Max concurrent chats must be between 1 and 20" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Partial<typeof supportAgentStatus.$inferInsert> = {
      lastActivityAt: new Date(),
    };

    if (status) {
      updateData.status = status;
      updateData.lastStatusChange = new Date();
    }

    if (maxConcurrentChats !== undefined) {
      updateData.maxConcurrentChats = maxConcurrentChats;
    }

    // Check if status record exists
    const [existing] = await db
      .select()
      .from(supportAgentStatus)
      .where(eq(supportAgentStatus.userId, session.user.id))
      .limit(1);

    let updatedStatus;

    if (existing) {
      [updatedStatus] = await db
        .update(supportAgentStatus)
        .set(updateData)
        .where(eq(supportAgentStatus.userId, session.user.id))
        .returning();
    } else {
      [updatedStatus] = await db
        .insert(supportAgentStatus)
        .values({
          userId: session.user.id,
          status: status ?? "offline",
          maxConcurrentChats: maxConcurrentChats ?? 5,
          currentChatCount: 0,
          lastStatusChange: new Date(),
          lastActivityAt: new Date(),
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      status: updatedStatus?.status,
      maxConcurrentChats: updatedStatus?.maxConcurrentChats,
      lastStatusChange: updatedStatus?.lastStatusChange,
    });
  } catch (error) {
    console.error("Update agent status error:", error);
    return NextResponse.json(
      { error: "Failed to update agent status" },
      { status: 500 }
    );
  }
}
