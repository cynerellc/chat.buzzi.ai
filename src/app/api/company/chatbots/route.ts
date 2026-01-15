import { NextRequest, NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, conversations, type PackageVariableDefinition, type AgentListItem as AgentListItemSchema } from "@/lib/db/schema";

export interface ChatbotListItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  type: string;
  status: string;
  totalConversations: number;
  weeklyConversations: number;
  aiResolutionRate: number;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();
    console.log("[API /company/chatbots] Fetching chatbots for company:", company.id, company.name);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where conditions (consistent with dashboard and master-admin queries)
    const conditions = [
      eq(agents.companyId, company.id),
      isNull(agents.deletedAt), // Exclude soft-deleted chatbots
    ];

    if (status && status !== "all") {
      conditions.push(eq(agents.status, status as "active" | "paused" | "draft"));
    }

    // Get all chatbots for the company
    const companyChatbots = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        agentsList: agents.agentsList,
        type: agents.type,
        status: agents.status,
        totalConversations: agents.totalConversations,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .where(and(...conditions))
      .orderBy(desc(agents.createdAt));

    console.log("[API /company/chatbots] Found", companyChatbots.length, "chatbots");

    // H5: Batch query for weekly stats using GROUP BY instead of N+1 queries
    // This reduces 3N queries to 1 query regardless of the number of chatbots
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const chatbotIds = companyChatbots.map((c) => c.id);
    const statsMap = new Map<string, { weekly: number; aiResolved: number; totalResolved: number }>();

    if (chatbotIds.length > 0) {
      const batchedStats = await db
        .select({
          chatbotId: conversations.chatbotId,
          // Weekly conversations (created in last 7 days)
          weekly: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${weekAgoISO}::timestamptz)`,
          // AI resolved this week
          aiResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} = 'ai' AND ${conversations.resolvedAt} >= ${weekAgoISO}::timestamptz)`,
          // Total resolved this week
          totalResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} IS NOT NULL AND ${conversations.resolvedAt} >= ${weekAgoISO}::timestamptz)`,
        })
        .from(conversations)
        .where(inArray(conversations.chatbotId, chatbotIds))
        .groupBy(conversations.chatbotId);

      batchedStats.forEach((stat) => {
        statsMap.set(stat.chatbotId, {
          weekly: Number(stat.weekly) || 0,
          aiResolved: Number(stat.aiResolved) || 0,
          totalResolved: Number(stat.totalResolved) || 0,
        });
      });
    }

    // Map results using O(1) lookups
    const chatbotList: ChatbotListItem[] = companyChatbots.map((chatbot) => {
      const stats = statsMap.get(chatbot.id) || { weekly: 0, aiResolved: 0, totalResolved: 0 };
      const aiResolutionRate =
        stats.totalResolved > 0 ? Math.round((stats.aiResolved / stats.totalResolved) * 100) : 0;

      // Get avatar from first agent in agents_list
      const agentsList = (chatbot.agentsList as AgentListItemSchema[]) || [];
      const primaryAgent = agentsList[0];

      return {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        avatarUrl: primaryAgent?.avatar_url ?? null,
        type: chatbot.type,
        status: chatbot.status,
        totalConversations: chatbot.totalConversations,
        weeklyConversations: stats.weekly,
        aiResolutionRate,
        createdAt: chatbot.createdAt.toISOString(),
        updatedAt: chatbot.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ chatbots: chatbotList });
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them
    if (isRedirectError(error)) {
      console.log("[API /company/chatbots] Redirect error, re-throwing");
      throw error;
    }
    console.error("[API /company/chatbots] Error fetching chatbots:", error);
    return NextResponse.json(
      { error: "Failed to fetch chatbots" },
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

export async function POST(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body: CreateChatbotRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Chatbot name is required" },
        { status: 400 }
      );
    }

    let agentsList: AgentListItemSchema[] = [];
    let behavior = body.behavior;
    let type = body.type || "custom";
    let variableValues: Record<string, string> = {};
    let packageType: "single_agent" | "multi_agent" = "single_agent";
    let enabledChat = true;
    let enabledCall = false;
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
        enabledChat = agentPackage.enabledChat;
        enabledCall = agentPackage.enabledCall;
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
        companyId: company.id,
        packageId: body.packageId || null,
        packageType,
        enabledChat,
        enabledCall,
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
    // Re-throw redirect errors so Next.js can handle them
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Error creating chatbot:", error);
    return NextResponse.json(
      { error: "Failed to create chatbot" },
      { status: 500 }
    );
  }
}
