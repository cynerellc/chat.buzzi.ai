import { NextResponse } from "next/server";
import { and, eq, or, ne } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companyPermissions, users } from "@/lib/db/schema";

export interface SupportAgent {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
}

export interface SupportAgentsResponse {
  agents: SupportAgent[];
}

/**
 * GET /api/company/support-agents
 * Get all support agents and company admins for the current company.
 * These are users who can handle escalated conversations.
 */
export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    // Get users with support_agent or company_admin roles in this company
    const supportAgents = await db
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
          or(
            eq(companyPermissions.role, "chatapp.support_agent"),
            eq(companyPermissions.role, "chatapp.company_admin")
          ),
          ne(users.role, "chatapp.master_admin") // Exclude master admins
        )
      )
      .orderBy(users.name);

    const response: SupportAgentsResponse = {
      agents: supportAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        email: agent.email,
        avatarUrl: agent.avatarUrl,
        role: agent.role,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching support agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch support agents" },
      { status: 500 }
    );
  }
}
