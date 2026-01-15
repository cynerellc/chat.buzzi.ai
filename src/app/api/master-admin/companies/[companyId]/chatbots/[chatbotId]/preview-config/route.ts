/**
 * Chatbot Preview Config API (Master Admin)
 *
 * GET /api/master-admin/companies/[companyId]/chatbots/[chatbotId]/preview-config
 * Returns widget configuration for preview purposes (works with draft chatbots)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";

interface RouteContext {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    // Get company and verify exists
    const companyResult = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (companyResult.length === 0) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get chatbot (no status check - allows draft chatbots for preview)
    const chatbotResult = await db
      .select({
        name: chatbots.name,
        agentsList: chatbots.agentsList,
        behavior: chatbots.behavior,
        packageType: chatbots.packageType,
        widgetConfig: chatbots.widgetConfig,
        enabledChat: chatbots.enabledChat,
        enabledCall: chatbots.enabledCall,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    const chatbot = chatbotResult[0];
    if (!chatbot) {
      return NextResponse.json(
        { error: "Chatbot not found" },
        { status: 404 }
      );
    }

    const agentsListData = (chatbot.agentsList as {
      agent_identifier: string;
      name: string;
      designation?: string;
      avatar_url?: string;
      agent_type?: string;
      color?: string;
    }[] | null) || [];
    const avatarUrl = agentsListData[0]?.avatar_url || null;
    const behavior = (chatbot.behavior as { greeting?: string }) ?? {};
    const isMultiAgent = chatbot.packageType === "multi_agent";

    // Widget config is stored directly in the chatbot record (jsonb field)
    const widgetConfig = chatbot.widgetConfig as unknown as { chat?: Record<string, unknown>; call?: Record<string, unknown> } | null;
    const chatWidgetConfig = widgetConfig?.chat || widgetConfig as unknown as Record<string, unknown> | null;
    const callWidgetConfig = widgetConfig?.call || null;

    // Merge default config with widget config from database
    const config = {
      ...DEFAULT_CONFIG,
      // Apply widget config customizations if they exist
      ...(chatWidgetConfig && {
        theme: chatWidgetConfig.theme,
        position: chatWidgetConfig.position,
        placement: chatWidgetConfig.placement,
        primaryColor: chatWidgetConfig.primaryColor,
        accentColor: chatWidgetConfig.accentColor,
        userBubbleColor: chatWidgetConfig.userBubbleColor || undefined,
        overrideAgentColor: chatWidgetConfig.overrideAgentColor,
        agentBubbleColor: chatWidgetConfig.agentBubbleColor || undefined,
        borderRadius: parseInt(String(chatWidgetConfig.borderRadius)) || DEFAULT_CONFIG.borderRadius,
        title: chatWidgetConfig.title,
        subtitle: chatWidgetConfig.subtitle || undefined,
        placeholderText: DEFAULT_CONFIG.placeholderText,
        welcomeMessage: chatWidgetConfig.welcomeMessage,
        avatarUrl: chatWidgetConfig.avatarUrl || avatarUrl,
        logoUrl: chatWidgetConfig.logoUrl || undefined,
        showBranding: chatWidgetConfig.showBranding,
        autoOpen: chatWidgetConfig.autoOpen,
        autoOpenDelay: parseInt(String(chatWidgetConfig.autoOpenDelay)) * 1000 || DEFAULT_CONFIG.autoOpenDelay,
        soundEnabled: chatWidgetConfig.playSoundOnMessage,
        persistConversation: chatWidgetConfig.persistConversation,
        enableVoice: chatWidgetConfig.enableVoiceMessages,
        enableFileUpload: chatWidgetConfig.enableFileUpload,
        launcherIcon: chatWidgetConfig.launcherIcon,
        launcherText: chatWidgetConfig.launcherText || undefined,
        buttonSize: parseInt(String(chatWidgetConfig.buttonSize)) || 60,
        launcherIconBorderRadius: parseInt(String(chatWidgetConfig.launcherIconBorderRadius)) || 50,
        launcherIconPulseGlow: chatWidgetConfig.launcherIconPulseGlow ?? false,
        hideLauncherOnMobile: chatWidgetConfig.hideLauncherOnMobile ?? false,
        customCss: chatWidgetConfig.customCss || undefined,
        // Stream Display Options
        showAgentSwitchNotification: chatWidgetConfig.showAgentSwitchNotification,
        showThinking: chatWidgetConfig.showThinking,
        showInstantUpdates: chatWidgetConfig.showInstantUpdates,
        // Multi-agent Display Options
        showAgentListOnTop: chatWidgetConfig.showAgentListOnTop,
        agentListMinCards: parseInt(String(chatWidgetConfig.agentListMinCards)) || 3,
        agentListingType: chatWidgetConfig.agentListingType,
      }),
      // If no widget config exists, use defaults with chatbot name as title
      ...(!chatWidgetConfig && {
        title: chatbot.name,
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
      // Feature flags
      enabledChat: chatbot.enabledChat,
      enabledCall: chatbot.enabledCall,
      // Call widget configuration
      callConfig: callWidgetConfig,
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Preview config error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preview configuration" },
      { status: 500 }
    );
  }
}
