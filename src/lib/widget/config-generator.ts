/**
 * Widget Configuration Generator Service
 *
 * Generates and stores widget configuration JSON files in Supabase Storage
 * for fast widget initialization without API calls.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatbots, type ChatbotSettings } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { widgetConfigs } from "@/lib/db/schema/widgets";
import {
  getSupabaseClient,
  getSignedStorageUrl,
  STORAGE_BUCKET,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
} from "@/lib/supabase/client";

import {
  type WidgetConfigJson,
  type WidgetAgentInfo,
  type GenerateWidgetConfigResult,
  WIDGET_CONFIG_DEFAULTS,
} from "./types";

/**
 * Get the storage path for a widget config JSON file
 */
export function getWidgetConfigStoragePath(
  companyId: string,
  chatbotId: string
): string {
  return `public/companies/${companyId}/widget/${chatbotId}.json`;
}

/**
 * Generate and upload widget configuration JSON to Supabase Storage
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

    // 2. Fetch widget config for this chatbot
    const widgetConfig = await db.query.widgetConfigs.findFirst({
      where: eq(widgetConfigs.chatbotId, chatbotId),
    });

    // 3. Build the widget config JSON
    const configJson = buildWidgetConfigJson(chatbot, company, widgetConfig);

    // 4. Upload to Supabase Storage
    const storagePath = getWidgetConfigStoragePath(company.id, chatbotId);
    const jsonContent = JSON.stringify(configJson, null, 2);

    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, jsonContent, {
        contentType: "application/json",
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error("Failed to upload widget config JSON:", uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // 5. Generate signed URL (10-year expiry)
    const configUrl = await getSignedStorageUrl(
      storagePath,
      MAX_SIGNED_URL_EXPIRY_SECONDS
    );

    if (!configUrl) {
      return { success: false, error: "Failed to generate signed URL" };
    }

    // 6. Update chatbot settings with the URL
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
 * Delete widget configuration JSON from Supabase Storage
 *
 * @param companyId - The company ID
 * @param chatbotId - The chatbot ID
 */
export async function deleteWidgetConfigJson(
  companyId: string,
  chatbotId: string
): Promise<void> {
  const storagePath = getWidgetConfigStoragePath(companyId, chatbotId);
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete widget config JSON: ${storagePath}`, error);
  }
}

/**
 * Build the widget configuration JSON object
 */
function buildWidgetConfigJson(
  chatbot: typeof chatbots.$inferSelect,
  company: typeof companies.$inferSelect,
  widgetConfig: typeof widgetConfigs.$inferSelect | undefined
): WidgetConfigJson {
  // Extract agents from chatbot's agentsList
  const agents: WidgetAgentInfo[] = (chatbot.agentsList || []).map((agent) => ({
    id: agent.agent_identifier,
    name: agent.name,
    designation: agent.designation,
    avatarUrl: agent.avatar_url,
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
      primaryColor: wc?.primaryColor ?? WIDGET_CONFIG_DEFAULTS.appearance.primaryColor,
      accentColor: wc?.accentColor ?? WIDGET_CONFIG_DEFAULTS.appearance.accentColor,
      borderRadius: parseInt(wc?.borderRadius ?? String(WIDGET_CONFIG_DEFAULTS.appearance.borderRadius), 10),
      buttonSize: parseInt(wc?.buttonSize ?? String(WIDGET_CONFIG_DEFAULTS.appearance.buttonSize), 10),
      launcherIcon: wc?.launcherIcon ?? WIDGET_CONFIG_DEFAULTS.appearance.launcherIcon,
      launcherText: wc?.launcherText ?? undefined,
      zIndex: parseInt(wc?.zIndex ?? String(WIDGET_CONFIG_DEFAULTS.appearance.zIndex), 10),
    },

    // Branding
    branding: {
      title: wc?.title ?? WIDGET_CONFIG_DEFAULTS.branding.title,
      subtitle: wc?.subtitle ?? undefined,
      welcomeMessage: wc?.welcomeMessage ?? WIDGET_CONFIG_DEFAULTS.branding.welcomeMessage,
      offlineMessage: wc?.offlineMessage ?? undefined,
      logoUrl: wc?.logoUrl ?? undefined,
      avatarUrl: wc?.avatarUrl ?? undefined,
      companyName: wc?.companyName ?? company.name ?? undefined,
      showBranding: wc?.showBranding ?? WIDGET_CONFIG_DEFAULTS.branding.showBranding,
    },

    // Behavior
    behavior: {
      autoOpen: wc?.autoOpen ?? WIDGET_CONFIG_DEFAULTS.behavior.autoOpen,
      autoOpenDelay: parseInt(wc?.autoOpenDelay ?? String(WIDGET_CONFIG_DEFAULTS.behavior.autoOpenDelay), 10),
      playSoundOnMessage: wc?.playSoundOnMessage ?? WIDGET_CONFIG_DEFAULTS.behavior.playSoundOnMessage,
      showTypingIndicator: wc?.showTypingIndicator ?? WIDGET_CONFIG_DEFAULTS.behavior.showTypingIndicator,
      persistConversation: wc?.persistConversation ?? WIDGET_CONFIG_DEFAULTS.behavior.persistConversation,
      hideLauncherOnMobile: wc?.hideLauncherOnMobile ?? WIDGET_CONFIG_DEFAULTS.behavior.hideLauncherOnMobile,
    },

    // Features
    features: {
      enableFileUpload: wc?.enableFileUpload ?? WIDGET_CONFIG_DEFAULTS.features.enableFileUpload,
      enableVoiceMessages: wc?.enableVoiceMessages ?? WIDGET_CONFIG_DEFAULTS.features.enableVoiceMessages,
      enableEmoji: wc?.enableEmoji ?? WIDGET_CONFIG_DEFAULTS.features.enableEmoji,
      enableFeedback: wc?.enableFeedback ?? WIDGET_CONFIG_DEFAULTS.features.enableFeedback,
      requireEmail: wc?.requireEmail ?? WIDGET_CONFIG_DEFAULTS.features.requireEmail,
      requireName: wc?.requireName ?? WIDGET_CONFIG_DEFAULTS.features.requireName,
    },

    // Stream display options
    streamDisplay: {
      showAgentSwitchNotification: wc?.showAgentSwitchNotification ?? WIDGET_CONFIG_DEFAULTS.streamDisplay.showAgentSwitchNotification,
      showThinking: wc?.showThinking ?? WIDGET_CONFIG_DEFAULTS.streamDisplay.showThinking,
      showToolCalls: wc?.showToolCalls ?? WIDGET_CONFIG_DEFAULTS.streamDisplay.showToolCalls,
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
      blockedDomains: (wc?.blockedDomains as string[]) ?? WIDGET_CONFIG_DEFAULTS.security.blockedDomains,
    },
  };

  // Add multi-agent options if applicable
  if (isMultiAgent) {
    config.multiAgent = {
      showAgentListOnTop: wc?.showAgentListOnTop ?? WIDGET_CONFIG_DEFAULTS.multiAgent.showAgentListOnTop,
      agentListMinCards: parseInt(wc?.agentListMinCards ?? String(WIDGET_CONFIG_DEFAULTS.multiAgent.agentListMinCards), 10),
    };
  }

  return config;
}
