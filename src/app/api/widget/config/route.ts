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
  enableMarkdown: true,
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
        packageType: agents.packageType,
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
    const agentsListData = (agent.agentsList as {
      agent_identifier: string;
      name: string;
      designation?: string;
      avatar_url?: string;
      agent_type?: string;
      color?: string;
    }[] | null) || [];
    const avatarUrl = agentsListData[0]?.avatar_url || null;
    const behavior = (agent.behavior as { greeting?: string }) ?? {};
    const isMultiAgent = agent.packageType === "multi_agent";

    // Fetch widget config for this chatbot
    const widgetConfigResult = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.chatbotId, agentId))
      .limit(1);

    const widgetConfig = widgetConfigResult[0];

    // Merge default config with widget config from database
    const config = {
      ...DEFAULT_CONFIG,
      // Apply widget config customizations if they exist
      ...(widgetConfig && {
        theme: widgetConfig.theme,
        position: widgetConfig.position,
        primaryColor: widgetConfig.primaryColor,
        accentColor: widgetConfig.accentColor,
        userBubbleColor: widgetConfig.userBubbleColor || undefined,
        overrideAgentColor: widgetConfig.overrideAgentColor,
        agentBubbleColor: widgetConfig.agentBubbleColor || undefined,
        borderRadius: parseInt(widgetConfig.borderRadius) || DEFAULT_CONFIG.borderRadius,
        title: widgetConfig.title,
        subtitle: widgetConfig.subtitle || undefined,
        placeholderText: DEFAULT_CONFIG.placeholderText,
        welcomeMessage: widgetConfig.welcomeMessage,
        avatarUrl: widgetConfig.avatarUrl || avatarUrl,
        logoUrl: widgetConfig.logoUrl || undefined,
        showBranding: widgetConfig.showBranding,
        autoOpen: widgetConfig.autoOpen,
        autoOpenDelay: parseInt(widgetConfig.autoOpenDelay) * 1000 || DEFAULT_CONFIG.autoOpenDelay,
        soundEnabled: widgetConfig.playSoundOnMessage,
        enableVoice: widgetConfig.enableVoiceMessages,
        enableFileUpload: widgetConfig.enableFileUpload,
        launcherIcon: widgetConfig.launcherIcon,
        launcherText: widgetConfig.launcherText || undefined,
        customCss: widgetConfig.customCss || undefined,
        // Stream Display Options
        showAgentSwitchNotification: widgetConfig.showAgentSwitchNotification,
        showThinking: widgetConfig.showThinking,
        showToolCalls: widgetConfig.showToolCalls,
        showInstantUpdates: widgetConfig.showInstantUpdates,
        // Multi-agent Display Options
        showAgentListOnTop: widgetConfig.showAgentListOnTop,
        agentListMinCards: parseInt(widgetConfig.agentListMinCards) || 3,
        agentListingType: widgetConfig.agentListingType,
      }),
      // If no widget config exists, use defaults with agent name as title
      ...(!widgetConfig && {
        title: agent.name,
        avatarUrl,
        welcomeMessage: behavior.greeting || DEFAULT_CONFIG.title,
      }),
      // Multi-agent configuration
      isMultiAgent,
      agentsList: isMultiAgent ? agentsListData.map(a => ({
        id: a.agent_identifier,
        name: a.name,
        designation: a.designation,
        avatarUrl: a.avatar_url,
        color: a.color,
        type: a.agent_type,
      })) : undefined,
    };

    // Set CORS and cache headers
    const res = NextResponse.json({ config });
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    // L1: Add cache headers for CDN and browser caching
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

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
