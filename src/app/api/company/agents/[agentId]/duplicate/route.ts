import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();
    const { agentId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get the original agent
    const [originalAgent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!originalAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Create a duplicate with a new name
    const [duplicatedAgent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
        packageId: originalAgent.packageId,
        name: `${originalAgent.name} (Copy)`,
        description: originalAgent.description,
        type: originalAgent.type,
        status: "draft", // Always start as draft
        avatarUrl: originalAgent.avatarUrl,
        systemPrompt: originalAgent.systemPrompt,
        modelId: originalAgent.modelId,
        temperature: originalAgent.temperature,
        behavior: originalAgent.behavior,
        escalationEnabled: originalAgent.escalationEnabled,
        escalationTriggers: originalAgent.escalationTriggers,
        knowledgeSourceIds: originalAgent.knowledgeSourceIds,
      })
      .returning();

    return NextResponse.json({ agent: duplicatedAgent }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating agent:", error);
    return NextResponse.json(
      { error: "Failed to duplicate agent" },
      { status: 500 }
    );
  }
}
