import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { agents, agentPackages, conversations } from "@/lib/db/schema";

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
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

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
        avatarUrl: agents.avatarUrl,
        type: agents.type,
        status: agents.status,
        totalConversations: agents.totalConversations,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .where(and(...conditions))
      .orderBy(desc(agents.createdAt));

    // Get weekly stats for each agent
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const agentList: AgentListItem[] = await Promise.all(
      companyAgents.map(async (agent) => {
        // Weekly conversations
        const [weeklyResult] = await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.agentId, agent.id),
              gte(conversations.createdAt, weekAgo)
            )
          );

        // AI resolved this week
        const [aiResolvedResult] = await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.agentId, agent.id),
              eq(conversations.resolutionType, "ai"),
              gte(conversations.resolvedAt, weekAgo)
            )
          );

        // Total resolved this week
        const [totalResolvedResult] = await db
          .select({ count: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.agentId, agent.id),
              sql`${conversations.resolutionType} IS NOT NULL`,
              gte(conversations.resolvedAt, weekAgo)
            )
          );

        const totalResolved = totalResolvedResult?.count ?? 0;
        const aiResolved = aiResolvedResult?.count ?? 0;
        const aiResolutionRate =
          totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 100) : 0;

        return {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          avatarUrl: agent.avatarUrl,
          type: agent.type,
          status: agent.status,
          totalConversations: agent.totalConversations,
          weeklyConversations: weeklyResult?.count ?? 0,
          aiResolutionRate,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        };
      })
    );

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
  systemPrompt?: string;
  modelId?: string;
  temperature?: number;
  behavior?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: CreateAgentRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 }
      );
    }

    let systemPrompt = body.systemPrompt;
    let modelId = body.modelId || "gpt-4o-mini";
    let temperature = body.temperature ?? 70;
    let behavior = body.behavior;
    let type = body.type || "custom";

    // If packageId is provided, get defaults from the package
    if (body.packageId) {
      const [agentPackage] = await db
        .select()
        .from(agentPackages)
        .where(eq(agentPackages.id, body.packageId))
        .limit(1);

      if (agentPackage) {
        systemPrompt = systemPrompt || agentPackage.defaultSystemPrompt;
        modelId = body.modelId || agentPackage.defaultModelId;
        temperature = body.temperature ?? agentPackage.defaultTemperature;
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
      }
    }

    // Ensure we have a system prompt
    if (!systemPrompt) {
      systemPrompt = `You are a helpful AI assistant named ${body.name} for ${company.name}.
Your role is to assist customers with their questions and concerns.
Be professional, friendly, and concise in your responses.
If you cannot help with something, offer to connect the customer with a human agent.`;
    }

    // Create the agent
    const [newAgent] = await db
      .insert(agents)
      .values({
        companyId: company.id,
        packageId: body.packageId || null,
        name: body.name,
        description: body.description || null,
        type,
        status: "draft",
        systemPrompt,
        modelId,
        temperature,
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
