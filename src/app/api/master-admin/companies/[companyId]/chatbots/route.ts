import { eq, and, count, isNull, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, companies, conversations, messages, type PackageVariableDefinition, type AgentListItem as AgentListItemSchema } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export interface CompanyChatbotItem {
  id: string;
  name: string;
  description: string | null;
  packageId: string | null;
  packageName: string;
  status: string;
  conversationCount: number;
  messageCount: number;
  agentsList: AgentListItemSchema[];
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/master-admin/companies/[companyId]/chatbots
 * List all chatbots for a company
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Get chatbots with package info
    const chatbotsData = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        packageId: agents.packageId,
        packageName: agentPackages.name,
        status: agents.status,
        agentsList: agents.agentsList,
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

    // Get conversation and message counts for each chatbot
    const chatbotsWithStats: CompanyChatbotItem[] = await Promise.all(
      chatbotsData.map(async (chatbot) => {
        // Get conversation count
        const [convCount] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.chatbotId, chatbot.id));

        // Get message count through conversations
        const chatbotConversations = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.chatbotId, chatbot.id));

        let msgCount = 0;
        if (chatbotConversations.length > 0) {
          const conversationIds = chatbotConversations.map((c) => c.id);
          const [messagesCount] = await db
            .select({ count: count() })
            .from(messages)
            .where(inArray(messages.conversationId, conversationIds));
          msgCount = messagesCount?.count ?? 0;
        }

        return {
          id: chatbot.id,
          name: chatbot.name,
          description: chatbot.description,
          packageId: chatbot.packageId,
          packageName: chatbot.packageName ?? "Unknown",
          status: chatbot.status,
          conversationCount: convCount?.count ?? 0,
          messageCount: msgCount,
          agentsList: (chatbot.agentsList as AgentListItemSchema[]) ?? [],
          createdAt: chatbot.createdAt.toISOString(),
          updatedAt: chatbot.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ chatbots: chatbotsWithStats });
  } catch (error) {
    console.error("Error fetching company chatbots:", error);
    return NextResponse.json(
      { error: "Failed to fetch company chatbots" },
      { status: 500 }
    );
  }
}

interface CreateChatbotRequest {
  name: string;
  description?: string;
  type?: "support" | "sales" | "general" | "custom";
  packageId?: string;
  // Agent configuration (will be stored in agents_list)
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  knowledgeCategories?: string[];
  behavior?: Record<string, unknown>;
  // Variable values are now stored as a simple key-value object
  variableValues?: Record<string, string>;
}

/**
 * POST /api/master-admin/companies/[companyId]/chatbots
 * Create a new chatbot for a company
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    const body: CreateChatbotRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Chatbot name is required" },
        { status: 400 }
      );
    }

    // Verify company exists
    const [company] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    let agentsList: AgentListItemSchema[] = [];
    let behavior = body.behavior;
    let type = body.type || "custom";
    let variableValues: Record<string, string> = {};
    let packageType: "single_agent" | "multi_agent" = "single_agent";
    let chatbotType: "chat" | "call" = "chat";
    let isCustomPackage = false;

    // If packageId is provided, copy agents_list and defaults from the package
    if (body.packageId) {
      const [agentPackage] = await db
        .select()
        .from(agentPackages)
        .where(eq(agentPackages.id, body.packageId))
        .limit(1);

      if (agentPackage) {
        // Copy agents_list from package
        agentsList = (agentPackage.agentsList as AgentListItemSchema[]) || [];
        packageType = agentPackage.packageType;
        chatbotType = agentPackage.chatbotType;
        isCustomPackage = agentPackage.isCustomPackage;

        behavior = body.behavior || (agentPackage.defaultBehavior as Record<string, unknown>);

        // Infer type from package category if not specified
        if (!body.type && agentPackage.category) {
          const categoryToType: Record<string, typeof type> = {
            support: "support",
            sales: "sales",
            general: "general",
          };
          type = categoryToType[agentPackage.category.toLowerCase()] || "custom";
        }

        // Initialize variable values from package defaults
        const pkgVariables = (agentPackage.variables as PackageVariableDefinition[]) || [];
        pkgVariables.forEach((pv) => {
          if (pv.defaultValue && pv.variableType !== "secured_variable") {
            variableValues[pv.name] = pv.defaultValue;
          }
        });
      }

      // Override with provided values
      if (body.variableValues) {
        variableValues = { ...variableValues, ...body.variableValues };
      }
    } else {
      // No package - create a single agent from request params
      const systemPrompt = body.systemPrompt ||
        `You are a helpful AI assistant named ${body.name} for ${company.name}.
Your role is to assist customers with their questions and concerns.
Be professional, friendly, and concise in your responses.
If you cannot help with something, offer to connect the customer with a human agent.`;

      // Convert backward-compatible temperature (0-100) to new format (0-1)
      const temperatureValue = body.temperature !== undefined ? body.temperature / 100 : 0.7;

      agentsList = [{
        agent_identifier: "main",
        name: body.name,
        agent_type: "worker",
        default_system_prompt: systemPrompt,
        default_model_id: body.modelId || "gpt-5-mini-2025-08-07",
        model_settings: { temperature: temperatureValue, max_tokens: 4096, top_p: 1 },
        knowledge_categories: body.knowledgeCategories || [],
        tools: [],
        sort_order: 0,
      }];
    }

    // Create the chatbot with agents_list and variable values stored as JSONB
    const [newChatbot] = await db
      .insert(agents)
      .values({
        companyId,
        packageId: body.packageId || null,
        packageType,
        chatbotType,
        isCustomPackage,
        name: body.name,
        description: body.description || null,
        type,
        status: "draft",
        agentsList,
        behavior: behavior || {
          greeting: "Hello! How can I help you today?",
          fallbackMessage: "I'm sorry, I don't understand. Let me connect you with a human agent.",
          maxTurnsBeforeEscalation: 10,
          autoEscalateOnSentiment: true,
          sentimentThreshold: -0.5,
          collectEmail: true,
          collectName: true,
          workingHours: null,
          offlineMessage: "We're currently offline. Please leave a message and we'll get back to you.",
        },
        variableValues,
      })
      .returning();

    return NextResponse.json({ chatbot: newChatbot }, { status: 201 });
  } catch (error) {
    console.error("Error creating chatbot:", error);
    return NextResponse.json(
      { error: "Failed to create chatbot" },
      { status: 500 }
    );
  }
}
