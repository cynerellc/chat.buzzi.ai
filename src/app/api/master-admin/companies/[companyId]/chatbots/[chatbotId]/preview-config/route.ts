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
import { widgetConfigs } from "@/lib/db/schema/widgets";
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

    if (chatbotResult.length === 0) {
      return NextResponse.json(
        { error: "Chatbot not found" },
        { status: 404 }
      );
    }

    const chatbot = chatbotResult[0];
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

    // Fetch widget config for this chatbot
    const widgetConfigResult = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.chatbotId, chatbotId))
      .limit(1);

    const widgetConfig = widgetConfigResult[0];

    // Merge default config with widget config from database
    const config = {
      ...DEFAULT_CONFIG,
      // Apply widget config customizations if they exist
      ...(widgetConfig && {
        theme: widgetConfig.theme,
        position: widgetConfig.position,
        placement: widgetConfig.placement,
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
        persistConversation: widgetConfig.persistConversation,
        enableVoice: widgetConfig.enableVoiceMessages,
        enableFileUpload: widgetConfig.enableFileUpload,
        launcherIcon: widgetConfig.launcherIcon,
        launcherText: widgetConfig.launcherText || undefined,
        buttonSize: parseInt(widgetConfig.buttonSize) || 60,
        launcherIconBorderRadius: parseInt(widgetConfig.launcherIconBorderRadius) || 50,
        launcherIconPulseGlow: widgetConfig.launcherIconPulseGlow ?? false,
        hideLauncherOnMobile: widgetConfig.hideLauncherOnMobile ?? false,
        customCss: widgetConfig.customCss || undefined,
        // Stream Display Options
        showAgentSwitchNotification: widgetConfig.showAgentSwitchNotification,
        showThinking: widgetConfig.showThinking,
        showInstantUpdates: widgetConfig.showInstantUpdates,
        // Multi-agent Display Options
        showAgentListOnTop: widgetConfig.showAgentListOnTop,
        agentListMinCards: parseInt(widgetConfig.agentListMinCards) || 3,
        agentListingType: widgetConfig.agentListingType,
      }),
      // If no widget config exists, use defaults with chatbot name as title
      ...(!widgetConfig && {
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
