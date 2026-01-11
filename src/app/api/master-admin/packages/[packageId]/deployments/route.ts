import { eq, and, count, isNull, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, companies, conversations } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ packageId: string }>;
}

export interface PackageDeployment {
  id: string;
  agentId: string;
  agentName: string;
  companyId: string;
  companyName: string;
  versionId: string;
  version: string;
  deployedAt: string;
  status: "active" | "inactive" | "error";
  lastActivityAt: string | null;
  conversationCount: number;
}

/**
 * GET /api/master-admin/packages/[packageId]/deployments
 * List all deployments (agents) using a package
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;

    // Get all agents using this package
    const agentsData = await db
      .select({
        id: agents.id,
        name: agents.name,
        companyId: agents.companyId,
        companyName: companies.name,
        status: agents.status,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .innerJoin(companies, eq(agents.companyId, companies.id))
      .where(
        and(
          eq(agents.packageId, packageId),
          isNull(agents.deletedAt)
        )
      )
      .orderBy(desc(agents.createdAt));

    // Get conversation counts and last activity for each agent
    const deployments: PackageDeployment[] = await Promise.all(
      agentsData.map(async (agent) => {
        // Get conversation count
        const [convCount] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.chatbotId, agent.id));

        // Get last conversation timestamp
        const [lastConv] = await db
          .select({ updatedAt: conversations.updatedAt })
          .from(conversations)
          .where(eq(conversations.chatbotId, agent.id))
          .orderBy(desc(conversations.updatedAt))
          .limit(1);

        return {
          id: `${agent.id}-deployment`,
          agentId: agent.id,
          agentName: agent.name,
          companyId: agent.companyId,
          companyName: agent.companyName,
          versionId: "current", // In production, track actual version
          version: "1.0.0", // In production, track actual version
          deployedAt: agent.createdAt.toISOString(),
          status: agent.status === "active" ? "active" : "inactive",
          lastActivityAt: lastConv?.updatedAt?.toISOString() ?? null,
          conversationCount: convCount?.count ?? 0,
        };
      })
    );

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error("Error fetching package deployments:", error);
    return NextResponse.json(
      { error: "Failed to fetch package deployments" },
      { status: 500 }
    );
  }
}
