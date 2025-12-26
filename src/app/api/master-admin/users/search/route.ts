import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, ne, or, sql } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, companyPermissions, users } from "@/lib/db/schema";

/**
 * GET /api/master-admin/users/search
 * Search users (for impersonation)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Must be master admin
    if (session.user.role !== "chatapp.master_admin") {
      return NextResponse.json(
        { error: "Only master admins can search users" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Search users by name or email, excluding master admins and the current user
    // Get company info via company_permissions
    const results = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: companyPermissions.companyId,
        companyRole: companyPermissions.role,
        companyName: companies.name,
      })
      .from(users)
      .leftJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .leftJoin(companies, eq(companyPermissions.companyId, companies.id))
      .where(
        and(
          ne(users.role, "chatapp.master_admin"),
          ne(users.id, session.user.id),
          eq(users.isActive, true),
          sql`${users.deletedAt} IS NULL`,
          or(
            ilike(users.email, `%${query}%`),
            ilike(users.name, `%${query}%`)
          )
        )
      )
      .limit(10);

    return NextResponse.json({
      users: results.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.companyRole ?? user.role, // Prefer company role
        companyId: user.companyId,
        companyName: user.companyName,
      })),
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
