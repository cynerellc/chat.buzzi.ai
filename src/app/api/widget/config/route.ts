/**
 * Widget Configuration API
 *
 * GET /api/widget/config?agentId=xxx&companyId=xxx - Get widget configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, type ChatWidgetConfig } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { eq, and } from "drizzle-orm";

const DEFAULT_CONFIG = {
  theme: "light" as const,
  position: "bottom-right" as const,
  placement: "above-launcher" as const,
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

    // Get agent with behavior config and call settings
    const agentResult = await db
      .select({
        name: agents.name,
        agentsList: agents.agentsList,
        behavior: agents.behavior,
        status: agents.status,
        packageType: agents.packageType,
        // Unified widget config
        widgetConfig: agents.widgetConfig,
        // Call feature fields
        enabledCall: agents.enabledCall,
        callAiProvider: agents.callAiProvider,
        voiceConfig: agents.voiceConfig,
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

    // Get unified widget config from agent (now stored directly on chatbots table)
    const unifiedConfig = agent.widgetConfig as { chat?: ChatWidgetConfig; call?: Record<string, unknown> } | null;
    const chatWidgetConfig = unifiedConfig?.chat;
    const callWidgetConfig = unifiedConfig?.call;
    const hasWidgetConfig = chatWidgetConfig && Object.keys(chatWidgetConfig).length > 0;

    // Merge default config with widget config from database
    const config = {
      ...DEFAULT_CONFIG,
      // Apply widget config customizations if they exist
      ...(hasWidgetConfig && chatWidgetConfig && {
        theme: chatWidgetConfig.theme,
        position: chatWidgetConfig.position,
        placement: chatWidgetConfig.placement,
        primaryColor: chatWidgetConfig.primaryColor,
        accentColor: chatWidgetConfig.accentColor,
        userBubbleColor: chatWidgetConfig.userBubbleColor || undefined,
        overrideAgentColor: chatWidgetConfig.overrideAgentColor,
        agentBubbleColor: chatWidgetConfig.agentBubbleColor || undefined,
        borderRadius: chatWidgetConfig.borderRadius ? parseInt(String(chatWidgetConfig.borderRadius)) : DEFAULT_CONFIG.borderRadius,
        title: chatWidgetConfig.title,
        subtitle: chatWidgetConfig.subtitle || undefined,
        placeholderText: DEFAULT_CONFIG.placeholderText,
        welcomeMessage: chatWidgetConfig.welcomeMessage,
        avatarUrl: chatWidgetConfig.avatarUrl || avatarUrl,
        logoUrl: chatWidgetConfig.logoUrl || undefined,
        showBranding: chatWidgetConfig.showBranding,
        autoOpen: chatWidgetConfig.autoOpen,
        autoOpenDelay: chatWidgetConfig.autoOpenDelay ? parseInt(String(chatWidgetConfig.autoOpenDelay)) * 1000 : DEFAULT_CONFIG.autoOpenDelay,
        soundEnabled: chatWidgetConfig.playSoundOnMessage,
        persistConversation: chatWidgetConfig.persistConversation,
        enableVoice: chatWidgetConfig.enableVoiceMessages,
        enableFileUpload: chatWidgetConfig.enableFileUpload,
        launcherIcon: chatWidgetConfig.launcherIcon,
        launcherText: chatWidgetConfig.launcherText || undefined,
        buttonSize: chatWidgetConfig.buttonSize ? parseInt(String(chatWidgetConfig.buttonSize)) : 60,
        launcherIconBorderRadius: chatWidgetConfig.launcherIconBorderRadius ? parseInt(String(chatWidgetConfig.launcherIconBorderRadius)) : 50,
        launcherIconPulseGlow: chatWidgetConfig.launcherIconPulseGlow ?? false,
        hideLauncherOnMobile: chatWidgetConfig.hideLauncherOnMobile ?? false,
        customCss: chatWidgetConfig.customCss || undefined,
        // Stream Display Options
        showAgentSwitchNotification: chatWidgetConfig.showAgentSwitchNotification,
        showThinking: chatWidgetConfig.showThinking,
        showInstantUpdates: chatWidgetConfig.showInstantUpdates,
        // Multi-agent Display Options
        showAgentListOnTop: chatWidgetConfig.showAgentListOnTop,
        agentListMinCards: chatWidgetConfig.agentListMinCards ? parseInt(String(chatWidgetConfig.agentListMinCards)) : 3,
        agentListingType: chatWidgetConfig.agentListingType,
      }),
      // If no widget config exists, use defaults with agent name as title
      ...(!hasWidgetConfig && {
        title: agent.name,
        avatarUrl,
        welcomeMessage: behavior.greeting || DEFAULT_CONFIG.title,
        persistConversation: true,
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
      // Call feature configuration
      call: agent.enabledCall ? {
        enabled: true,
        aiProvider: agent.callAiProvider,
        voiceConfig: agent.voiceConfig as {
          openai_voice?: string;
          gemini_voice?: string;
          vad_threshold?: number;
          vad_sensitivity?: string;
          silence_duration_ms?: number;
          prefix_padding_ms?: number;
          call_greeting?: string;
          system_prompt_call?: string;
        },
        widgetConfig: callWidgetConfig as {
          enabled?: boolean;
          position?: string;
          colors?: Record<string, string>;
          callButton?: {
            style?: string;
            size?: number;
            animation?: boolean;
            label?: string;
          };
          orb?: {
            glowIntensity?: number;
            pulseSpeed?: number;
            states?: Record<string, { color: string; animation: string }>;
          };
          callDialog?: {
            width?: number;
            showVisualizer?: boolean;
            visualizerStyle?: string;
            showTranscript?: boolean;
          };
          controls?: {
            showMuteButton?: boolean;
            showEndCallButton?: boolean;
          };
          branding?: {
            showPoweredBy?: boolean;
            companyLogo?: string;
          };
        },
      } : undefined,
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
