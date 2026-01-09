import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, conversations, type PackageVariableDefinition, type AgentListItem as AgentListItemSchema } from "@/lib/db/schema";

export interface AgentListItem {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where conditions
    const conditions = [
      eq(agents.companyId, company.id),
      isNull(agents.deletedAt),
    ];

    if (status && status !== "all") {
      conditions.push(eq(agents.status, status as "active" | "paused" | "draft"));
    }

    // Get all agents for the company
    const companyAgents = await db
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

    // H5: Batch query for weekly stats using GROUP BY instead of N+1 queries
    // This reduces 3N queries to 1 query regardless of the number of agents
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const agentIds = companyAgents.map((a) => a.id);
    const statsMap = new Map<string, { weekly: number; aiResolved: number; totalResolved: number }>();

    if (agentIds.length > 0) {
      const batchedStats = await db
        .select({
          chatbotId: conversations.chatbotId,
          // Weekly conversations (created in last 7 days)
          weekly: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${weekAgo})`,
          // AI resolved this week
          aiResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} = 'ai' AND ${conversations.resolvedAt} >= ${weekAgo})`,
          // Total resolved this week
          totalResolved: sql<number>`COUNT(*) FILTER (WHERE ${conversations.resolutionType} IS NOT NULL AND ${conversations.resolvedAt} >= ${weekAgo})`,
        })
        .from(conversations)
        .where(inArray(conversations.chatbotId, agentIds))
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
    const agentList: AgentListItem[] = companyAgents.map((agent) => {
      const stats = statsMap.get(agent.id) || { weekly: 0, aiResolved: 0, totalResolved: 0 };
      const aiResolutionRate =
        stats.totalResolved > 0 ? Math.round((stats.aiResolved / stats.totalResolved) * 100) : 0;

      // Get avatar from first agent in agents_list
      const agentsList = (agent.agentsList as AgentListItemSchema[]) || [];
      const primaryAgent = agentsList[0];

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        avatarUrl: primaryAgent?.avatar_url ?? null,
        type: agent.type,
        status: agent.status,
        totalConversations: agent.totalConversations,
        weeklyConversations: stats.weekly,
        aiResolutionRate,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ agents: agentList });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

interface CreateAgentRequest {
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

    const body: CreateAgentRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 }
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

    // Create the agent with agents_list and variable values stored as JSONB
    const [newAgent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
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

    return NextResponse.json({ agent: newAgent }, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
