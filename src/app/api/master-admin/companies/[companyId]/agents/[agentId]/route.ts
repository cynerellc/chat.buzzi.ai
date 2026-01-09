import { eq, and, count, isNull, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { agents, agentPackages, conversations, messages } from "@/lib/db/schema";
import type { AgentListItem } from "@/lib/db/schema/chatbots";

interface RouteContext {
  params: Promise<{ companyId: string; agentId: string }>;
}

export interface AgentDetails {
  id: string;
  name: string;
  description: string | null;
  packageId: string | null;
  packageName: string;
  systemPrompt: string;
  modelId: string;
  modelSettings: Record<string, unknown>;
  behavior: Record<string, unknown>;
  status: string;
  escalationEnabled: boolean;
  conversationCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  agentsList: AgentListItem[];
}

const agentListItemSchema = z.object({
  agent_identifier: z.string(),
  name: z.string(),
  designation: z.string().optional(),
  avatar_url: z.string().optional(),
  agent_type: z.enum(["worker", "supervisor"]),
  default_system_prompt: z.string(),
  default_model_id: z.string(),
  model_settings: z.record(z.string(), z.unknown()).optional(),
  knowledge_base_enabled: z.boolean().optional(),
  knowledge_categories: z.array(z.string()).optional(),
  tools: z.array(z.unknown()).optional(),
  managed_agent_ids: z.array(z.string()).optional(),
  sort_order: z.number().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  packageId: z.string().uuid().optional(),
  systemPrompt: z.string().optional(),
  modelId: z.string().optional(),
  // modelSettings is the new preferred way to set model configuration
  modelSettings: z.record(z.string(), z.unknown()).optional(),
  // temperature is deprecated but accepted for backward compatibility (0-100 scale, converted to 0-1)
  temperature: z.number().int().min(0).max(100).optional(),
  behavior: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  agentsList: z.array(agentListItemSchema).optional(),
  escalationEnabled: z.boolean().optional(),
});

/**
 * GET /api/master-admin/companies/[companyId]/agents/[agentId]
 * Get agent details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, agentId } = await context.params;

    // Get agent with package info
    const [agentRow] = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        packageId: agents.packageId,
        packageName: agentPackages.name,
        agentsList: agents.agentsList,
        behavior: agents.behavior,
        status: agents.status,
        escalationEnabled: agents.escalationEnabled,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
        companyId: agents.companyId,
      })
      .from(agents)
      .leftJoin(agentPackages, eq(agents.packageId, agentPackages.id))
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, companyId),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!agentRow) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Extract config from agentsList[0]
    const agentsListData = (agentRow.agentsList as { default_system_prompt: string; default_model_id: string; model_settings?: Record<string, unknown> }[] | null) || [];
    const primaryAgent = agentsListData[0];
    const modelSettings = primaryAgent?.model_settings ?? { temperature: 0.7 };
    const temperatureValue = typeof modelSettings.temperature === "number" ? modelSettings.temperature : 0.7;
    const agent = {
      ...agentRow,
      systemPrompt: primaryAgent?.default_system_prompt || "",
      modelId: primaryAgent?.default_model_id || "gpt-5-mini-2025-08-07",
      temperature: Math.round(temperatureValue * 100), // Backward compatible (0-100)
    };

    // H2: Parallelize conversation and message counts
    const [[convCount], [msgCount]] = await Promise.all([
      // Get conversation count
      db
        .select({ count: count() })
        .from(conversations)
        .where(eq(conversations.chatbotId, agentId)),

      // Get message count using subquery (single query instead of two-step)
      db
        .select({ count: count() })
        .from(messages)
        .where(
          inArray(
            messages.conversationId,
            db.select({ id: conversations.id }).from(conversations).where(eq(conversations.chatbotId, agentId))
          )
        ),
    ]);

    const response: AgentDetails = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      packageId: agent.packageId,
      packageName: agent.packageName ?? "Unknown",
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      modelSettings: modelSettings,
      behavior: (agent.behavior as Record<string, unknown>) ?? {},
      status: agent.status,
      escalationEnabled: agent.escalationEnabled,
      conversationCount: convCount?.count ?? 0,
      messageCount: msgCount?.count ?? 0,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      agentsList: (agentRow.agentsList as AgentListItem[]) ?? [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-admin/companies/[companyId]/agents/[agentId]
 * Update agent configuration
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireMasterAdmin();
    const { companyId, agentId } = await context.params;
    const body = await request.json();
    const data = updateAgentSchema.parse(body);

    // Check if agent exists
    const [existingAgent] = await db
      .select({
        id: agents.id,
        name: agents.name,
        companyId: agents.companyId,
      })
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, companyId),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // If packageId is being changed, verify it exists
    if (data.packageId) {
      const [pkg] = await db
        .select({ id: agentPackages.id })
        .from(agentPackages)
        .where(eq(agentPackages.id, data.packageId))
        .limit(1);

      if (!pkg) {
        return NextResponse.json(
          { error: "Package not found" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.packageId !== undefined) updateData.packageId = data.packageId;
    if (data.behavior !== undefined) updateData.behavior = data.behavior;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.agentsList !== undefined) updateData.agentsList = data.agentsList;
    if (data.escalationEnabled !== undefined) updateData.escalationEnabled = data.escalationEnabled;

    // Handle systemPrompt, modelId, and modelSettings by updating agentsList[0]
    // This is needed because these fields are stored in the JSONB agentsList
    if (data.systemPrompt !== undefined || data.modelId !== undefined || data.modelSettings !== undefined || data.temperature !== undefined) {
      // First get the current agent to merge settings
      const [currentAgent] = await db
        .select({ agentsList: agents.agentsList })
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      const currentAgentsList = (currentAgent?.agentsList as AgentListItem[] | null) || [];
      const primaryAgent = currentAgentsList[0];

      if (primaryAgent) {
        // Get current model settings
        const currentSettings = primaryAgent.model_settings ?? { temperature: 0.7, max_tokens: 4096, top_p: 1 };

        // Determine new model settings (modelSettings takes precedence over temperature)
        let newModelSettings = currentSettings;
        if (data.modelSettings !== undefined) {
          newModelSettings = data.modelSettings;
        } else if (data.temperature !== undefined) {
          // Convert 0-100 to 0-1 for backward compatibility
          newModelSettings = { ...currentSettings, temperature: data.temperature / 100 };
        }

        const updatedPrimaryAgent: AgentListItem = {
          ...primaryAgent,
          default_system_prompt: data.systemPrompt ?? primaryAgent.default_system_prompt,
          default_model_id: data.modelId ?? primaryAgent.default_model_id,
          model_settings: newModelSettings,
        };

        updateData.agentsList = [updatedPrimaryAgent, ...currentAgentsList.slice(1)];
      }
    }

    // Update agent
    const [updatedAgent] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, agentId))
      .returning();

    // Log the update
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      companyId: companyId,
      action: "agent.update",
      resource: "agent",
      resourceId: agentId,
      details: {
        agentName: existingAgent.name,
        changes: Object.keys(data),
      },
    });

    return NextResponse.json({
      success: true,
      agent: updatedAgent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-admin/companies/[companyId]/agents/[agentId]
 * Soft delete an agent
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireMasterAdmin();
    const { companyId, agentId } = await context.params;

    // Check if agent exists
    const [existingAgent] = await db
      .select({
        id: agents.id,
        name: agents.name,
        companyId: agents.companyId,
      })
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, companyId),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Soft delete the agent
    await db
      .update(agents)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        status: "archived",
      })
      .where(eq(agents.id, agentId));

    // Log the deletion
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      companyId: companyId,
      action: "agent.delete",
      resource: "agent",
      resourceId: agentId,
      details: {
        agentName: existingAgent.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
