"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Upload,
  X,
} from "lucide-react";
import { Switch, Slider, Textarea, addToast, Modal, ModalContent, ModalHeader, ModalBody } from "@/components/ui";

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
import { ImageCropper, type CropData } from "@/components/shared/image-cropper";

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
  // Stream Display Options
  showAgentSwitchNotification: boolean;
  showThinking: boolean;
  showToolCalls: boolean;
  showInstantUpdates: boolean;
  // Multi-agent Display Options
  showAgentListOnTop: boolean;
  embedCode: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

interface WidgetSettingsProps {
  chatbotId: string;
  chatbotName?: string;
  companyId: string;
  apiUrl: string;
  isMultiAgent?: boolean;
}

export function WidgetSettings({ chatbotId, chatbotName, companyId, apiUrl, isMultiAgent = false }: WidgetSettingsProps) {
  const { data, isLoading, mutate } = useSWR<{ config: WidgetConfig }>(apiUrl, fetcher);

  const config = data?.config;
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Logo upload state
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    theme: "light",
    position: "bottom-right",
    primaryColor: "#6437F3",
    accentColor: "#2b3dd8",
    borderRadius: "16",
    buttonSize: "60",
    title: "Chat with us",
    subtitle: "",
    welcomeMessage: "Hi there! How can we help you today?",
    offlineMessage: "We're currently offline. Leave a message and we'll get back to you.",
    logoUrl: "",
    companyName: "",
    autoOpen: false,
    autoOpenDelay: "5",
    showBranding: true,
    playSoundOnMessage: true,
    showTypingIndicator: true,
    persistConversation: true,
    enableFileUpload: false,
    enableVoiceMessages: false,
    enableEmoji: true,
    enableFeedback: true,
    requireEmail: false,
    requireName: false,
    customCss: "",
    allowedDomains: [] as string[],
    blockedDomains: [] as string[],
    zIndex: "9999",
    launcherIcon: "chat",
    launcherText: "",
    hideLauncherOnMobile: false,
    // Stream Display Options
    showAgentSwitchNotification: true,
    showThinking: false,
    showToolCalls: false,
    showInstantUpdates: true,
    // Multi-agent Display Options
    showAgentListOnTop: true,
  });

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
        // Stream Display Options
        showAgentSwitchNotification: config.showAgentSwitchNotification ?? true,
        showThinking: config.showThinking ?? false,
        showToolCalls: config.showToolCalls ?? false,
        showInstantUpdates: config.showInstantUpdates ?? true,
        // Multi-agent Display Options
        showAgentListOnTop: config.showAgentListOnTop ?? true,
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
      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          subtitle: formData.subtitle || null,
          offlineMessage: formData.offlineMessage || null,
          logoUrl: formData.logoUrl || null,
          companyName: formData.companyName || null,
          customCss: formData.customCss || null,
          launcherText: formData.launcherText || null,
        }),
      });

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
    if (companyId && chatbotId) {
      const testUrl = `/preview/widget?chatbotId=${chatbotId}&companyId=${companyId}`;
      window.open(testUrl, "_blank");
    }
  };

  // Logo upload handlers
  const handleLogoFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      addToast({ title: "Invalid file type. Use JPEG, PNG, GIF, or WebP", color: "danger" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: "File too large. Maximum size is 5MB", color: "danger" });
      return;
    }

    // Create data URL for cropper
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setShowCropperModal(true);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    event.target.value = "";
  }, []);

  const handleCropComplete = useCallback(async (cropData: CropData) => {
    if (!selectedImage) return;

    setIsUploadingLogo(true);
    try {
      // Create a canvas to crop the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = selectedImage;
      });

      // Set canvas size to crop size
      canvas.width = cropData.width;
      canvas.height = cropData.height;

      // Draw cropped portion
      ctx.drawImage(
        img,
        cropData.x,
        cropData.y,
        cropData.width,
        cropData.height,
        0,
        0,
        cropData.width,
        cropData.height
      );

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          },
          "image/png",
          0.9
        );
      });

      // Upload to server
      const formData = new FormData();
      formData.append("file", blob, "logo.png");

      const response = await fetch("/api/company/logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload logo");
      }

      const result = await response.json();

      // Update the logo URL in form data
      updateField("logoUrl", result.logoUrl);
      addToast({ title: "Logo uploaded successfully", color: "success" });
      setShowCropperModal(false);
      setSelectedImage(null);
    } catch (error) {
      console.error("Logo upload error:", error);
      addToast({ title: error instanceof Error ? error.message : "Failed to upload logo", color: "danger" });
    } finally {
      setIsUploadingLogo(false);
    }
  }, [selectedImage, updateField]);

  const handleCropCancel = useCallback(() => {
    setShowCropperModal(false);
    setSelectedImage(null);
  }, []);

  const handleRemoveLogo = useCallback(() => {
    updateField("logoUrl", "");
    setHasChanges(true);
  }, [updateField]);

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

          <div className="space-y-2">
            <label className="text-sm font-medium">Company Logo</label>
            <p className="text-sm text-muted-foreground mb-2">
              Logo shown in widget header (recommended: square, at least 100x100px)
            </p>

            {formData.logoUrl ? (
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-lg border border-divider bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${formData.logoUrl})` }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => logoInputRef.current?.click()}
                    startContent={<Upload size={14} />}
                  >
                    Change
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handleRemoveLogo}
                    startContent={<X size={14} />}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => logoInputRef.current?.click()}
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-divider rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload logo</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF, WebP (max 5MB)</span>
              </div>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleLogoFileSelect}
              className="hidden"
            />
          </div>
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
              <p className="text-sm text-muted-foreground">Display Buzzi branding in the widget</p>
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
              <p className="text-sm text-muted-foreground">Allow users to send emoji in messages</p>
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

          <div className="border-t border-divider pt-6">
            <h3 className="font-semibold mb-4">Stream Display Options</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Control what information is shown to users while the AI is generating responses.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Show instant updates</span>
                  <p className="text-sm text-muted-foreground">
                    Update response in real-time as it streams
                  </p>
                </div>
                <Switch
                  isSelected={formData.showInstantUpdates}
                  onValueChange={(v) => updateField("showInstantUpdates", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Show thinking process</span>
                  <p className="text-sm text-muted-foreground">
                    Display what the AI is thinking about while generating
                  </p>
                </div>
                <Switch
                  isSelected={formData.showThinking}
                  onValueChange={(v) => updateField("showThinking", v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Show tool calls</span>
                  <p className="text-sm text-muted-foreground">
                    Display when AI uses tools like search or calculations
                  </p>
                </div>
                <Switch
                  isSelected={formData.showToolCalls}
                  onValueChange={(v) => updateField("showToolCalls", v)}
                  isDisabled={!formData.showThinking}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Show agent transfer notifications</span>
                  <p className="text-sm text-muted-foreground">
                    Notify when conversation is transferred to another agent
                  </p>
                </div>
                <Switch
                  isSelected={formData.showAgentSwitchNotification}
                  onValueChange={(v) => updateField("showAgentSwitchNotification", v)}
                />
              </div>
            </div>
          </div>

          {isMultiAgent && (
            <div className="border-t border-divider pt-6">
              <h3 className="font-semibold mb-4">Multi-Agent Display</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure how multiple agents are displayed in the widget.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                  <div>
                    <span className="font-medium">Show agent list at top</span>
                    <p className="text-sm text-muted-foreground">
                      Display horizontal list of available agents at the top of the widget
                    </p>
                  </div>
                  <Switch
                    isSelected={formData.showAgentListOnTop}
                    onValueChange={(v) => updateField("showAgentListOnTop", v)}
                  />
                </div>
              </div>
            </div>
          )}
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
              Domain restrictions allow you to control where your widget can be embedded. Leave
              empty to allow all domains.
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Widget Customization</h2>
          <p className="text-sm text-muted-foreground">
            Customize how the chat widget looks and behaves for {chatbotName}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && <Badge variant="warning">Unsaved changes</Badge>}
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
        <div className="lg:col-span-2">
          <Card>
            <CardBody className="p-0">
              <Tabs items={tabItems} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Preview</h2>
            </CardHeader>
            <CardBody>
              <div
                className="relative bg-gradient-to-br from-muted to-muted/50 rounded-lg p-4 min-h-[400px] flex items-end"
                style={{
                  justifyContent: formData.position === "bottom-right" ? "flex-end" : "flex-start",
                }}
              >
                <div className="space-y-3">
                  <div
                    className="bg-white dark:bg-muted shadow-lg w-[280px]"
                    style={{
                      borderRadius: `${formData.borderRadius}px`,
                      overflow: "hidden",
                    }}
                  >
                    <div className="p-3 text-white" style={{ backgroundColor: formData.primaryColor }}>
                      <div className="flex items-center gap-2">
                        {formData.logoUrl ? (
                          <div
                            className="w-8 h-8 rounded-full bg-white/20 bg-cover bg-center"
                            style={{ backgroundImage: `url(${formData.logoUrl})` }}
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

                    <div className="p-3 min-h-[150px] bg-muted/50">
                      <div
                        className="inline-block text-white text-sm p-2 max-w-[200px]"
                        style={{
                          backgroundColor: formData.primaryColor,
                          borderRadius: `${Math.min(parseInt(formData.borderRadius), 16)}px`,
                        }}
                      >
                        {formData.welcomeMessage}
                      </div>
                    </div>

                    <div className="p-3 border-t border-divider">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full px-3 py-2 text-sm text-muted-foreground">
                          Type a message...
                        </div>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: formData.accentColor }}
                        >
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {formData.showBranding && (
                      <div className="text-center py-2 text-xs text-muted-foreground border-t border-divider">
                        Powered by Buzzi
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-2"
                    style={{
                      justifyContent:
                        formData.position === "bottom-right" ? "flex-end" : "flex-start",
                    }}
                  >
                    {formData.launcherText && (
                      <div
                        className="bg-white shadow-lg px-3 py-2 text-sm font-medium"
                        style={{
                          borderRadius: `${Math.min(parseInt(formData.borderRadius), 12)}px`,
                        }}
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
                        borderRadius: "50%",
                      }}
                    >
                      <LauncherIcon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Install Widget</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add this code snippet to your website, just before the closing{" "}
                <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag.
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
                  Check out our installation guides for popular platforms like WordPress, Shopify,
                  and more.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Logo Cropper Modal */}
      <Modal isOpen={showCropperModal} onClose={handleCropCancel} size="lg">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">Crop Logo</h3>
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedImage && (
              <div className="relative">
                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  </div>
                )}
                <ImageCropper
                  image={selectedImage}
                  onCropComplete={handleCropComplete}
                  onCancel={handleCropCancel}
                  aspectRatio={1}
                  cropShape="round"
                />
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
