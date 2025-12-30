import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, agentVersions, type PackageVariableDefinition, type AgentListItem } from "@/lib/db/schema";

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
        agentsList: agents.agentsList,
        behavior: agents.behavior,
        escalationEnabled: agents.escalationEnabled,
        escalationTriggers: agents.escalationTriggers,
        variableValues: agents.variableValues,
        businessHours: agents.businessHours,
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

    // Get primary agent from agents_list for backward compatibility
    const agentsList = (agent.agentsList as AgentListItem[]) || [];
    const primaryAgent = agentsList[0];

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
        // Provide backward-compatible fields from primary agent
        avatarUrl: primaryAgent?.avatar_url ?? null,
        systemPrompt: primaryAgent?.default_system_prompt ?? "",
        modelId: primaryAgent?.default_model_id ?? "gpt-5-mini",
        temperature: primaryAgent?.default_temperature ?? 70,
        knowledgeCategories: primaryAgent?.knowledge_categories ?? [],
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
  // Agent configuration fields (stored in agentsList[0])
  avatarUrl?: string | null;
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  knowledgeCategories?: string[];
  // Other fields
  behavior?: Record<string, unknown>;
  escalationEnabled?: boolean;
  escalationTriggers?: unknown[];
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
    if (body.behavior !== undefined) updateData.behavior = body.behavior;
    if (body.escalationEnabled !== undefined) updateData.escalationEnabled = body.escalationEnabled;
    if (body.escalationTriggers !== undefined) updateData.escalationTriggers = body.escalationTriggers;

    // Variable values are now stored directly in the agent as JSONB
    if (body.variableValues !== undefined) {
      // Merge with existing values (preserve values not being updated)
      const existingValues = (existingAgent.variableValues as Record<string, string>) || {};
      updateData.variableValues = { ...existingValues, ...body.variableValues };
    }

    // Handle agent configuration fields (stored in agentsList)
    const hasAgentConfigChanges =
      body.avatarUrl !== undefined ||
      body.systemPrompt !== undefined ||
      body.modelId !== undefined ||
      body.temperature !== undefined ||
      body.knowledgeCategories !== undefined;

    if (hasAgentConfigChanges) {
      const currentAgentsList = (existingAgent.agentsList as AgentListItem[]) || [];
      const primaryAgent = currentAgentsList[0] || {
        agent_identifier: "main",
        name: existingAgent.name,
        agent_type: "worker" as const,
        default_system_prompt: "",
        default_model_id: "gpt-5-mini",
        default_temperature: 70,
        knowledge_categories: [],
        tools: [],
        sort_order: 0,
      };

      // Update primary agent with new values
      const updatedPrimaryAgent: AgentListItem = {
        ...primaryAgent,
        avatar_url: body.avatarUrl !== undefined ? (body.avatarUrl ?? undefined) : primaryAgent.avatar_url,
        default_system_prompt: body.systemPrompt !== undefined ? body.systemPrompt : primaryAgent.default_system_prompt,
        default_model_id: body.modelId !== undefined ? body.modelId : primaryAgent.default_model_id,
        default_temperature: body.temperature !== undefined ? body.temperature : primaryAgent.default_temperature,
        knowledge_categories: body.knowledgeCategories !== undefined ? body.knowledgeCategories : primaryAgent.knowledge_categories,
      };

      // Replace primary agent in list, keep others
      updateData.agentsList = [updatedPrimaryAgent, ...currentAgentsList.slice(1)];
    }

    // Get current system prompt for version comparison
    const currentAgentsList = (existingAgent.agentsList as AgentListItem[]) || [];
    const currentSystemPrompt = currentAgentsList[0]?.default_system_prompt ?? "";

    // If systemPrompt changed, create a version
    if (body.systemPrompt && body.systemPrompt !== currentSystemPrompt) {
      // Get latest version number
      const [latestVersion] = await db
        .select({ version: agentVersions.version })
        .from(agentVersions)
        .where(eq(agentVersions.chatbotId, agentId))
        .orderBy(agentVersions.version)
        .limit(1);

      const nextVersion = (latestVersion?.version ?? 0) + 1;

      // Create version snapshot
      await db.insert(agentVersions).values({
        chatbotId: agentId,
        version: nextVersion,
        changelog: "System prompt updated",
        systemPrompt: body.systemPrompt,
        modelId: body.modelId || currentAgentsList[0]?.default_model_id || "gpt-5-mini",
        temperature: body.temperature ?? currentAgentsList[0]?.default_temperature ?? 70,
        behavior: body.behavior || existingAgent.behavior,
      });
    }

    // Update the agent
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
