import { eq, and, count, sql, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { agents, agentPackages, conversations, messages } from "@/lib/db/schema";

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
  conversationCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  packageId: z.string().uuid().optional(),
  systemPrompt: z.string().optional(),
  modelId: z.string().optional(),
  temperature: z.number().int().min(0).max(100).optional(),
  behavior: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
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
    const [agent] = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        packageId: agents.packageId,
        packageName: agentPackages.name,
        systemPrompt: agents.systemPrompt,
        modelId: agents.modelId,
        temperature: agents.temperature,
        behavior: agents.behavior,
        status: agents.status,
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

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get conversation count
    const [convCount] = await db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.agentId, agentId));

    // Get message count
    const agentConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.agentId, agentId));

    let msgCount = 0;
    if (agentConversations.length > 0) {
      const conversationIds = agentConversations.map((c) => c.id);
      const [messagesCount] = await db
        .select({ count: count() })
        .from(messages)
        .where(sql`${messages.conversationId} = ANY(${conversationIds})`);
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
      conversationCount: convCount?.count ?? 0,
      messageCount: msgCount,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
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
