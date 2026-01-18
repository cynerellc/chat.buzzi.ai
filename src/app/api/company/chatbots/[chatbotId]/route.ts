import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, type PackageVariableDefinition, type AgentListItem } from "@/lib/db/schema";
import { generateWidgetConfigJson } from "@/lib/widget/config-generator";

interface RouteParams {
  params: Promise<{ chatbotId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await params;

    const [chatbot] = await db
      .select({
        id: agents.id,
        companyId: agents.companyId,
        packageId: agents.packageId,
        packageType: agents.packageType,
        isCustomPackage: agents.isCustomPackage,
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
        // Feature flags
        enabledChat: agents.enabledChat,
        enabledCall: agents.enabledCall,
        // Call feature fields
        callModelId: agents.callModelId,
        callAiProvider: agents.callAiProvider,
        voiceConfig: agents.voiceConfig,
        // Chatbot settings (includes call config)
        settings: agents.settings,
        // Unified widget config
        widgetConfig: agents.widgetConfig,
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
          eq(agents.id, chatbotId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Get primary agent from agents_list for backward compatibility
    const agentsList = (chatbot.agentsList as AgentListItem[]) || [];
    const primaryAgent = agentsList[0];

    // Combine package variable definitions with chatbot's variable values
    const packageVariables = (chatbot.package?.variables as PackageVariableDefinition[]) || [];
    const chatbotVariableValues = (chatbot.variableValues as Record<string, string>) || {};

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
      value: pv.variableType === "secured_variable" && chatbotVariableValues[pv.name]
        ? "••••••••"
        : chatbotVariableValues[pv.name] || null,
    }));

    // Get temperature from model_settings for backward compatibility
    const modelSettings = primaryAgent?.model_settings ?? {};
    const temperatureValue = typeof modelSettings.temperature === "number"
      ? Math.round(modelSettings.temperature * 100)
      : 70;

    return NextResponse.json({
      chatbot: {
        ...chatbot,
        // Provide backward-compatible fields from primary agent
        avatarUrl: primaryAgent?.avatar_url ?? null,
        systemPrompt: primaryAgent?.default_system_prompt ?? "",
        modelId: primaryAgent?.default_model_id ?? "gpt-5-mini-2025-08-07",
        temperature: temperatureValue, // Backward compatible (0-100)
        modelSettings: modelSettings, // New format
        knowledgeCategories: primaryAgent?.knowledge_categories ?? [],
        variableValues: variableValuesWithDefinitions,
        // Also include the raw variable values for editing
        rawVariableValues: chatbotVariableValues,
        // Include settings for call configuration
        settings: chatbot.settings ?? {},
      },
    });
  } catch (error) {
    console.error("Error fetching chatbot:", error);
    return NextResponse.json(
      { error: "Failed to fetch chatbot" },
      { status: 500 }
    );
  }
}

interface UpdateChatbotRequest {
  name?: string;
  description?: string;
  type?: "support" | "sales" | "general" | "custom";
  status?: "active" | "paused" | "draft";
  // Agent configuration fields (stored in agentsList[0])
  avatarUrl?: string | null;
  systemPrompt?: string;
  modelId?: string;
  temperature?: number; // Backward compatible (0-100)
  modelSettings?: Record<string, unknown>; // New format
  knowledgeCategories?: string[];
  // Other fields
  behavior?: Record<string, unknown>;
  escalationEnabled?: boolean;
  escalationTriggers?: unknown[];
  // Variable values are now stored as a simple key-value object
  variableValues?: Record<string, string>;
  // Feature flags
  enabledChat?: boolean;
  enabledCall?: boolean;
  // Call feature settings
  callAiProvider?: "OPENAI" | "GEMINI" | null;
  voiceConfig?: Record<string, unknown>;
  // Unified widget config
  widgetConfig?: { chat?: Record<string, unknown>; call?: Record<string, unknown> };
  // Chatbot settings (includes call knowledge base config)
  settings?: {
    callKnowledgeBaseEnabled?: boolean;
    callKnowledgeCategories?: string[];
    callKnowledgeBaseThreshold?: number;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await params;

    // Verify chatbot belongs to company
    const [existingChatbot] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, chatbotId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!existingChatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body: UpdateChatbotRequest = await request.json();

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
    // Feature flags
    if (body.enabledChat !== undefined) updateData.enabledChat = body.enabledChat;
    if (body.enabledCall !== undefined) updateData.enabledCall = body.enabledCall;
    // Call feature settings
    if (body.callAiProvider !== undefined) updateData.callAiProvider = body.callAiProvider;
    if (body.voiceConfig !== undefined) updateData.voiceConfig = body.voiceConfig;
    // Unified widget config - merge with existing
    if (body.widgetConfig !== undefined) {
      const existingWidgetConfig = existingChatbot.widgetConfig as { chat?: Record<string, unknown>; call?: Record<string, unknown> } || { chat: {}, call: {} };
      updateData.widgetConfig = {
        chat: { ...existingWidgetConfig.chat, ...body.widgetConfig.chat },
        call: { ...existingWidgetConfig.call, ...body.widgetConfig.call },
      };
    }

    // Chatbot settings - merge with existing settings
    if (body.settings !== undefined) {
      const existingSettings = (existingChatbot.settings as Record<string, unknown>) || {};
      updateData.settings = {
        ...existingSettings,
        ...body.settings,
      };
    }

    // Variable values are now stored directly in the chatbot as JSONB
    if (body.variableValues !== undefined) {
      // Merge with existing values (preserve values not being updated)
      const existingValues = (existingChatbot.variableValues as Record<string, string>) || {};
      updateData.variableValues = { ...existingValues, ...body.variableValues };
    }

    // Handle agent configuration fields (stored in agentsList)
    const hasAgentConfigChanges =
      body.avatarUrl !== undefined ||
      body.systemPrompt !== undefined ||
      body.modelId !== undefined ||
      body.temperature !== undefined ||
      body.modelSettings !== undefined ||
      body.knowledgeCategories !== undefined;

    if (hasAgentConfigChanges) {
      const currentAgentsList = (existingChatbot.agentsList as AgentListItem[]) || [];
      const primaryAgent = currentAgentsList[0] || {
        agent_identifier: "main",
        name: existingChatbot.name,
        agent_type: "worker" as const,
        default_system_prompt: "",
        default_model_id: "gpt-5-mini-2025-08-07",
        model_settings: { temperature: 0.7, max_tokens: 4096, top_p: 1 },
        knowledge_categories: [],
        tools: [],
        sort_order: 0,
      };

      // Handle model_settings - support both new format and backward-compatible temperature
      let newModelSettings = primaryAgent.model_settings ?? { temperature: 0.7, max_tokens: 4096, top_p: 1 };
      if (body.modelSettings !== undefined) {
        newModelSettings = body.modelSettings;
      } else if (body.temperature !== undefined) {
        // Convert backward-compatible temperature (0-100) to new format (0-1)
        newModelSettings = { ...newModelSettings, temperature: body.temperature / 100 };
      }

      // Update primary agent with new values
      const updatedPrimaryAgent: AgentListItem = {
        ...primaryAgent,
        avatar_url: body.avatarUrl !== undefined ? (body.avatarUrl ?? undefined) : primaryAgent.avatar_url,
        default_system_prompt: body.systemPrompt !== undefined ? body.systemPrompt : primaryAgent.default_system_prompt,
        default_model_id: body.modelId !== undefined ? body.modelId : primaryAgent.default_model_id,
        model_settings: newModelSettings,
        knowledge_categories: body.knowledgeCategories !== undefined ? body.knowledgeCategories : primaryAgent.knowledge_categories,
      };

      // Replace primary agent in list, keep others
      updateData.agentsList = [updatedPrimaryAgent, ...currentAgentsList.slice(1)];
    }

    // Update the chatbot
    const [updatedChatbot] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, chatbotId))
      .returning();

    // Regenerate widget config JSON if name or agentsList changed
    const shouldRegenerateWidgetConfig =
      body.name !== undefined || hasAgentConfigChanges;

    if (shouldRegenerateWidgetConfig) {
      const regenerateResult = await generateWidgetConfigJson(chatbotId);
      if (!regenerateResult.success) {
        console.error("Failed to regenerate widget config JSON:", regenerateResult.error);
        // Continue anyway - the database update succeeded
      }
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await params;

    // Verify chatbot belongs to company
    const [existingChatbot] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, chatbotId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!existingChatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Soft delete - just set deletedAt
    await db
      .update(agents)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, chatbotId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chatbot:", error);
    return NextResponse.json(
      { error: "Failed to delete chatbot" },
      { status: 500 }
    );
  }
}
