import { eq, and, count, isNull, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages, companies, conversations, messages, type PackageVariableDefinition, type AgentListItem as AgentListItemSchema } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export interface CompanyAgentItem {
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
 * GET /api/master-admin/companies/[companyId]/agents
 * List all agents for a company
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Get agents with package info
    const agentsData = await db
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

    // Get conversation and message counts for each agent
    const agentsWithStats: CompanyAgentItem[] = await Promise.all(
      agentsData.map(async (agent) => {
        // Get conversation count
        const [convCount] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.chatbotId, agent.id));

        // Get message count through conversations
        const agentConversations = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.chatbotId, agent.id));

        let msgCount = 0;
        if (agentConversations.length > 0) {
          const conversationIds = agentConversations.map((c) => c.id);
          const [messagesCount] = await db
            .select({ count: count() })
            .from(messages)
            .where(inArray(messages.conversationId, conversationIds));
          msgCount = messagesCount?.count ?? 0;
        }

        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          packageId: agent.packageId,
          packageName: agent.packageName ?? "Unknown",
          status: agent.status,
          conversationCount: convCount?.count ?? 0,
          messageCount: msgCount,
          agentsList: (agent.agentsList as AgentListItemSchema[]) ?? [],
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ agents: agentsWithStats });
  } catch (error) {
    console.error("Error fetching company agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch company agents" },
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

/**
 * POST /api/master-admin/companies/[companyId]/agents
 * Create a new chatbot for a company
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    const body: CreateAgentRequest = await request.json();

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

      agentsList = [{
        agent_identifier: "main",
        name: body.name,
        agent_type: "worker",
        default_system_prompt: systemPrompt,
        default_model_id: body.modelId || "gpt-5-mini",
        default_temperature: body.temperature ?? 70,
        knowledge_categories: body.knowledgeCategories || [],
        tools: [],
        sort_order: 0,
      }];
    }

    // Create the agent with agents_list and variable values stored as JSONB
    const [newAgent] = await db
      .insert(agents)
      .values({
        companyId,
        packageId: body.packageId || null,
        packageType,
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
    console.error("Error creating chatbot:", error);
    return NextResponse.json(
      { error: "Failed to create chatbot" },
      { status: 500 }
    );
  }
}
