import { eq, and, count, sql, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, conversations, messages } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export interface CompanyAgentItem {
  id: string;
  name: string;
  description: string | null;
  packageId: string | null;
  packageName: string;
  status: string;
  conversationCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/master-admin/companies/[companyId]/agents
 * List all agents for a company
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Get agents with package info
    const agentsData = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        packageId: agents.packageId,
        packageName: agentPackages.name,
        status: agents.status,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .leftJoin(agentPackages, eq(agents.packageId, agentPackages.id))
      .where(
        and(
          eq(agents.companyId, companyId),
          isNull(agents.deletedAt)
        )
      );

    // Get conversation and message counts for each agent
    const agentsWithStats: CompanyAgentItem[] = await Promise.all(
      agentsData.map(async (agent) => {
        // Get conversation count
        const [convCount] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.agentId, agent.id));

        // Get message count through conversations
        const agentConversations = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.agentId, agent.id));

        let msgCount = 0;
        if (agentConversations.length > 0) {
          const conversationIds = agentConversations.map((c) => c.id);
          const [messagesCount] = await db
            .select({ count: count() })
            .from(messages)
            .where(sql`${messages.conversationId} = ANY(${conversationIds})`);
          msgCount = messagesCount?.count ?? 0;
        }

        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          packageId: agent.packageId,
          packageName: agent.packageName ?? "Unknown",
          status: agent.status,
          conversationCount: convCount?.count ?? 0,
          messageCount: msgCount,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ agents: agentsWithStats });
  } catch (error) {
    console.error("Error fetching company agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch company agents" },
      { status: 500 }
    );
  }
}
