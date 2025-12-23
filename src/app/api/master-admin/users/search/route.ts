import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, ne, or } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, users } from "@/lib/db/schema";

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
    if (session.user.role !== "master_admin") {
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
    const results = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: users.companyId,
        companyName: companies.name,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(
        and(
          ne(users.role, "master_admin"),
          ne(users.id, session.user.id),
          eq(users.isActive, true),
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
        role: user.role,
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
