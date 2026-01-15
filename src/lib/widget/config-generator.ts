/**
 * Widget Configuration Generator Service
 *
 * Generates and stores widget configuration JSON files in Cloudflare R2 Storage
 * for fast widget initialization without API calls.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatbots, type ChatbotSettings, type ChatWidgetConfig } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import {
  uploadWidgetConfig,
  deleteWidgetConfig as deleteR2WidgetConfig,
  getWidgetConfigUrl,
  getWidgetConfigPath,
} from "@/lib/r2";

import {
  type WidgetConfigJson,
  type WidgetAgentInfo,
  type GenerateWidgetConfigResult,
  WIDGET_CONFIG_DEFAULTS,
} from "./types";

/**
 * Get the storage path for a widget config JSON file
 * @deprecated Use getWidgetConfigPath from @/lib/r2 instead
 */
export function getWidgetConfigStoragePath(
  companyId: string,
  chatbotId: string
): string {
  return getWidgetConfigPath(companyId, chatbotId);
}

/**
 * Generate and upload widget configuration JSON to R2 Storage
 *
 * @param chatbotId - The chatbot ID to generate config for
 * @returns Result with success status, config URL, and storage path
 */
export async function generateWidgetConfigJson(
  chatbotId: string
): Promise<GenerateWidgetConfigResult> {
  try {
    // 1. Fetch chatbot with company and widget config
    const chatbot = await db.query.chatbots.findFirst({
      where: eq(chatbots.id, chatbotId),
    });

    if (!chatbot) {
      return { success: false, error: "Chatbot not found" };
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, chatbot.companyId),
    });

    if (!company) {
      return { success: false, error: "Company not found" };
    }

    // 2. Get widget config from chatbot's unified widgetConfig.chat field
    const unifiedConfig = chatbot.widgetConfig as { chat?: ChatWidgetConfig; call?: Record<string, unknown> } | null;
    const chatWidgetConfig = unifiedConfig?.chat;

    // 3. Build the widget config JSON
    const configJson = buildWidgetConfigJson(chatbot, company, chatWidgetConfig);

    // 4. Upload to R2 Storage
    const storagePath = getWidgetConfigPath(company.id, chatbotId);
    const configUrl = await uploadWidgetConfig(
      company.id,
      chatbotId,
      configJson as unknown as Record<string, unknown>
    );

    // 5. Update chatbot settings with the URL
    const settings: ChatbotSettings = {
      ...(chatbot.settings || {}),
      widgetConfigUrl: configUrl,
      widgetConfigPath: storagePath,
      widgetConfigGeneratedAt: new Date().toISOString(),
    };

    await db
      .update(chatbots)
      .set({ settings, updatedAt: new Date() })
      .where(eq(chatbots.id, chatbotId));

    console.log(`Generated widget config for chatbot ${chatbotId}: ${storagePath}`);

    return {
      success: true,
      configUrl,
      storagePath,
    };
  } catch (error) {
    console.error("Error generating widget config JSON:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete widget configuration JSON from R2 Storage
 *
 * @param companyId - The company ID
 * @param chatbotId - The chatbot ID
 */
export async function deleteWidgetConfigJson(
  companyId: string,
  chatbotId: string
): Promise<void> {
  try {
    await deleteR2WidgetConfig(companyId, chatbotId);
  } catch (error) {
    console.error(`Failed to delete widget config JSON for chatbot ${chatbotId}`, error);
  }
}

/**
 * Get the public URL for a widget config
 */
export function getWidgetConfigPublicUrl(
  companyId: string,
  chatbotId: string
): string {
  return getWidgetConfigUrl(companyId, chatbotId);
}

/**
 * Build the widget configuration JSON object
 */
function buildWidgetConfigJson(
  chatbot: typeof chatbots.$inferSelect,
  company: typeof companies.$inferSelect,
  widgetConfig: ChatWidgetConfig | undefined
): WidgetConfigJson {
  // Extract agents from chatbot's agentsList
  const agents: WidgetAgentInfo[] = (chatbot.agentsList || []).map((agent) => ({
    id: agent.agent_identifier,
    name: agent.name,
    designation: agent.designation,
    avatarUrl: agent.avatar_url,
    color: agent.color,
    type: agent.agent_type,
  }));

  // Determine chatbot type
  const isMultiAgent = chatbot.packageType === "multi_agent";

  // Use defaults if no widget config exists
  const wc = widgetConfig;

  const config: WidgetConfigJson = {
    // Metadata
    version: WIDGET_CONFIG_DEFAULTS.version,
    generatedAt: new Date().toISOString(),

    // Chatbot info
    chatbot: {
      id: chatbot.id,
      name: chatbot.name,
      type: isMultiAgent ? "multi_agent" : "single_agent",
      companyId: chatbot.companyId,
    },

    // Agents
    agents,

    // Appearance
    appearance: {
      theme: (wc?.theme as "light" | "dark" | "auto") ?? WIDGET_CONFIG_DEFAULTS.appearance.theme,
      position: (wc?.position as "bottom-right" | "bottom-left") ?? WIDGET_CONFIG_DEFAULTS.appearance.position,
      placement: (wc?.placement as "above-launcher" | "center-screen") ?? WIDGET_CONFIG_DEFAULTS.appearance.placement,
      primaryColor: wc?.primaryColor ?? WIDGET_CONFIG_DEFAULTS.appearance.primaryColor,
      accentColor: wc?.accentColor ?? WIDGET_CONFIG_DEFAULTS.appearance.accentColor,
      userBubbleColor: wc?.userBubbleColor ?? WIDGET_CONFIG_DEFAULTS.appearance.userBubbleColor,
      overrideAgentColor: wc?.overrideAgentColor ?? WIDGET_CONFIG_DEFAULTS.appearance.overrideAgentColor,
      agentBubbleColor: wc?.agentBubbleColor ?? WIDGET_CONFIG_DEFAULTS.appearance.agentBubbleColor,
      borderRadius: Number(wc?.borderRadius ?? WIDGET_CONFIG_DEFAULTS.appearance.borderRadius),
      buttonSize: Number(wc?.buttonSize ?? WIDGET_CONFIG_DEFAULTS.appearance.buttonSize),
      launcherIcon: wc?.launcherIcon ?? WIDGET_CONFIG_DEFAULTS.appearance.launcherIcon,
      launcherText: wc?.launcherText ?? undefined,
      launcherIconBorderRadius: Number(wc?.launcherIconBorderRadius ?? WIDGET_CONFIG_DEFAULTS.appearance.launcherIconBorderRadius),
      launcherIconPulseGlow: wc?.launcherIconPulseGlow ?? WIDGET_CONFIG_DEFAULTS.appearance.launcherIconPulseGlow,
      showLauncherText: wc?.showLauncherText ?? WIDGET_CONFIG_DEFAULTS.appearance.showLauncherText,
      launcherTextBackgroundColor: wc?.launcherTextBackgroundColor ?? WIDGET_CONFIG_DEFAULTS.appearance.launcherTextBackgroundColor,
      launcherTextColor: wc?.launcherTextColor ?? WIDGET_CONFIG_DEFAULTS.appearance.launcherTextColor,
      zIndex: Number(wc?.zIndex ?? WIDGET_CONFIG_DEFAULTS.appearance.zIndex),
    },

    // Branding
    branding: {
      title: wc?.title ?? WIDGET_CONFIG_DEFAULTS.branding.title,
      subtitle: wc?.subtitle ?? undefined,
      welcomeMessage: wc?.welcomeMessage ?? WIDGET_CONFIG_DEFAULTS.branding.welcomeMessage,
      logoUrl: wc?.logoUrl ?? undefined,
      avatarUrl: wc?.avatarUrl ?? undefined,
      showBranding: wc?.showBranding ?? WIDGET_CONFIG_DEFAULTS.branding.showBranding,
    },

    // Behavior
    behavior: {
      autoOpen: wc?.autoOpen ?? WIDGET_CONFIG_DEFAULTS.behavior.autoOpen,
      autoOpenDelay: Number(wc?.autoOpenDelay ?? WIDGET_CONFIG_DEFAULTS.behavior.autoOpenDelay),
      playSoundOnMessage: wc?.playSoundOnMessage ?? WIDGET_CONFIG_DEFAULTS.behavior.playSoundOnMessage,
      persistConversation: wc?.persistConversation ?? WIDGET_CONFIG_DEFAULTS.behavior.persistConversation,
      hideLauncherOnMobile: wc?.hideLauncherOnMobile ?? WIDGET_CONFIG_DEFAULTS.behavior.hideLauncherOnMobile,
    },

    // Features
    features: {
      enableFileUpload: wc?.enableFileUpload ?? WIDGET_CONFIG_DEFAULTS.features.enableFileUpload,
      enableVoiceMessages: wc?.enableVoiceMessages ?? WIDGET_CONFIG_DEFAULTS.features.enableVoiceMessages,
      enableFeedback: wc?.enableFeedback ?? WIDGET_CONFIG_DEFAULTS.features.enableFeedback,
      requireEmail: wc?.requireEmail ?? WIDGET_CONFIG_DEFAULTS.features.requireEmail,
      requireName: wc?.requireName ?? WIDGET_CONFIG_DEFAULTS.features.requireName,
    },

    // Stream display options
    streamDisplay: {
      showAgentSwitchNotification: wc?.showAgentSwitchNotification ?? WIDGET_CONFIG_DEFAULTS.streamDisplay.showAgentSwitchNotification,
      showThinking: wc?.showThinking ?? WIDGET_CONFIG_DEFAULTS.streamDisplay.showThinking,
      showInstantUpdates: wc?.showInstantUpdates ?? WIDGET_CONFIG_DEFAULTS.streamDisplay.showInstantUpdates,
    },

    // Pre-chat form
    preChatForm: {
      enabled: (wc?.preChatForm as { enabled: boolean; fields: unknown[] })?.enabled ?? WIDGET_CONFIG_DEFAULTS.preChatForm.enabled,
      fields: ((wc?.preChatForm as { enabled: boolean; fields: unknown[] })?.fields ?? []) as WidgetConfigJson["preChatForm"]["fields"],
    },

    // Custom CSS
    customCss: wc?.customCss ?? undefined,

    // Security
    security: {
      allowedDomains: (wc?.allowedDomains as string[]) ?? WIDGET_CONFIG_DEFAULTS.security.allowedDomains,
    },
  };

  // Add multi-agent options if applicable
  if (isMultiAgent) {
    config.multiAgent = {
      showAgentListOnTop: wc?.showAgentListOnTop ?? WIDGET_CONFIG_DEFAULTS.multiAgent.showAgentListOnTop,
      agentListMinCards: Number(wc?.agentListMinCards ?? WIDGET_CONFIG_DEFAULTS.multiAgent.agentListMinCards),
      agentListingType: (wc?.agentListingType as "minimal" | "compact" | "standard" | "detailed") ?? WIDGET_CONFIG_DEFAULTS.multiAgent.agentListingType,
    };
  }

  return config;
}
