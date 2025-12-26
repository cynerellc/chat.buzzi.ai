import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, agentVersions, type PackageVariableDefinition } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { agentId } = await params;

    const [agent] = await db
      .select({
        id: agents.id,
        companyId: agents.companyId,
        packageId: agents.packageId,
        name: agents.name,
        description: agents.description,
        type: agents.type,
        status: agents.status,
        avatarUrl: agents.avatarUrl,
        systemPrompt: agents.systemPrompt,
        modelId: agents.modelId,
        temperature: agents.temperature,
        behavior: agents.behavior,
        escalationEnabled: agents.escalationEnabled,
        escalationTriggers: agents.escalationTriggers,
        knowledgeSourceIds: agents.knowledgeSourceIds,
        variableValues: agents.variableValues,
        totalConversations: agents.totalConversations,
        avgResolutionTime: agents.avgResolutionTime,
        satisfactionScore: agents.satisfactionScore,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
        package: {
          id: agentPackages.id,
          name: agentPackages.name,
          slug: agentPackages.slug,
          variables: agentPackages.variables,
        },
      })
      .from(agents)
      .leftJoin(agentPackages, eq(agents.packageId, agentPackages.id))
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Combine package variable definitions with agent's variable values
    const packageVariables = (agent.package?.variables as PackageVariableDefinition[]) || [];
    const agentVariableValues = (agent.variableValues as Record<string, string>) || {};

    // Build variable values with definitions for the response
    const variableValuesWithDefinitions = packageVariables.map((pv) => ({
      name: pv.name,
      displayName: pv.displayName,
      description: pv.description,
      variableType: pv.variableType,
      dataType: pv.dataType,
      required: pv.required,
      placeholder: pv.placeholder,
      // Mask secured variable values
      value: pv.variableType === "secured_variable" && agentVariableValues[pv.name]
        ? "••••••••"
        : agentVariableValues[pv.name] || null,
    }));

    return NextResponse.json({
      agent: {
        ...agent,
        variableValues: variableValuesWithDefinitions,
        // Also include the raw variable values for editing
        rawVariableValues: agentVariableValues,
      },
    });
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

interface UpdateAgentRequest {
  name?: string;
  description?: string;
  type?: "support" | "sales" | "general" | "custom";
  status?: "active" | "paused" | "draft";
  avatarUrl?: string | null;
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  behavior?: Record<string, unknown>;
  escalationEnabled?: boolean;
  escalationTriggers?: unknown[];
  knowledgeSourceIds?: string[];
  // Variable values are now stored as a simple key-value object
  variableValues?: Record<string, string>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { agentId } = await params;

    // Verify agent belongs to company
    const [existingAgent] = await db
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

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const body: UpdateAgentRequest = await request.json();

    // Build update object with only provided fields
    const updateData: Partial<typeof agents.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.modelId !== undefined) updateData.modelId = body.modelId;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.behavior !== undefined) updateData.behavior = body.behavior;
    if (body.escalationEnabled !== undefined) updateData.escalationEnabled = body.escalationEnabled;
    if (body.escalationTriggers !== undefined) updateData.escalationTriggers = body.escalationTriggers;
    if (body.knowledgeSourceIds !== undefined) updateData.knowledgeSourceIds = body.knowledgeSourceIds;
    // Variable values are now stored directly in the agent as JSONB
    if (body.variableValues !== undefined) {
      // Merge with existing values (preserve values not being updated)
      const existingValues = (existingAgent.variableValues as Record<string, string>) || {};
      updateData.variableValues = { ...existingValues, ...body.variableValues };
    }

    // If systemPrompt changed, create a version
    if (body.systemPrompt && body.systemPrompt !== existingAgent.systemPrompt) {
      // Get latest version number
      const [latestVersion] = await db
        .select({ version: agentVersions.version })
        .from(agentVersions)
        .where(eq(agentVersions.agentId, agentId))
        .orderBy(agentVersions.version)
        .limit(1);

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // Create version snapshot
      await db.insert(agentVersions).values({
        agentId,
        version: nextVersion,
        changelog: "System prompt updated",
        systemPrompt: body.systemPrompt,
        modelId: body.modelId || existingAgent.modelId,
        temperature: body.temperature ?? existingAgent.temperature,
        behavior: body.behavior || existingAgent.behavior,
      });
    }

    // Update the agent (variable values are now part of updateData if provided)
    const [updatedAgent] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, agentId))
      .returning();

    return NextResponse.json({ agent: updatedAgent });
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { agentId } = await params;

    // Verify agent belongs to company
    const [existingAgent] = await db
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

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Soft delete - just set deletedAt
    await db
      .update(agents)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
