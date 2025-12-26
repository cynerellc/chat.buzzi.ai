import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companyPermissions, users } from "@/lib/db/schema";
import { startImpersonation, endImpersonation, getImpersonationSession } from "@/lib/auth/impersonation";
import { createAuditLog } from "@/lib/audit/logger";

/**
 * POST /api/master-admin/impersonation
 * Start impersonating a user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Must be master admin
    if (session.user.role !== "chatapp.master_admin") {
      return NextResponse.json(
        { error: "Only master admins can impersonate users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, reason } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 }
      );
    }

    // Get the target user
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser[0]) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Cannot impersonate another master admin
    if (targetUser[0].role === "chatapp.master_admin") {
      return NextResponse.json(
        { error: "Cannot impersonate another master admin" },
        { status: 403 }
      );
    }

    // Start impersonation session
    const impersonationSession = await startImpersonation(
      { id: session.user.id, email: session.user.email ?? "" },
      { id: targetUser[0].id, email: targetUser[0].email },
      reason
    );

    // Log the impersonation
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "impersonation.start",
      resource: "user",
      resourceId: targetUser[0].id,
      details: {
        targetUserEmail: targetUser[0].email,
        reason: reason || "No reason provided",
      },
    });

    return NextResponse.json({
      success: true,
      session: {
        ...impersonationSession,
        targetUserName: targetUser[0].name || targetUser[0].email,
      },
    });
  } catch (error) {
    console.error("Error starting impersonation:", error);
    return NextResponse.json(
      { error: "Failed to start impersonation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-admin/impersonation
 * End current impersonation session
 */
export async function DELETE(_request: NextRequest) {
  try {
    const impersonationSession = await getImpersonationSession();

    if (!impersonationSession) {
      return NextResponse.json(
        { error: "No active impersonation session" },
        { status: 400 }
      );
    }

    // Log the end of impersonation
    await createAuditLog({
      userId: impersonationSession.originalUserId,
      userEmail: impersonationSession.originalUserEmail,
      action: "impersonation.end",
      resource: "user",
      resourceId: impersonationSession.impersonatedUserId,
      details: {
        targetUserEmail: impersonationSession.impersonatedUserEmail,
        duration: Date.now() - new Date(impersonationSession.startedAt).getTime(),
      },
    });

    await endImpersonation();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error ending impersonation:", error);
    return NextResponse.json(
      { error: "Failed to end impersonation" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/master-admin/impersonation
 * Get current impersonation session
 */
export async function GET() {
  try {
    const impersonationSession = await getImpersonationSession();

    if (!impersonationSession) {
      return NextResponse.json({ active: false, session: null });
    }

    // Get target user details
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, impersonationSession.impersonatedUserId))
      .limit(1);

    // Get the user's company and role from company_permissions
    const [permission] = await db
      .select({
        companyId: companyPermissions.companyId,
        companyRole: companyPermissions.role,
      })
      .from(companyPermissions)
      .where(eq(companyPermissions.userId, impersonationSession.impersonatedUserId))
      .limit(1);

    return NextResponse.json({
      active: true,
      session: {
        ...impersonationSession,
        targetUserName: targetUser[0]
          ? targetUser[0].name || targetUser[0].email
          : impersonationSession.impersonatedUserEmail,
        targetUserRole: permission?.companyRole ?? targetUser[0]?.role,
        targetCompanyId: permission?.companyId ?? null,
      },
    });
  } catch (error) {
    console.error("Error getting impersonation session:", error);
    return NextResponse.json(
      { error: "Failed to get impersonation session" },
      { status: 500 }
    );
  }
}
