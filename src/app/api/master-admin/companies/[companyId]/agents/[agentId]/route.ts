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
  temperature: number;
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
  default_temperature: z.number().min(0).max(100),
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
    const agentsListData = (agentRow.agentsList as { default_system_prompt: string; default_model_id: string; default_temperature: number }[] | null) || [];
    const primaryAgent = agentsListData[0];
    const agent = {
      ...agentRow,
      systemPrompt: primaryAgent?.default_system_prompt || "",
      modelId: primaryAgent?.default_model_id || "gpt-5-mini",
      temperature: primaryAgent?.default_temperature ?? 70,
    };

    // Get conversation count
    const [convCount] = await db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.chatbotId, agentId));

    // Get message count
    const agentConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.chatbotId, agentId));

    let msgCount = 0;
    if (agentConversations.length > 0) {
      const conversationIds = agentConversations.map((c) => c.id);
      const [messagesCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(inArray(messages.conversationId, conversationIds));
      msgCount = messagesCount?.count ?? 0;
    }

    const response: AgentDetails = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      packageId: agent.packageId,
      packageName: agent.packageName ?? "Unknown",
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      temperature: agent.temperature,
      behavior: (agent.behavior as Record<string, unknown>) ?? {},
      status: agent.status,
      escalationEnabled: agent.escalationEnabled,
      conversationCount: convCount?.count ?? 0,
      messageCount: msgCount,
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
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;
    if (data.modelId !== undefined) updateData.modelId = data.modelId;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.behavior !== undefined) updateData.behavior = data.behavior;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.agentsList !== undefined) updateData.agentsList = data.agentsList;
    if (data.escalationEnabled !== undefined) updateData.escalationEnabled = data.escalationEnabled;

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
