/**
 * @deprecated This route is deprecated. Use /api/company/chatbots/[chatbotId]/widget instead.
 * This route was originally designed for company-level widget config but should be chatbot-specific.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { chatbots, type ChatWidgetConfig, type WidgetConfig } from "@/lib/db/schema";

export interface WidgetConfigResponse {
  chatbotId: string;
  // Appearance
  theme: string;
  position: string;
  primaryColor: string;
  accentColor: string;
  borderRadius: number | string;
  buttonSize: number | string;
  // Branding
  title: string;
  subtitle: string | null;
  welcomeMessage: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  // Behavior
  autoOpen: boolean;
  autoOpenDelay: number | string;
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
  zIndex: number | string;
  // Launcher
  launcherIcon: string;
  launcherText: string | null;
  hideLauncherOnMobile: boolean;
  launcherIconBorderRadius: number | string;
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
  // Embed info
  embedCode: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CHAT_CONFIG: ChatWidgetConfig = {
  theme: "light",
  position: "bottom-right",
  placement: "above-launcher",
  primaryColor: "#6437F3",
  accentColor: "#2b3dd8",
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

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");

    if (!chatbotId) {
      return NextResponse.json(
        { error: "chatbotId query parameter is required" },
        { status: 400 }
      );
    }

    // Get chatbot and verify ownership
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        widgetConfig: chatbots.widgetConfig,
        createdAt: chatbots.createdAt,
        updatedAt: chatbots.updatedAt,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, company.id),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Get chat config from unified widgetConfig
    const unifiedConfig = chatbot.widgetConfig as WidgetConfig | null;
    const config: ChatWidgetConfig = {
      ...DEFAULT_CHAT_CONFIG,
      ...(unifiedConfig?.chat || {}),
    };

    const response: WidgetConfigResponse = {
      chatbotId: chatbot.id,
      theme: config.theme || "light",
      position: config.position || "bottom-right",
      primaryColor: config.primaryColor || "#6437F3",
      accentColor: config.accentColor || "#2b3dd8",
      borderRadius: config.borderRadius || "16",
      buttonSize: config.buttonSize || "60",
      title: config.title || "Chat with us",
      subtitle: config.subtitle || null,
      welcomeMessage: config.welcomeMessage || "Hello! How can we help you today?",
      logoUrl: config.logoUrl || null,
      avatarUrl: config.avatarUrl || null,
      autoOpen: config.autoOpen ?? false,
      autoOpenDelay: config.autoOpenDelay || "5",
      showBranding: config.showBranding ?? true,
      playSoundOnMessage: config.playSoundOnMessage ?? false,
      persistConversation: config.persistConversation ?? true,
      enableFileUpload: config.enableFileUpload ?? true,
      enableVoiceMessages: config.enableVoiceMessages ?? false,
      enableFeedback: config.enableFeedback ?? true,
      requireEmail: config.requireEmail ?? false,
      requireName: config.requireName ?? false,
      customCss: config.customCss || null,
      allowedDomains: config.allowedDomains || [],
      zIndex: config.zIndex || "9999",
      launcherIcon: config.launcherIcon || "chat",
      launcherText: config.launcherText || null,
      hideLauncherOnMobile: config.hideLauncherOnMobile ?? false,
      launcherIconBorderRadius: config.launcherIconBorderRadius || "50",
      launcherIconPulseGlow: config.launcherIconPulseGlow ?? false,
      showLauncherText: config.showLauncherText ?? false,
      launcherTextBackgroundColor: config.launcherTextBackgroundColor || "#ffffff",
      launcherTextColor: config.launcherTextColor || "#333333",
      preChatForm: (config.preChatForm as WidgetConfigResponse["preChatForm"]) || { enabled: false, fields: [] },
      embedCode: generateEmbedCode(company.slug, chatbotId),
      createdAt: chatbot.createdAt.toISOString(),
      updatedAt: chatbot.updatedAt.toISOString(),
    };

    return NextResponse.json({ config: response });
  } catch (error) {
    console.error("Error fetching widget config:", error);
    return NextResponse.json(
      { error: "Failed to fetch widget configuration" },
      { status: 500 }
    );
  }
}

interface UpdateWidgetConfigRequest {
  chatbotId: string;
  // All other fields are optional updates
  theme?: string;
  position?: string;
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  buttonSize?: string;
  title?: string;
  subtitle?: string | null;
  welcomeMessage?: string;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  autoOpen?: boolean;
  autoOpenDelay?: string;
  showBranding?: boolean;
  playSoundOnMessage?: boolean;
  persistConversation?: boolean;
  enableFileUpload?: boolean;
  enableVoiceMessages?: boolean;
  enableFeedback?: boolean;
  requireEmail?: boolean;
  requireName?: boolean;
  customCss?: string | null;
  allowedDomains?: string[];
  zIndex?: string;
  launcherIcon?: string;
  launcherText?: string | null;
  hideLauncherOnMobile?: boolean;
  launcherIconBorderRadius?: string;
  launcherIconPulseGlow?: boolean;
  showLauncherText?: boolean;
  launcherTextBackgroundColor?: string;
  launcherTextColor?: string;
  preChatForm?: {
    enabled: boolean;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
}

export async function PATCH(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body: UpdateWidgetConfigRequest = await request.json();

    if (!body.chatbotId) {
      return NextResponse.json(
        { error: "chatbotId is required" },
        { status: 400 }
      );
    }

    // Get chatbot and verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, body.chatbotId),
          eq(chatbots.companyId, company.id),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Get existing config and merge with updates
    const existingConfig = (chatbot.widgetConfig as WidgetConfig) || { chat: {}, call: {} };
    const existingChatConfig = existingConfig.chat || {};

    // Build updated chat config
    const { chatbotId: _, ...updates } = body;
    const updatedChatConfig: ChatWidgetConfig = {
      ...existingChatConfig,
      ...Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      ),
    };

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
      .where(eq(chatbots.id, body.chatbotId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update widget configuration" },
        { status: 500 }
      );
    }

    const finalConfig = (updated.widgetConfig as WidgetConfig).chat || {};
    const response: WidgetConfigResponse = {
      chatbotId: updated.id,
      theme: finalConfig.theme || "light",
      position: finalConfig.position || "bottom-right",
      primaryColor: finalConfig.primaryColor || "#6437F3",
      accentColor: finalConfig.accentColor || "#2b3dd8",
      borderRadius: finalConfig.borderRadius || "16",
      buttonSize: finalConfig.buttonSize || "60",
      title: finalConfig.title || "Chat with us",
      subtitle: finalConfig.subtitle || null,
      welcomeMessage: finalConfig.welcomeMessage || "Hello! How can we help you today?",
      logoUrl: finalConfig.logoUrl || null,
      avatarUrl: finalConfig.avatarUrl || null,
      autoOpen: finalConfig.autoOpen ?? false,
      autoOpenDelay: finalConfig.autoOpenDelay || "5",
      showBranding: finalConfig.showBranding ?? true,
      playSoundOnMessage: finalConfig.playSoundOnMessage ?? false,
      persistConversation: finalConfig.persistConversation ?? true,
      enableFileUpload: finalConfig.enableFileUpload ?? true,
      enableVoiceMessages: finalConfig.enableVoiceMessages ?? false,
      enableFeedback: finalConfig.enableFeedback ?? true,
      requireEmail: finalConfig.requireEmail ?? false,
      requireName: finalConfig.requireName ?? false,
      customCss: finalConfig.customCss || null,
      allowedDomains: finalConfig.allowedDomains || [],
      zIndex: finalConfig.zIndex || "9999",
      launcherIcon: finalConfig.launcherIcon || "chat",
      launcherText: finalConfig.launcherText || null,
      hideLauncherOnMobile: finalConfig.hideLauncherOnMobile ?? false,
      launcherIconBorderRadius: finalConfig.launcherIconBorderRadius || "50",
      launcherIconPulseGlow: finalConfig.launcherIconPulseGlow ?? false,
      showLauncherText: finalConfig.showLauncherText ?? false,
      launcherTextBackgroundColor: finalConfig.launcherTextBackgroundColor || "#ffffff",
      launcherTextColor: finalConfig.launcherTextColor || "#333333",
      preChatForm: (finalConfig.preChatForm as WidgetConfigResponse["preChatForm"]) || { enabled: false, fields: [] },
      embedCode: generateEmbedCode(company.slug, body.chatbotId),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json({ config: response });
  } catch (error) {
    console.error("Error updating widget config:", error);
    return NextResponse.json(
      { error: "Failed to update widget configuration" },
      { status: 500 }
    );
  }
}
