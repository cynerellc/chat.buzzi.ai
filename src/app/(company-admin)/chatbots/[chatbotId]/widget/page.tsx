"use client";

import { useState, useEffect } from "react";
import {
  Palette,
  ImageIcon,
  Settings2,
  Zap,
  Code,
  Copy,
  Check,
  Loader2,
  MessageCircle,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Save,
  ExternalLink,
} from "lucide-react";
import { Switch, Slider, Textarea, addToast } from "@/components/ui";

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardBody,
  Select,
  Badge,
  Tabs,
  type TabItem,
} from "@/components/ui";
import useSWR from "swr";

import { useChatbotContext } from "../chatbot-context";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto (System)" },
];

const POSITION_OPTIONS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
];

const LAUNCHER_ICON_OPTIONS = [
  { value: "chat", label: "Chat Bubble" },
  { value: "message", label: "Message" },
  { value: "help", label: "Help" },
  { value: "sparkle", label: "Sparkle" },
];

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  chat: MessageCircle,
  message: MessageSquare,
  help: HelpCircle,
  sparkle: Sparkles,
};

interface WidgetConfig {
  id: string;
  chatbotId: string;
  theme: string;
  position: string;
  primaryColor: string;
  accentColor: string;
  borderRadius: string;
  buttonSize: string;
  title: string;
  subtitle: string | null;
  welcomeMessage: string;
  offlineMessage: string | null;
  logoUrl: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  autoOpen: boolean;
  autoOpenDelay: string;
  showBranding: boolean;
  playSoundOnMessage: boolean;
  showTypingIndicator: boolean;
  persistConversation: boolean;
  enableFileUpload: boolean;
  enableVoiceMessages: boolean;
  enableEmoji: boolean;
  enableFeedback: boolean;
  requireEmail: boolean;
  requireName: boolean;
  customCss: string | null;
  allowedDomains: string[];
  blockedDomains: string[];
  zIndex: string;
  launcherIcon: string;
  launcherText: string | null;
  hideLauncherOnMobile: boolean;
  embedCode: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function ChatbotWidgetPage() {
  const { chatbotId, chatbot } = useChatbotContext();

  const { data, isLoading, mutate } = useSWR<{ config: WidgetConfig }>(
    `/api/company/chatbots/${chatbotId}/widget`,
    fetcher
  );

  const config = data?.config;
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    // Appearance
    theme: "light",
    position: "bottom-right",
    primaryColor: "#6437F3",
    accentColor: "#2b3dd8",
    borderRadius: "16",
    buttonSize: "60",
    // Branding
    title: "Chat with us",
    subtitle: "",
    welcomeMessage: "Hi there! How can we help you today?",
    offlineMessage: "We're currently offline. Leave a message and we'll get back to you.",
    logoUrl: "",
    avatarUrl: "",
    companyName: "",
    // Behavior
    autoOpen: false,
    autoOpenDelay: "5",
    showBranding: true,
    playSoundOnMessage: true,
    showTypingIndicator: true,
    persistConversation: true,
    // Features
    enableFileUpload: false,
    enableVoiceMessages: false,
    enableEmoji: true,
    enableFeedback: true,
    requireEmail: false,
    requireName: false,
    // Advanced
    customCss: "",
    allowedDomains: [] as string[],
    blockedDomains: [] as string[],
    zIndex: "9999",
    // Launcher
    launcherIcon: "chat",
    launcherText: "",
    hideLauncherOnMobile: false,
  });

  // Initialize form with config
  useEffect(() => {
    if (config) {
      setFormData({
        theme: config.theme,
        position: config.position,
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        borderRadius: config.borderRadius,
        buttonSize: config.buttonSize,
        title: config.title,
        subtitle: config.subtitle || "",
        welcomeMessage: config.welcomeMessage,
        offlineMessage: config.offlineMessage || "",
        logoUrl: config.logoUrl || "",
        avatarUrl: config.avatarUrl || "",
        companyName: config.companyName || "",
        autoOpen: config.autoOpen,
        autoOpenDelay: config.autoOpenDelay,
        showBranding: config.showBranding,
        playSoundOnMessage: config.playSoundOnMessage,
        showTypingIndicator: config.showTypingIndicator,
        persistConversation: config.persistConversation,
        enableFileUpload: config.enableFileUpload,
        enableVoiceMessages: config.enableVoiceMessages,
        enableEmoji: config.enableEmoji,
        enableFeedback: config.enableFeedback,
        requireEmail: config.requireEmail,
        requireName: config.requireName,
        customCss: config.customCss || "",
        allowedDomains: config.allowedDomains,
        blockedDomains: config.blockedDomains,
        zIndex: config.zIndex,
        launcherIcon: config.launcherIcon,
        launcherText: config.launcherText || "",
        hideLauncherOnMobile: config.hideLauncherOnMobile,
      });
    }
  }, [config]);

  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/company/chatbots/${chatbotId}/widget`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            subtitle: formData.subtitle || null,
            offlineMessage: formData.offlineMessage || null,
            logoUrl: formData.logoUrl || null,
            avatarUrl: formData.avatarUrl || null,
            companyName: formData.companyName || null,
            customCss: formData.customCss || null,
            launcherText: formData.launcherText || null,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to save");

      addToast({ title: "Widget settings saved", color: "success" });
      setHasChanges(false);
      mutate();
    } catch {
      addToast({ title: "Failed to save widget settings", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const copyEmbedCode = async () => {
    if (config?.embedCode) {
      await navigator.clipboard.writeText(config.embedCode);
      setCopiedEmbed(true);
      addToast({ title: "Embed code copied to clipboard", color: "success" });
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  const openTestWidget = () => {
    if (chatbot?.companyId && chatbotId) {
      const testUrl = `/api/widget/test-page?chatbotId=${chatbotId}&companyId=${chatbot.companyId}`;
      window.open(testUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const LauncherIcon = ICON_COMPONENTS[formData.launcherIcon] || MessageCircle;

  const tabItems: TabItem[] = [
    {
      key: "appearance",
      label: "Appearance",
      icon: Palette,
      content: (
        <div className="space-y-6 p-6">
          <Select
            label="Theme"
            options={THEME_OPTIONS}
            selectedKeys={new Set([formData.theme])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              updateField("theme", selected as string);
            }}
          />

          <Select
            label="Position"
            options={POSITION_OPTIONS}
            selectedKeys={new Set([formData.position])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              updateField("position", selected as string);
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="color"
              label="Primary Color"
              value={formData.primaryColor}
              onValueChange={(v) => updateField("primaryColor", v)}
              className="h-10"
            />
            <Input
              type="color"
              label="Accent Color"
              value={formData.accentColor}
              onValueChange={(v) => updateField("accentColor", v)}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Border Radius: {formData.borderRadius}px</label>
            <Slider
              aria-label="Border radius"
              value={[parseInt(formData.borderRadius)]}
              onValueChange={(v) => updateField("borderRadius", String(v[0]))}
              min={0}
              max={32}
              step={4}
              className="mt-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Button Size: {formData.buttonSize}px</label>
            <Slider
              aria-label="Button size"
              value={[parseInt(formData.buttonSize)]}
              onValueChange={(v) => updateField("buttonSize", String(v[0]))}
              min={40}
              max={80}
              step={4}
              className="mt-2"
            />
          </div>

          <Select
            label="Launcher Icon"
            options={LAUNCHER_ICON_OPTIONS}
            selectedKeys={new Set([formData.launcherIcon])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              updateField("launcherIcon", selected as string);
            }}
          />

          <Input
            label="Launcher Text (Optional)"
            placeholder="e.g., Need help?"
            value={formData.launcherText}
            onValueChange={(v) => updateField("launcherText", v)}
            description="Show text next to the launcher button"
          />
        </div>
      ),
    },
    {
      key: "branding",
      label: "Branding",
      icon: ImageIcon,
      content: (
        <div className="space-y-6 p-6">
          <Input
            label="Widget Title"
            value={formData.title}
            onValueChange={(v) => updateField("title", v)}
            isRequired
          />

          <Input
            label="Subtitle"
            placeholder="e.g., We typically reply within minutes"
            value={formData.subtitle}
            onValueChange={(v) => updateField("subtitle", v)}
          />

          <Input
            label="Company Name"
            placeholder="Your company name"
            value={formData.companyName}
            onValueChange={(v) => updateField("companyName", v)}
          />

          <Textarea
            label="Welcome Message"
            value={formData.welcomeMessage}
            onValueChange={(v) => updateField("welcomeMessage", v)}
            minRows={2}
            description="First message shown when chat opens"
          />

          <Textarea
            label="Offline Message"
            value={formData.offlineMessage}
            onValueChange={(v) => updateField("offlineMessage", v)}
            minRows={2}
            description="Message shown when no agents are available"
          />

          <Input
            label="Logo URL"
            placeholder="https://..."
            value={formData.logoUrl}
            onValueChange={(v) => updateField("logoUrl", v)}
            description="Company logo shown in widget header"
          />

          <Input
            label="Avatar URL"
            placeholder="https://..."
            value={formData.avatarUrl}
            onValueChange={(v) => updateField("avatarUrl", v)}
            description="Default avatar for AI responses"
          />
        </div>
      ),
    },
    {
      key: "behavior",
      label: "Behavior",
      icon: Settings2,
      content: (
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Auto-open widget</span>
              <p className="text-sm text-muted-foreground">
                Automatically open the widget after a delay
              </p>
            </div>
            <Switch
              isSelected={formData.autoOpen}
              onValueChange={(v) => updateField("autoOpen", v)}
            />
          </div>

          {formData.autoOpen && (
            <Input
              type="number"
              label="Auto-open Delay (seconds)"
              value={formData.autoOpenDelay}
              onValueChange={(v) => updateField("autoOpenDelay", v)}
              min={1}
              max={60}
            />
          )}

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Show &quot;Powered by&quot; branding</span>
              <p className="text-sm text-muted-foreground">
                Display Buzzi branding in the widget
              </p>
            </div>
            <Switch
              isSelected={formData.showBranding}
              onValueChange={(v) => updateField("showBranding", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Play sound on new message</span>
              <p className="text-sm text-muted-foreground">
                Play a notification sound for new messages
              </p>
            </div>
            <Switch
              isSelected={formData.playSoundOnMessage}
              onValueChange={(v) => updateField("playSoundOnMessage", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Show typing indicator</span>
              <p className="text-sm text-muted-foreground">
                Show when the AI is generating a response
              </p>
            </div>
            <Switch
              isSelected={formData.showTypingIndicator}
              onValueChange={(v) => updateField("showTypingIndicator", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Persist conversation</span>
              <p className="text-sm text-muted-foreground">
                Remember conversation history between visits
              </p>
            </div>
            <Switch
              isSelected={formData.persistConversation}
              onValueChange={(v) => updateField("persistConversation", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Hide launcher on mobile</span>
              <p className="text-sm text-muted-foreground">
                Don&apos;t show the widget on mobile devices
              </p>
            </div>
            <Switch
              isSelected={formData.hideLauncherOnMobile}
              onValueChange={(v) => updateField("hideLauncherOnMobile", v)}
            />
          </div>
        </div>
      ),
    },
    {
      key: "features",
      label: "Features",
      icon: Zap,
      content: (
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Enable emoji picker</span>
              <p className="text-sm text-muted-foreground">
                Allow users to send emoji in messages
              </p>
            </div>
            <Switch
              isSelected={formData.enableEmoji}
              onValueChange={(v) => updateField("enableEmoji", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Enable feedback</span>
              <p className="text-sm text-muted-foreground">
                Allow users to rate responses as helpful or not
              </p>
            </div>
            <Switch
              isSelected={formData.enableFeedback}
              onValueChange={(v) => updateField("enableFeedback", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Enable file uploads</span>
                <Badge variant="warning">Coming Soon</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow users to attach files to messages
              </p>
            </div>
            <Switch
              isSelected={formData.enableFileUpload}
              onValueChange={(v) => updateField("enableFileUpload", v)}
              isDisabled
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Voice support (Push to talk)</span>
              <p className="text-sm text-muted-foreground">
                Allow users to send voice messages using push-to-talk
              </p>
            </div>
            <Switch
              isSelected={formData.enableVoiceMessages}
              onValueChange={(v) => updateField("enableVoiceMessages", v)}
            />
          </div>

          <div className="border-t border-divider pt-6">
            <h3 className="font-semibold mb-4">Pre-chat Requirements</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Require email</span>
                  <p className="text-sm text-muted-foreground">
                    Ask for email before starting a conversation
                  </p>
                </div>
                <Switch
                  isSelected={formData.requireEmail}
                  onValueChange={(v) => updateField("requireEmail", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Require name</span>
                  <p className="text-sm text-muted-foreground">
                    Ask for name before starting a conversation
                  </p>
                </div>
                <Switch
                  isSelected={formData.requireName}
                  onValueChange={(v) => updateField("requireName", v)}
                />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "advanced",
      label: "Advanced",
      icon: Code,
      content: (
        <div className="space-y-6 p-6">
          <Input
            type="number"
            label="Z-Index"
            value={formData.zIndex}
            onValueChange={(v) => updateField("zIndex", v)}
            description="Control the stacking order of the widget"
          />

          <Textarea
            label="Custom CSS"
            placeholder={`.buzzi-widget {\n  /* Your custom styles */\n}`}
            value={formData.customCss}
            onValueChange={(v) => updateField("customCss", v)}
            minRows={6}
            className="font-mono text-sm"
            description="Add custom CSS to style the widget"
          />

          <div className="rounded-lg bg-warning-50 border border-warning-200 p-4">
            <h4 className="font-medium text-warning-700 mb-2">Domain Restrictions</h4>
            <p className="text-sm text-warning-600">
              Domain restrictions allow you to control where your widget can be embedded.
              Leave empty to allow all domains.
            </p>
          </div>

          <Textarea
            label="Allowed Domains"
            placeholder="example.com&#10;*.example.com&#10;app.example.com"
            value={formData.allowedDomains.join("\n")}
            onValueChange={(v) => updateField("allowedDomains", v.split("\n").filter(Boolean))}
            minRows={3}
            className="font-mono text-sm"
            description="One domain per line. Leave empty to allow all domains."
          />

          <Textarea
            label="Blocked Domains"
            placeholder="spam.example.com&#10;test.example.com"
            value={formData.blockedDomains.join("\n")}
            onValueChange={(v) => updateField("blockedDomains", v.split("\n").filter(Boolean))}
            minRows={3}
            className="font-mono text-sm"
            description="Domains where the widget should never load"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Widget Customization</h2>
          <p className="text-sm text-muted-foreground">
            Customize how the chat widget looks and behaves for {chatbot?.name}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge variant="warning">Unsaved changes</Badge>
          )}
          <Button
            variant="outline"
            onPress={openTestWidget}
            startContent={<ExternalLink size={16} />}
          >
            Test Widget
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={isSaving}
            disabled={!hasChanges}
            startContent={<Save size={16} />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardBody className="p-0">
              <Tabs items={tabItems} />
            </CardBody>
          </Card>
        </div>

        {/* Preview & Install Panel */}
        <div className="space-y-6">
          {/* Preview */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Preview</h2>
            </CardHeader>
            <CardBody>
              <div
                className="relative bg-gradient-to-br from-muted to-muted/50 rounded-lg p-4 min-h-[400px] flex items-end"
                style={{ justifyContent: formData.position === "bottom-right" ? "flex-end" : "flex-start" }}
              >
                {/* Widget Preview */}
                <div className="space-y-3">
                  {/* Chat Window Preview */}
                  <div
                    className="bg-white dark:bg-muted shadow-lg w-[280px]"
                    style={{
                      borderRadius: `${formData.borderRadius}px`,
                      overflow: "hidden"
                    }}
                  >
                    {/* Header */}
                    <div
                      className="p-3 text-white"
                      style={{ backgroundColor: formData.primaryColor }}
                    >
                      <div className="flex items-center gap-2">
                        {formData.avatarUrl ? (
                          <div
                            className="w-8 h-8 rounded-full bg-white/20 bg-cover bg-center"
                            style={{ backgroundImage: `url(${formData.avatarUrl})` }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-sm">{formData.title}</div>
                          {formData.subtitle && (
                            <div className="text-xs opacity-80">{formData.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="p-3 min-h-[150px] bg-muted/50">
                      <div
                        className="inline-block text-white text-sm p-2 max-w-[200px]"
                        style={{
                          backgroundColor: formData.primaryColor,
                          borderRadius: `${Math.min(parseInt(formData.borderRadius), 16)}px`
                        }}
                      >
                        {formData.welcomeMessage}
                      </div>
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-divider">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full px-3 py-2 text-sm text-muted-foreground">
                          Type a message...
                        </div>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: formData.accentColor }}
                        >
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Branding */}
                    {formData.showBranding && (
                      <div className="text-center py-2 text-xs text-muted-foreground border-t border-divider">
                        Powered by Buzzi
                      </div>
                    )}
                  </div>

                  {/* Launcher Button */}
                  <div
                    className="flex items-center gap-2"
                    style={{ justifyContent: formData.position === "bottom-right" ? "flex-end" : "flex-start" }}
                  >
                    {formData.launcherText && (
                      <div
                        className="bg-white shadow-lg px-3 py-2 text-sm font-medium"
                        style={{ borderRadius: `${Math.min(parseInt(formData.borderRadius), 12)}px` }}
                      >
                        {formData.launcherText}
                      </div>
                    )}
                    <div
                      className="text-white shadow-lg flex items-center justify-center"
                      style={{
                        backgroundColor: formData.primaryColor,
                        width: `${formData.buttonSize}px`,
                        height: `${formData.buttonSize}px`,
                        borderRadius: "50%"
                      }}
                    >
                      <LauncherIcon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Install */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Install Widget</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add this code snippet to your website, just before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag.
              </p>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-[200px]">
                  <code>{config?.embedCode || "Loading..."}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onPress={copyEmbedCode}
                  leftIcon={copiedEmbed ? Check : Copy}
                >
                  {copiedEmbed ? "Copied!" : "Copy"}
                </Button>
              </div>

              <div className="rounded-lg bg-primary-50 border border-primary-200 p-4">
                <h4 className="font-medium text-primary-700 mb-2">Need help?</h4>
                <p className="text-sm text-primary-600">
                  Check out our installation guides for popular platforms like WordPress, Shopify, and more.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
