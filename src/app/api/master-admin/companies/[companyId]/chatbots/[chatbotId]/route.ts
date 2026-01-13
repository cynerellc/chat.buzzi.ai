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
  model_settings: z.record(z.string(), z.unknown()).default({ temperature: 0.7, max_tokens: 4096, top_p: 1 }),
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

    // Get the first agent for default system prompt and model settings
    const agentsList = (chatbot.agentsList as AgentListItem[]) || [];
    const firstAgent = agentsList[0];

    // Transform to match ChatbotDetails interface
    const chatbotDetails = {
      id: chatbot.id,
      name: chatbot.name,
      description: chatbot.description,
      packageId: chatbot.packageId,
      packageName: "Unknown", // This should be joined from packages table if needed
      systemPrompt: firstAgent?.default_system_prompt || "",
      modelId: firstAgent?.default_model_id || "gpt-5-mini-2025-08-07",
      modelSettings: firstAgent?.model_settings || { temperature: 0.7, max_tokens: 4096, top_p: 1 },
      behavior: (chatbot.behavior as Record<string, unknown>) || {},
      status: chatbot.status,
      escalationEnabled: chatbot.escalationEnabled,
      conversationCount: 0, // Would need to query conversations table
      messageCount: 0, // Would need to query messages table
      createdAt: chatbot.createdAt.toISOString(),
      updatedAt: chatbot.updatedAt.toISOString(),
      agentsList: agentsList,
    };

    return NextResponse.json({ chatbot: chatbotDetails });
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
