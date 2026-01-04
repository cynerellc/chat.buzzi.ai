import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots } from "@/lib/db/schema";
import type { AgentListItem } from "@/lib/db/schema/chatbots";

interface RouteContext {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

const agentSchema = z.object({
  agent_identifier: z.string(),
  agent_type: z.enum(["worker", "supervisor"]),
  name: z.string(),
  designation: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  routing_prompt: z.string().nullable().optional(),
  default_system_prompt: z.string(),
  default_model_id: z.string(),
  default_temperature: z.number().min(0).max(100),
  knowledge_base_enabled: z.boolean().nullable().optional(),
  knowledge_categories: z.array(z.string()).nullable().optional(),
  tools: z.array(z.unknown()).optional(),
  managed_agent_ids: z.array(z.string()).optional(),
  sort_order: z.number().optional(),
});

const updateChatbotSchema = z.object({
  agentsList: z.array(agentSchema).optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
});

/**
 * GET /api/master-admin/companies/[companyId]/chatbots/[chatbotId]
 * Get a specific chatbot
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    return NextResponse.json({ chatbot });
  } catch (error) {
    console.error("Error fetching chatbot:", error);
    return NextResponse.json(
      { error: "Failed to fetch chatbot" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-admin/companies/[companyId]/chatbots/[chatbotId]
 * Update a chatbot (including agents list)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    // Verify chatbot exists and belongs to company
    const [existingChatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!existingChatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateChatbotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (parsed.data.agentsList !== undefined) {
      updateData.agentsList = parsed.data.agentsList as AgentListItem[];
    }
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description;
    }
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }

    const [updatedChatbot] = await db
      .update(chatbots)
      .set(updateData)
      .where(eq(chatbots.id, chatbotId))
      .returning();

    if (!updatedChatbot) {
      return NextResponse.json(
        { error: "Failed to update chatbot" },
        { status: 500 }
      );
    }

    return NextResponse.json({ chatbot: updatedChatbot });
  } catch (error) {
    console.error("Error updating chatbot:", error);
    return NextResponse.json(
      { error: "Failed to update chatbot" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-admin/companies/[companyId]/chatbots/[chatbotId]
 * Soft delete a chatbot
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    // Verify chatbot exists and belongs to company
    const [existingChatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!existingChatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    await db
      .update(chatbots)
      .set({ deletedAt: new Date() })
      .where(eq(chatbots.id, chatbotId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chatbot:", error);
    return NextResponse.json(
      { error: "Failed to delete chatbot" },
      { status: 500 }
    );
  }
}
