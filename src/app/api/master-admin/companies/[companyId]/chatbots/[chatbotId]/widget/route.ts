import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots, type ChatWidgetConfig, type WidgetConfig } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { generateWidgetConfigJson } from "@/lib/widget/config-generator";

interface RouteContext {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

// Default chat widget config values
const DEFAULT_CHAT_CONFIG: ChatWidgetConfig = {
  theme: "light",
  position: "bottom-right",
  placement: "above-launcher",
  primaryColor: "#6437F3",
  accentColor: "#2b3dd8",
  userBubbleColor: undefined,
  overrideAgentColor: false,
  agentBubbleColor: undefined,
  borderRadius: 16,
  buttonSize: 60,
  title: "Chat with us",
  welcomeMessage: "Hello! How can we help you today?",
  autoOpen: false,
  autoOpenDelay: 5,
  showBranding: true,
  playSoundOnMessage: false,
  persistConversation: true,
  enableFileUpload: true,
  enableVoiceMessages: false,
  enableFeedback: true,
  requireEmail: false,
  requireName: false,
  zIndex: 9999,
  launcherIcon: "chat",
  hideLauncherOnMobile: false,
  launcherIconBorderRadius: 50,
  launcherIconPulseGlow: false,
  showLauncherText: false,
  launcherTextBackgroundColor: "#ffffff",
  launcherTextColor: "#333333",
  preChatForm: { enabled: false, fields: [] },
  showAgentSwitchNotification: true,
  showThinking: true,
  showInstantUpdates: true,
  showAgentListOnTop: false,
  agentListMinCards: 3,
  agentListingType: "compact",
};

export interface WidgetConfigResponse {
  chatbotId: string;
  // Appearance
  theme: string;
  position: string;
  placement: string;
  primaryColor: string;
  accentColor: string;
  borderRadius: string;
  buttonSize: string;
  // Branding
  title: string;
  subtitle: string | null;
  welcomeMessage: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  // Behavior
  autoOpen: boolean;
  autoOpenDelay: string;
  showBranding: boolean;
  playSoundOnMessage: boolean;
  persistConversation: boolean;
  // Features
  enableFileUpload: boolean;
  enableVoiceMessages: boolean;
  enableFeedback: boolean;
  requireEmail: boolean;
  requireName: boolean;
  // Advanced
  customCss: string | null;
  allowedDomains: string[];
  zIndex: string;
  // Launcher
  launcherIcon: string;
  launcherText: string | null;
  hideLauncherOnMobile: boolean;
  launcherIconBorderRadius: string;
  launcherIconPulseGlow: boolean;
  showLauncherText: boolean;
  launcherTextBackgroundColor: string;
  launcherTextColor: string;
  // Pre-chat Form
  preChatForm: {
    enabled: boolean;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
  // Stream Display Options
  showAgentSwitchNotification: boolean;
  showThinking: boolean;
  showInstantUpdates: boolean;
  // Multi-agent Display Options
  showAgentListOnTop: boolean;
  agentListMinCards: string;
  agentListingType: string;
  // Embed info
  embedCode: string;
  createdAt: string;
  updatedAt: string;
}

function generateEmbedCode(companySlug: string, chatbotId: string): string {
  const scriptUrl = `https://widget.buzzi.ai/embed.js`;
  return `<script>
  (function(w,d,s,o,f,js,fjs){
    w['BuzziWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','buzzi','${scriptUrl}'));
  buzzi('init', '${companySlug}', { chatbotId: '${chatbotId}' });
</script>`;
}

function buildResponse(chatbotId: string, config: ChatWidgetConfig, companySlug: string, createdAt: Date, updatedAt: Date): WidgetConfigResponse {
  return {
    chatbotId,
    // Appearance
    theme: config.theme || "light",
    position: config.position || "bottom-right",
    placement: config.placement || "above-launcher",
    primaryColor: config.primaryColor || "#6437F3",
    accentColor: config.accentColor || "#2b3dd8",
    borderRadius: String(config.borderRadius ?? 16),
    buttonSize: String(config.buttonSize ?? 60),
    // Branding
    title: config.title || "Chat with us",
    subtitle: config.subtitle || null,
    welcomeMessage: config.welcomeMessage || "Hello! How can we help you today?",
    logoUrl: config.logoUrl || null,
    avatarUrl: config.avatarUrl || null,
    // Behavior
    autoOpen: config.autoOpen ?? false,
    autoOpenDelay: String(config.autoOpenDelay ?? 5),
    showBranding: config.showBranding ?? true,
    playSoundOnMessage: config.playSoundOnMessage ?? false,
    persistConversation: config.persistConversation ?? true,
    // Features
    enableFileUpload: config.enableFileUpload ?? true,
    enableVoiceMessages: config.enableVoiceMessages ?? false,
    enableFeedback: config.enableFeedback ?? true,
    requireEmail: config.requireEmail ?? false,
    requireName: config.requireName ?? false,
    // Advanced
    customCss: config.customCss || null,
    allowedDomains: config.allowedDomains || [],
    zIndex: String(config.zIndex ?? 9999),
    // Launcher
    launcherIcon: config.launcherIcon || "chat",
    launcherText: config.launcherText || null,
    hideLauncherOnMobile: config.hideLauncherOnMobile ?? false,
    launcherIconBorderRadius: String(config.launcherIconBorderRadius ?? 50),
    launcherIconPulseGlow: config.launcherIconPulseGlow ?? false,
    showLauncherText: config.showLauncherText ?? false,
    launcherTextBackgroundColor: config.launcherTextBackgroundColor || "#ffffff",
    launcherTextColor: config.launcherTextColor || "#333333",
    // Pre-chat Form
    preChatForm: (config.preChatForm as WidgetConfigResponse["preChatForm"]) || { enabled: false, fields: [] },
    // Stream Display Options
    showAgentSwitchNotification: config.showAgentSwitchNotification ?? true,
    showThinking: config.showThinking ?? true,
    showInstantUpdates: config.showInstantUpdates ?? true,
    // Multi-agent Display Options
    showAgentListOnTop: config.showAgentListOnTop ?? false,
    agentListMinCards: String(config.agentListMinCards ?? 3),
    agentListingType: config.agentListingType || "compact",
    // Embed info
    embedCode: generateEmbedCode(companySlug, chatbotId),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * GET /api/master-admin/companies/[companyId]/chatbots/[chatbotId]/widget
 * Get widget configuration for a chatbot
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    // Get chatbot with widget config
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        widgetConfig: chatbots.widgetConfig,
        createdAt: chatbots.createdAt,
        updatedAt: chatbots.updatedAt,
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

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Get company for embed code
    const [company] = await db
      .select({ slug: companies.slug, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    // Get chat config from unified widgetConfig
    const unifiedConfig = chatbot.widgetConfig as WidgetConfig | null;
    const config: ChatWidgetConfig = {
      ...DEFAULT_CHAT_CONFIG,
      ...(unifiedConfig?.chat || {}),
    };

    // If no config exists, initialize with defaults and save
    if (!unifiedConfig?.chat || Object.keys(unifiedConfig.chat).length === 0) {
      const newConfig: WidgetConfig = {
        chat: { ...DEFAULT_CHAT_CONFIG, title: `Chat with ${chatbot.name}` },
        call: unifiedConfig?.call || {},
      };

      await db
        .update(chatbots)
        .set({
          widgetConfig: newConfig,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, chatbotId));

      config.title = `Chat with ${chatbot.name}`;
    }

    return NextResponse.json({
      config: buildResponse(chatbotId, config, company?.slug ?? "unknown", chatbot.createdAt, chatbot.updatedAt),
    });
  } catch (error) {
    console.error("Error fetching widget config:", error);
    return NextResponse.json(
      { error: "Failed to fetch widget configuration" },
      { status: 500 }
    );
  }
}

interface UpdateWidgetConfigRequest {
  // Appearance
  theme?: string;
  position?: string;
  placement?: string;
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  buttonSize?: string;
  // Branding
  title?: string;
  subtitle?: string | null;
  welcomeMessage?: string;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  // Behavior
  autoOpen?: boolean;
  autoOpenDelay?: string;
  showBranding?: boolean;
  playSoundOnMessage?: boolean;
  persistConversation?: boolean;
  // Features
  enableFileUpload?: boolean;
  enableVoiceMessages?: boolean;
  enableFeedback?: boolean;
  requireEmail?: boolean;
  requireName?: boolean;
  // Advanced
  customCss?: string | null;
  allowedDomains?: string[];
  zIndex?: string;
  // Launcher
  launcherIcon?: string;
  launcherText?: string | null;
  hideLauncherOnMobile?: boolean;
  launcherIconBorderRadius?: string;
  launcherIconPulseGlow?: boolean;
  showLauncherText?: boolean;
  launcherTextBackgroundColor?: string;
  launcherTextColor?: string;
  // Pre-chat Form
  preChatForm?: {
    enabled: boolean;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
  // Stream Display Options
  showAgentSwitchNotification?: boolean;
  showThinking?: boolean;
  showInstantUpdates?: boolean;
  // Multi-agent Display Options
  showAgentListOnTop?: boolean;
  agentListMinCards?: string;
  agentListingType?: string;
}

/**
 * PATCH /api/master-admin/companies/[companyId]/chatbots/[chatbotId]/widget
 * Update widget configuration for a chatbot
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, chatbotId } = await context.params;

    // Verify chatbot exists and belongs to company
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        widgetConfig: chatbots.widgetConfig,
        createdAt: chatbots.createdAt,
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

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body: UpdateWidgetConfigRequest = await request.json();

    // Get company for embed code
    const [company] = await db
      .select({ slug: companies.slug, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    // Get existing config and merge with updates
    const existingConfig = (chatbot.widgetConfig as WidgetConfig) || { chat: {}, call: {} };
    const existingChatConfig = existingConfig.chat || {};

    // Build updated chat config by merging existing with updates
    const updatedChatConfig: ChatWidgetConfig = {
      ...existingChatConfig,
    };

    // Apply updates (only defined values)
    if (body.theme !== undefined) updatedChatConfig.theme = body.theme as ChatWidgetConfig["theme"];
    if (body.position !== undefined) updatedChatConfig.position = body.position as ChatWidgetConfig["position"];
    if (body.placement !== undefined) updatedChatConfig.placement = body.placement as ChatWidgetConfig["placement"];
    if (body.primaryColor !== undefined) updatedChatConfig.primaryColor = body.primaryColor;
    if (body.accentColor !== undefined) updatedChatConfig.accentColor = body.accentColor;
    if (body.borderRadius !== undefined) updatedChatConfig.borderRadius = parseInt(body.borderRadius, 10);
    if (body.buttonSize !== undefined) updatedChatConfig.buttonSize = parseInt(body.buttonSize, 10);
    if (body.title !== undefined) updatedChatConfig.title = body.title;
    if (body.subtitle !== undefined) updatedChatConfig.subtitle = body.subtitle || undefined;
    if (body.welcomeMessage !== undefined) updatedChatConfig.welcomeMessage = body.welcomeMessage;
    if (body.logoUrl !== undefined) updatedChatConfig.logoUrl = body.logoUrl || undefined;
    if (body.avatarUrl !== undefined) updatedChatConfig.avatarUrl = body.avatarUrl || undefined;
    if (body.autoOpen !== undefined) updatedChatConfig.autoOpen = body.autoOpen;
    if (body.autoOpenDelay !== undefined) updatedChatConfig.autoOpenDelay = parseInt(body.autoOpenDelay, 10);
    if (body.showBranding !== undefined) updatedChatConfig.showBranding = body.showBranding;
    if (body.playSoundOnMessage !== undefined) updatedChatConfig.playSoundOnMessage = body.playSoundOnMessage;
    if (body.persistConversation !== undefined) updatedChatConfig.persistConversation = body.persistConversation;
    if (body.enableFileUpload !== undefined) updatedChatConfig.enableFileUpload = body.enableFileUpload;
    if (body.enableVoiceMessages !== undefined) updatedChatConfig.enableVoiceMessages = body.enableVoiceMessages;
    if (body.enableFeedback !== undefined) updatedChatConfig.enableFeedback = body.enableFeedback;
    if (body.requireEmail !== undefined) updatedChatConfig.requireEmail = body.requireEmail;
    if (body.requireName !== undefined) updatedChatConfig.requireName = body.requireName;
    if (body.customCss !== undefined) updatedChatConfig.customCss = body.customCss || undefined;
    if (body.allowedDomains !== undefined) updatedChatConfig.allowedDomains = body.allowedDomains;
    if (body.zIndex !== undefined) updatedChatConfig.zIndex = parseInt(body.zIndex, 10);
    if (body.launcherIcon !== undefined) updatedChatConfig.launcherIcon = body.launcherIcon as ChatWidgetConfig["launcherIcon"];
    if (body.launcherText !== undefined) updatedChatConfig.launcherText = body.launcherText || undefined;
    if (body.hideLauncherOnMobile !== undefined) updatedChatConfig.hideLauncherOnMobile = body.hideLauncherOnMobile;
    if (body.launcherIconBorderRadius !== undefined) updatedChatConfig.launcherIconBorderRadius = parseInt(body.launcherIconBorderRadius, 10);
    if (body.launcherIconPulseGlow !== undefined) updatedChatConfig.launcherIconPulseGlow = body.launcherIconPulseGlow;
    if (body.showLauncherText !== undefined) updatedChatConfig.showLauncherText = body.showLauncherText;
    if (body.launcherTextBackgroundColor !== undefined) updatedChatConfig.launcherTextBackgroundColor = body.launcherTextBackgroundColor;
    if (body.launcherTextColor !== undefined) updatedChatConfig.launcherTextColor = body.launcherTextColor;
    if (body.preChatForm !== undefined) updatedChatConfig.preChatForm = body.preChatForm;
    if (body.showAgentSwitchNotification !== undefined) updatedChatConfig.showAgentSwitchNotification = body.showAgentSwitchNotification;
    if (body.showThinking !== undefined) updatedChatConfig.showThinking = body.showThinking;
    if (body.showInstantUpdates !== undefined) updatedChatConfig.showInstantUpdates = body.showInstantUpdates;
    if (body.showAgentListOnTop !== undefined) updatedChatConfig.showAgentListOnTop = body.showAgentListOnTop;
    if (body.agentListMinCards !== undefined) updatedChatConfig.agentListMinCards = parseInt(body.agentListMinCards, 10);
    if (body.agentListingType !== undefined) updatedChatConfig.agentListingType = body.agentListingType as ChatWidgetConfig["agentListingType"];

    // Update chatbot with new widget config
    const [updated] = await db
      .update(chatbots)
      .set({
        widgetConfig: {
          chat: updatedChatConfig,
          call: existingConfig.call || {},
        },
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, chatbotId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update widget configuration" },
        { status: 500 }
      );
    }

    // Regenerate widget config JSON in R2 Storage
    const regenerateResult = await generateWidgetConfigJson(chatbotId);
    if (!regenerateResult.success) {
      console.error("Failed to regenerate widget config JSON:", regenerateResult.error);
      // Continue anyway - the database update succeeded
    }

    const finalConfig = (updated.widgetConfig as WidgetConfig).chat || {};

    return NextResponse.json({
      config: buildResponse(chatbotId, finalConfig, company?.slug ?? "unknown", chatbot.createdAt, updated.updatedAt),
    });
  } catch (error) {
    console.error("Error updating widget config:", error);
    return NextResponse.json(
      { error: "Failed to update widget configuration" },
      { status: 500 }
    );
  }
}
