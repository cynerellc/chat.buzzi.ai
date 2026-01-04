import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { widgetConfigs } from "@/lib/db/schema";

export interface WidgetConfigResponse {
  id: string;
  chatbotId: string;
  // Appearance
  theme: string;
  position: string;
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
  // Embed info
  embedCode: string;
  createdAt: string;
  updatedAt: string;
}

function generateEmbedCode(companySlug: string): string {
  // In production, this would be the actual script URL
  const scriptUrl = `https://widget.buzzi.ai/embed.js`;
  return `<script>
  (function(w,d,s,o,f,js,fjs){
    w['BuzziWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','buzzi','${scriptUrl}'));
  buzzi('init', '${companySlug}');
</script>`;
}

export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    // Get or create widget config
    let [config] = await db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.chatbotId, company.id))
      .limit(1);

    // If no config exists, create a default one
    // TODO: This route should be restructured to take chatbotId as a param
    if (!config) {
      const [newConfig] = await db
        .insert(widgetConfigs)
        .values({
          chatbotId: company.id, // Temporary - should be actual chatbot ID
          logoUrl: company.logoUrl,
          primaryColor: company.primaryColor || "#6437F3",
          accentColor: company.secondaryColor || "#2b3dd8",
        })
        .returning();
      config = newConfig;
    }

    if (!config) {
      return NextResponse.json({ error: "Failed to create widget configuration" }, { status: 500 });
    }

    const response: WidgetConfigResponse = {
      id: config.id,
      chatbotId: config.chatbotId,
      // Appearance
      theme: config.theme,
      position: config.position,
      primaryColor: config.primaryColor,
      accentColor: config.accentColor,
      borderRadius: config.borderRadius,
      buttonSize: config.buttonSize,
      // Branding
      title: config.title,
      subtitle: config.subtitle,
      welcomeMessage: config.welcomeMessage,
      logoUrl: config.logoUrl,
      avatarUrl: config.avatarUrl,
      // Behavior
      autoOpen: config.autoOpen,
      autoOpenDelay: config.autoOpenDelay,
      showBranding: config.showBranding,
      playSoundOnMessage: config.playSoundOnMessage,
      persistConversation: config.persistConversation,
      // Features
      enableFileUpload: config.enableFileUpload,
      enableVoiceMessages: config.enableVoiceMessages,
      enableFeedback: config.enableFeedback,
      requireEmail: config.requireEmail,
      requireName: config.requireName,
      // Advanced
      customCss: config.customCss,
      allowedDomains: (config.allowedDomains as string[]) || [],
      zIndex: config.zIndex,
      // Launcher
      launcherIcon: config.launcherIcon,
      launcherText: config.launcherText,
      hideLauncherOnMobile: config.hideLauncherOnMobile,
      launcherIconBorderRadius: config.launcherIconBorderRadius,
      launcherIconPulseGlow: config.launcherIconPulseGlow,
      showLauncherText: config.showLauncherText,
      launcherTextBackgroundColor: config.launcherTextBackgroundColor,
      launcherTextColor: config.launcherTextColor,
      // Pre-chat Form
      preChatForm: config.preChatForm as WidgetConfigResponse["preChatForm"],
      // Embed info
      embedCode: generateEmbedCode(company.slug),
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
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
  // Appearance
  theme?: string;
  position?: string;
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
}

export async function PATCH(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body: UpdateWidgetConfigRequest = await request.json();

    // Ensure config exists
    let [existingConfig] = await db
      .select({ id: widgetConfigs.id })
      .from(widgetConfigs)
      .where(eq(widgetConfigs.chatbotId, company.id))
      .limit(1);

    if (!existingConfig) {
      // Create default config first
      // TODO: This route should be restructured to take chatbotId as a param
      [existingConfig] = await db
        .insert(widgetConfigs)
        .values({
          chatbotId: company.id, // Temporary - should be actual chatbot ID
        })
        .returning({ id: widgetConfigs.id });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Appearance
    if (body.theme !== undefined) updateData.theme = body.theme;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
    if (body.accentColor !== undefined) updateData.accentColor = body.accentColor;
    if (body.borderRadius !== undefined) updateData.borderRadius = body.borderRadius;
    if (body.buttonSize !== undefined) updateData.buttonSize = body.buttonSize;

    // Branding
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.welcomeMessage !== undefined) updateData.welcomeMessage = body.welcomeMessage;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;

    // Behavior
    if (body.autoOpen !== undefined) updateData.autoOpen = body.autoOpen;
    if (body.autoOpenDelay !== undefined) updateData.autoOpenDelay = body.autoOpenDelay;
    if (body.showBranding !== undefined) updateData.showBranding = body.showBranding;
    if (body.playSoundOnMessage !== undefined) updateData.playSoundOnMessage = body.playSoundOnMessage;
    if (body.persistConversation !== undefined) updateData.persistConversation = body.persistConversation;

    // Features
    if (body.enableFileUpload !== undefined) updateData.enableFileUpload = body.enableFileUpload;
    if (body.enableVoiceMessages !== undefined) updateData.enableVoiceMessages = body.enableVoiceMessages;
    if (body.enableFeedback !== undefined) updateData.enableFeedback = body.enableFeedback;
    if (body.requireEmail !== undefined) updateData.requireEmail = body.requireEmail;
    if (body.requireName !== undefined) updateData.requireName = body.requireName;

    // Advanced
    if (body.customCss !== undefined) updateData.customCss = body.customCss;
    if (body.allowedDomains !== undefined) updateData.allowedDomains = body.allowedDomains;
    if (body.zIndex !== undefined) updateData.zIndex = body.zIndex;

    // Launcher
    if (body.launcherIcon !== undefined) updateData.launcherIcon = body.launcherIcon;
    if (body.launcherText !== undefined) updateData.launcherText = body.launcherText;
    if (body.hideLauncherOnMobile !== undefined) updateData.hideLauncherOnMobile = body.hideLauncherOnMobile;
    if (body.launcherIconBorderRadius !== undefined) updateData.launcherIconBorderRadius = body.launcherIconBorderRadius;
    if (body.launcherIconPulseGlow !== undefined) updateData.launcherIconPulseGlow = body.launcherIconPulseGlow;
    if (body.showLauncherText !== undefined) updateData.showLauncherText = body.showLauncherText;
    if (body.launcherTextBackgroundColor !== undefined) updateData.launcherTextBackgroundColor = body.launcherTextBackgroundColor;
    if (body.launcherTextColor !== undefined) updateData.launcherTextColor = body.launcherTextColor;

    // Pre-chat Form
    if (body.preChatForm !== undefined) updateData.preChatForm = body.preChatForm;

    const [updatedConfig] = await db
      .update(widgetConfigs)
      .set(updateData)
      .where(eq(widgetConfigs.chatbotId, company.id))
      .returning();

    if (!updatedConfig) {
      return NextResponse.json({ error: "Failed to update widget configuration" }, { status: 500 });
    }

    const response: WidgetConfigResponse = {
      id: updatedConfig.id,
      chatbotId: updatedConfig.chatbotId,
      theme: updatedConfig.theme,
      position: updatedConfig.position,
      primaryColor: updatedConfig.primaryColor,
      accentColor: updatedConfig.accentColor,
      borderRadius: updatedConfig.borderRadius,
      buttonSize: updatedConfig.buttonSize,
      title: updatedConfig.title,
      subtitle: updatedConfig.subtitle,
      welcomeMessage: updatedConfig.welcomeMessage,
      logoUrl: updatedConfig.logoUrl,
      avatarUrl: updatedConfig.avatarUrl,
      autoOpen: updatedConfig.autoOpen,
      autoOpenDelay: updatedConfig.autoOpenDelay,
      showBranding: updatedConfig.showBranding,
      playSoundOnMessage: updatedConfig.playSoundOnMessage,
      persistConversation: updatedConfig.persistConversation,
      enableFileUpload: updatedConfig.enableFileUpload,
      enableVoiceMessages: updatedConfig.enableVoiceMessages,
      enableFeedback: updatedConfig.enableFeedback,
      requireEmail: updatedConfig.requireEmail,
      requireName: updatedConfig.requireName,
      customCss: updatedConfig.customCss,
      allowedDomains: (updatedConfig.allowedDomains as string[]) || [],
      zIndex: updatedConfig.zIndex,
      launcherIcon: updatedConfig.launcherIcon,
      launcherText: updatedConfig.launcherText,
      hideLauncherOnMobile: updatedConfig.hideLauncherOnMobile,
      launcherIconBorderRadius: updatedConfig.launcherIconBorderRadius,
      launcherIconPulseGlow: updatedConfig.launcherIconPulseGlow,
      showLauncherText: updatedConfig.showLauncherText,
      launcherTextBackgroundColor: updatedConfig.launcherTextBackgroundColor,
      launcherTextColor: updatedConfig.launcherTextColor,
      preChatForm: updatedConfig.preChatForm as WidgetConfigResponse["preChatForm"],
      embedCode: generateEmbedCode(company.slug),
      createdAt: updatedConfig.createdAt.toISOString(),
      updatedAt: updatedConfig.updatedAt.toISOString(),
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
