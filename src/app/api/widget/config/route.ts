/**
 * Widget Configuration API
 *
 * GET /api/widget/config?agentId=xxx&companyId=xxx - Get widget configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { widgetConfigs } from "@/lib/db/schema/widgets";
import { eq, and } from "drizzle-orm";

const DEFAULT_CONFIG = {
  theme: "light" as const,
  position: "bottom-right" as const,
  primaryColor: "#007bff",
  borderRadius: 16,
  title: "Chat with us",
  subtitle: "We typically reply within minutes",
  placeholderText: "Type a message...",
  showBranding: true,
  autoOpen: false,
  autoOpenDelay: 5000,
  closeOnEscape: true,
  soundEnabled: false,
  enableVoice: false,
  enableFileUpload: true,
  enableEmoji: true,
  enableMarkdown: true,
  enableTypingIndicator: true,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const companyId = searchParams.get("companyId");

    if (!agentId || !companyId) {
      return NextResponse.json(
        { error: "Missing required parameters: agentId and companyId" },
        { status: 400 }
      );
    }

    // Validate origin
    const origin = request.headers.get("origin");
    const isValidOrigin = await validateWidgetOrigin(companyId, agentId, origin);
    if (!isValidOrigin) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }

    // Get company and verify active
    const companyResult = await db
      .select({ name: companies.name, status: companies.status })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (companyResult.length === 0 || companyResult[0]?.status !== "active") {
      return NextResponse.json(
        { error: "Company not found or inactive" },
        { status: 404 }
      );
    }

    // Get agent with behavior config
    const agentResult = await db
      .select({
        name: agents.name,
        agentsList: agents.agentsList,
        behavior: agents.behavior,
        status: agents.status,
      })
      .from(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.companyId, companyId)
        )
      )
      .limit(1);

    if (agentResult.length === 0 || agentResult[0]?.status !== "active") {
      return NextResponse.json(
        { error: "Agent not found or inactive" },
        { status: 404 }
      );
    }

    const agent = agentResult[0];
    const agentsListData = (agent.agentsList as { avatar_url?: string }[] | null) || [];
    const avatarUrl = agentsListData[0]?.avatar_url || null;
    const behavior = (agent.behavior as { greeting?: string; widgetConfig?: Record<string, unknown> }) ?? {};
    const storedConfig = behavior.widgetConfig ?? {};

    // Fetch widget config for this chatbot
    const widgetConfigResult = await db
      .select({
        enableVoiceMessages: widgetConfigs.enableVoiceMessages,
      })
      .from(widgetConfigs)
      .where(eq(widgetConfigs.chatbotId, agentId))
      .limit(1);

    const widgetConfig = widgetConfigResult[0];

    // Merge default config with stored config
    const config = {
      ...DEFAULT_CONFIG,
      ...storedConfig,
      // Always use agent-specific values
      title: agent.name,
      avatarUrl,
      welcomeMessage: behavior.greeting ?? DEFAULT_CONFIG.title,
      // Include voice feature flag from widget config
      enableVoice: widgetConfig?.enableVoiceMessages ?? false,
    };

    // Set CORS headers
    const res = NextResponse.json({ config });
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return res;
  } catch (error) {
    console.error("Widget config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch widget configuration" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  const response = new NextResponse(null, { status: 204 });
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function validateWidgetOrigin(
  companyId: string,
  agentId: string,
  origin: string | null
): Promise<boolean> {
  // In development, allow all origins
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // If no origin, allow (server-side request)
  if (!origin) {
    return true;
  }

  // Get agent behavior config
  const agentResult = await db
    .select({ behavior: agents.behavior })
    .from(agents)
    .where(
      and(
        eq(agents.id, agentId),
        eq(agents.companyId, companyId)
      )
    )
    .limit(1);

  if (agentResult.length === 0) {
    return false;
  }

  const agent = agentResult[0];
  const behavior = agent?.behavior as { widgetConfig?: { allowedDomains?: string[] } } | null;
  const allowedDomains = behavior?.widgetConfig?.allowedDomains ?? [];

  // Empty array means all domains allowed
  if (allowedDomains.length === 0) {
    return true;
  }

  try {
    const originHostname = new URL(origin).hostname;
    return allowedDomains.some((domain) => {
      if (domain.startsWith("*.")) {
        const baseDomain = domain.slice(2);
        return (
          originHostname === baseDomain ||
          originHostname.endsWith("." + baseDomain)
        );
      }
      return originHostname === domain;
    });
  } catch {
    return false;
  }
}
