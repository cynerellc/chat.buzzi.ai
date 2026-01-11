"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  UserCheck,
  Plus,
} from "lucide-react";
import { ChatWindow } from "@/app/embed-widget/components/ChatWindow";
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

const PLACEMENT_OPTIONS = [
  { value: "above-launcher", label: "Above launcher icon" },
  { value: "center-screen", label: "Center screen" },
];

const LAUNCHER_ICONS = [
  { value: "chat", label: "Chat Bubble", Icon: MessageCircle },
  { value: "message", label: "Message", Icon: MessageSquare },
  { value: "help", label: "Help", Icon: HelpCircle },
  { value: "sparkle", label: "Sparkle", Icon: Sparkles },
];

interface WidgetConfig {
  id: string;
  chatbotId: string;
  theme: string;
  position: string;
  placement: string;
  primaryColor: string;
  accentColor: string;
  userBubbleColor: string | null;
  overrideAgentColor: boolean;
  agentBubbleColor: string | null;
  borderRadius: string;
  buttonSize: string;
  title: string;
  subtitle: string | null;
  welcomeMessage: string;
  placeholderText: string | null;
  logoUrl: string | null;
  avatarUrl: string | null;
  autoOpen: boolean;
  autoOpenDelay: string;
  showBranding: boolean;
  playSoundOnMessage: boolean;
  persistConversation: boolean;
  enableFileUpload: boolean;
  enableVoiceMessages: boolean;
  enableFeedback: boolean;
  requireEmail: boolean;
  requireName: boolean;
  customCss: string | null;
  allowedDomains: string[];
  zIndex: string;
  launcherIcon: string;
  launcherText: string | null;
  hideLauncherOnMobile: boolean;
  launcherIconBorderRadius: string;
  launcherIconPulseGlow: boolean;
  showLauncherText: boolean;
  launcherTextBackgroundColor: string;
  launcherTextColor: string;
  // Stream Display Options
  showAgentSwitchNotification: boolean;
  showThinking: boolean;
  showInstantUpdates: boolean;
  // Multi-agent Display Options
  showAgentListOnTop: boolean;
  agentListMinCards: string;
  agentListingType: string;
  embedCode: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

// Chatbot type for escalation settings
interface ChatbotData {
  escalationEnabled?: boolean;
  behavior?: {
    maxTurnsBeforeEscalation?: number;
    autoEscalateOnSentiment?: boolean;
    sentimentThreshold?: number;
    escalationRoutingRule?: "round_robin" | "least_busy" | "preferred";
    escalationPreferredAgentId?: string;
    escalationRules?: string[];
  } | null;
}

// Support agent type for dropdown
interface SupportAgent {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
}

// Routing rule options
const ROUTING_RULE_OPTIONS = [
  { value: "least_busy", label: "Least Busy (Recommended)" },
  { value: "round_robin", label: "Round Robin" },
  { value: "preferred", label: "Preferred Agent" },
];

// Escalation rule suggestions
const ESCALATION_RULE_SUGGESTIONS = [
  "When user expresses frustration or anger",
  "When user explicitly requests a human agent",
  "When user asks the same question 3 or more times",
  "When conversation contains keywords: refund, cancel, lawsuit",
  "When user mentions a complaint or legal action",
  "When the AI agent cannot answer the question",
  "When user has been waiting for more than 5 minutes",
];

interface WidgetSettingsProps {
  chatbotId: string;
  chatbotName?: string;
  companyId: string;
  apiUrl: string;
  chatbotApiUrl?: string;
  isMultiAgent?: boolean;
  chatbot?: ChatbotData | null;
  onChatbotRefresh?: () => void;
}

export function WidgetSettings({
  chatbotId,
  chatbotName,
  companyId,
  apiUrl,
  chatbotApiUrl,
  isMultiAgent = false,
  chatbot,
  onChatbotRefresh,
}: WidgetSettingsProps) {
  const { data, isLoading, mutate } = useSWR<{ config: WidgetConfig }>(apiUrl, fetcher);

  // Fetch support agents for preferred agent dropdown
  const { data: supportAgentsData } = useSWR<{ agents: SupportAgent[] }>(
    "/api/company/support-agents",
    fetcher
  );
  const supportAgents = supportAgentsData?.agents ?? [];

  const config = data?.config;
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Logo upload state
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Escalation settings state
  const [escalationFormData, setEscalationFormData] = useState({
    escalationEnabled: false,
    escalationRoutingRule: "least_busy" as "round_robin" | "least_busy" | "preferred",
    escalationPreferredAgentId: "",
    escalationRules: [] as string[],
    maxTurnsBeforeEscalation: 5,
    autoEscalateOnSentiment: false,
    sentimentThreshold: 30,
  });

  // New escalation rule input state
  const [newEscalationRule, setNewEscalationRule] = useState("");
  const [showRuleSuggestions, setShowRuleSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    theme: "light",
    position: "bottom-right",
    placement: "above-launcher",
    primaryColor: "#6437F3",
    accentColor: "#2b3dd8",
    userBubbleColor: "",
    overrideAgentColor: false,
    agentBubbleColor: "#FFFFFF",
    borderRadius: "16",
    buttonSize: "60",
    title: "Chat with us",
    subtitle: "",
    welcomeMessage: "Hi there! How can we help you today?",
    placeholderText: "Type a message...",
    logoUrl: "",
    avatarUrl: "",
    autoOpen: false,
    autoOpenDelay: "5",
    showBranding: true,
    playSoundOnMessage: true,
    persistConversation: true,
    enableFileUpload: false,
    enableVoiceMessages: false,
    enableFeedback: true,
    requireEmail: false,
    requireName: false,
    customCss: "",
    allowedDomains: [] as string[],
    zIndex: "9999",
    launcherIcon: "chat",
    launcherText: "",
    hideLauncherOnMobile: false,
    launcherIconBorderRadius: "50",
    launcherIconPulseGlow: false,
    showLauncherText: false,
    launcherTextBackgroundColor: "#ffffff",
    launcherTextColor: "#000000",
    // Stream Display Options
    showAgentSwitchNotification: true,
    showThinking: false,
    showInstantUpdates: true,
    // Multi-agent Display Options
    showAgentListOnTop: true,
    agentListMinCards: "3",
    agentListingType: "detailed",
  });

  useEffect(() => {
    if (config) {
      setFormData({
        theme: config.theme,
        position: config.position,
        placement: config.placement || "above-launcher",
        primaryColor: config.primaryColor,
        accentColor: config.accentColor,
        userBubbleColor: config.userBubbleColor || "",
        overrideAgentColor: config.overrideAgentColor ?? false,
        agentBubbleColor: config.agentBubbleColor || "#FFFFFF",
        borderRadius: config.borderRadius,
        buttonSize: config.buttonSize,
        title: config.title,
        subtitle: config.subtitle || "",
        welcomeMessage: config.welcomeMessage,
        placeholderText: config.placeholderText || "Type a message...",
        logoUrl: config.logoUrl || "",
        avatarUrl: config.avatarUrl || "",
        autoOpen: config.autoOpen,
        autoOpenDelay: config.autoOpenDelay,
        showBranding: config.showBranding,
        playSoundOnMessage: config.playSoundOnMessage,
        persistConversation: config.persistConversation,
        enableFileUpload: config.enableFileUpload,
        enableVoiceMessages: config.enableVoiceMessages,
        enableFeedback: config.enableFeedback,
        requireEmail: config.requireEmail,
        requireName: config.requireName,
        customCss: config.customCss || "",
        allowedDomains: config.allowedDomains,
        zIndex: config.zIndex,
        launcherIcon: config.launcherIcon,
        launcherText: config.launcherText || "",
        hideLauncherOnMobile: config.hideLauncherOnMobile,
        launcherIconBorderRadius: config.launcherIconBorderRadius || "50",
        launcherIconPulseGlow: config.launcherIconPulseGlow ?? false,
        showLauncherText: config.showLauncherText ?? false,
        launcherTextBackgroundColor: config.launcherTextBackgroundColor || "#ffffff",
        launcherTextColor: config.launcherTextColor || "#000000",
        // Stream Display Options
        showAgentSwitchNotification: config.showAgentSwitchNotification ?? true,
        showThinking: config.showThinking ?? false,
        showInstantUpdates: config.showInstantUpdates ?? true,
        // Multi-agent Display Options
        showAgentListOnTop: config.showAgentListOnTop ?? true,
        agentListMinCards: config.agentListMinCards ?? "3",
        agentListingType: config.agentListingType ?? "detailed",
      });
    }
  }, [config]);

  // Sync escalation settings from chatbot prop
  useEffect(() => {
    if (chatbot) {
      const behavior = chatbot.behavior;
      setEscalationFormData({
        escalationEnabled: chatbot.escalationEnabled ?? false,
        escalationRoutingRule: behavior?.escalationRoutingRule ?? "least_busy",
        escalationPreferredAgentId: behavior?.escalationPreferredAgentId ?? "",
        escalationRules: behavior?.escalationRules ?? [],
        maxTurnsBeforeEscalation: behavior?.maxTurnsBeforeEscalation ?? 5,
        autoEscalateOnSentiment: behavior?.autoEscalateOnSentiment ?? false,
        sentimentThreshold: behavior?.sentimentThreshold ?? 30,
      });
    }
  }, [chatbot]);

  const updateField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateEscalationField = <K extends keyof typeof escalationFormData>(
    key: K,
    value: (typeof escalationFormData)[K]
  ) => {
    setEscalationFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Add escalation rule
  const addEscalationRule = (rule: string) => {
    const trimmedRule = rule.trim();
    if (trimmedRule && !escalationFormData.escalationRules.includes(trimmedRule)) {
      updateEscalationField("escalationRules", [...escalationFormData.escalationRules, trimmedRule]);
    }
    setNewEscalationRule("");
    setShowRuleSuggestions(false);
  };

  // Remove escalation rule
  const removeEscalationRule = (ruleToRemove: string) => {
    updateEscalationField(
      "escalationRules",
      escalationFormData.escalationRules.filter((rule) => rule !== ruleToRemove)
    );
  };

  // Get filtered suggestions based on input
  const filteredSuggestions = useMemo(() => {
    const input = newEscalationRule.toLowerCase();
    return ESCALATION_RULE_SUGGESTIONS.filter(
      (suggestion) =>
        suggestion.toLowerCase().includes(input) &&
        !escalationFormData.escalationRules.includes(suggestion)
    );
  }, [newEscalationRule, escalationFormData.escalationRules]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save widget config
      const widgetResponse = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          subtitle: formData.subtitle || null,
          placeholderText: formData.placeholderText || null,
          logoUrl: formData.logoUrl || null,
          avatarUrl: formData.avatarUrl || null,
          customCss: formData.customCss || null,
          launcherText: formData.launcherText || null,
        }),
      });

      if (!widgetResponse.ok) throw new Error("Failed to save widget settings");

      // Save escalation settings if chatbotApiUrl is provided
      if (chatbotApiUrl) {
        const escalationResponse = await fetch(chatbotApiUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            escalationEnabled: escalationFormData.escalationEnabled,
            behavior: {
              ...chatbot?.behavior,
              maxTurnsBeforeEscalation: escalationFormData.maxTurnsBeforeEscalation,
              autoEscalateOnSentiment: escalationFormData.autoEscalateOnSentiment,
              sentimentThreshold: escalationFormData.sentimentThreshold,
              escalationRoutingRule: escalationFormData.escalationRoutingRule,
              escalationPreferredAgentId: escalationFormData.escalationPreferredAgentId || null,
              escalationRules: escalationFormData.escalationRules,
            },
          }),
        });

        if (!escalationResponse.ok) throw new Error("Failed to save escalation settings");

        // Refresh chatbot data
        onChatbotRefresh?.();
      }

      addToast({ title: "Settings saved successfully", color: "success" });
      setHasChanges(false);
      mutate();
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "Failed to save settings",
        color: "danger",
      });
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

  // Build config JSON for the ChatWindow preview
  // For multi-agent preview, provide sample agents to demonstrate the UI
  const demoAgentsList = useMemo(() => {
    if (!isMultiAgent) return undefined;
    return [
      { id: "agent-1", name: "Sales Agent", designation: "Customer Support", type: "worker" },
      { id: "agent-2", name: "Tech Support", designation: "Technical Specialist", type: "worker" },
      { id: "agent-3", name: "Billing Agent", designation: "Billing Support", type: "worker" },
    ];
  }, [isMultiAgent]);

  const previewConfig = useMemo(() => ({
    agentId: chatbotId,
    companyId: companyId,
    theme: formData.theme as "light" | "dark" | "auto",
    primaryColor: formData.primaryColor,
    accentColor: formData.accentColor,
    userBubbleColor: formData.userBubbleColor || undefined,
    overrideAgentColor: formData.overrideAgentColor,
    agentBubbleColor: formData.agentBubbleColor || undefined,
    borderRadius: parseInt(formData.borderRadius, 10),
    position: formData.position as "bottom-right" | "bottom-left",
    placement: formData.placement as "above-launcher" | "center-screen",
    title: formData.title,
    subtitle: formData.subtitle || undefined,
    welcomeMessage: formData.welcomeMessage,
    placeholderText: formData.placeholderText || undefined,
    logoUrl: formData.logoUrl || undefined,
    avatarUrl: formData.avatarUrl || undefined,
    showBranding: formData.showBranding,
    enableFileUpload: formData.enableFileUpload,
    enableVoice: formData.enableVoiceMessages,
    enableMarkdown: true,
    isMultiAgent: isMultiAgent,
    agentsList: demoAgentsList,
    showAgentSwitchNotification: formData.showAgentSwitchNotification,
    showThinking: formData.showThinking,
    showInstantUpdates: formData.showInstantUpdates,
    showAgentListOnTop: formData.showAgentListOnTop,
    agentListMinCards: parseInt(formData.agentListMinCards, 10),
    agentListingType: formData.agentListingType as "minimal" | "compact" | "standard" | "detailed",
    autoOpen: formData.autoOpen,
    autoOpenDelay: parseInt(formData.autoOpenDelay, 10),
    playSoundOnMessage: formData.playSoundOnMessage,
    persistConversation: formData.persistConversation,
    requireEmail: formData.requireEmail,
    requireName: formData.requireName,
    customCss: formData.customCss || undefined,
  }), [chatbotId, companyId, formData, isMultiAgent, demoAgentsList]);

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

          <Select
            label="Placement"
            description="How the chat window appears on screen"
            options={PLACEMENT_OPTIONS}
            selectedKeys={new Set([formData.placement])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              updateField("placement", selected as string);
            }}
          />

          {/* Color Pickers as 40x40 squares */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Primary Color</label>
              <div className="flex items-center gap-3">
                <label
                  className="w-10 h-10 rounded-lg border border-divider cursor-pointer shadow-sm hover:scale-105 transition-transform"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => updateField("primaryColor", e.target.value)}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
                <Input
                  value={formData.primaryColor}
                  onValueChange={(v) => updateField("primaryColor", v)}
                  className="w-28 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Accent Color</label>
              <div className="flex items-center gap-3">
                <label
                  className="w-10 h-10 rounded-lg border border-divider cursor-pointer shadow-sm hover:scale-105 transition-transform"
                  style={{ backgroundColor: formData.accentColor }}
                >
                  <input
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => updateField("accentColor", e.target.value)}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
                <Input
                  value={formData.accentColor}
                  onValueChange={(v) => updateField("accentColor", v)}
                  className="w-28 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Chat Bubble Colors */}
          <div className="border-t border-divider pt-6">
            <h3 className="font-semibold mb-4">Chat Bubble Colors</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">User Bubble Color</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Background color for user messages (defaults to primary color if empty)
                </p>
                <div className="flex items-center gap-3">
                  <label
                    className="w-10 h-10 rounded-lg border border-divider cursor-pointer shadow-sm hover:scale-105 transition-transform"
                    style={{ backgroundColor: formData.userBubbleColor || formData.primaryColor }}
                  >
                    <input
                      type="color"
                      value={formData.userBubbleColor || formData.primaryColor}
                      onChange={(e) => updateField("userBubbleColor", e.target.value)}
                      className="opacity-0 w-0 h-0"
                    />
                  </label>
                  <Input
                    value={formData.userBubbleColor || formData.primaryColor}
                    onValueChange={(v) => updateField("userBubbleColor", v)}
                    className="w-28 font-mono text-sm"
                    maxLength={7}
                  />
                  {formData.userBubbleColor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => updateField("userBubbleColor", "")}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                <div>
                  <span className="font-medium">Override Agent Colors</span>
                  <p className="text-sm text-muted-foreground">
                    Use a single color for all agent messages instead of individual agent colors
                  </p>
                </div>
                <Switch
                  isSelected={formData.overrideAgentColor}
                  onValueChange={(v) => updateField("overrideAgentColor", v)}
                />
              </div>

              {formData.overrideAgentColor && (
                <div>
                  <label className="text-sm font-medium block mb-2">Agent Bubble Color</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Background color for all agent messages when override is enabled
                  </p>
                  <div className="flex items-center gap-3">
                    <label
                      className="w-10 h-10 rounded-lg border border-divider cursor-pointer shadow-sm hover:scale-105 transition-transform"
                      style={{ backgroundColor: formData.agentBubbleColor }}
                    >
                      <input
                        type="color"
                        value={formData.agentBubbleColor}
                        onChange={(e) => updateField("agentBubbleColor", e.target.value)}
                        className="opacity-0 w-0 h-0"
                      />
                    </label>
                    <Input
                      value={formData.agentBubbleColor}
                      onValueChange={(v) => updateField("agentBubbleColor", v)}
                      className="w-28 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              )}
            </div>
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

          {/* Launcher Icon Selection as clickable buttons */}
          <div>
            <label className="text-sm font-medium block mb-2">Launcher Icon</label>
            <div className="flex gap-2">
              {LAUNCHER_ICONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField("launcherIcon", value)}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                    formData.launcherIcon === value
                      ? "border-primary bg-primary/10"
                      : "border-divider hover:border-primary/50"
                  }`}
                  title={label}
                >
                  <Icon className={`w-5 h-5 ${formData.launcherIcon === value ? "text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Launcher Icon Border Radius: {formData.launcherIconBorderRadius}%</label>
            <Slider
              aria-label="Launcher icon border radius"
              value={[parseInt(formData.launcherIconBorderRadius)]}
              onValueChange={(v) => updateField("launcherIconBorderRadius", String(v[0]))}
              min={0}
              max={50}
              step={5}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Launcher pulse glow</span>
              <p className="text-sm text-muted-foreground">
                Add a subtle pulsing glow animation to attract attention
              </p>
            </div>
            <Switch
              isSelected={formData.launcherIconPulseGlow}
              onValueChange={(v) => updateField("launcherIconPulseGlow", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Show launcher text</span>
              <p className="text-sm text-muted-foreground">
                Display text next to the launcher button
              </p>
            </div>
            <Switch
              isSelected={formData.showLauncherText}
              onValueChange={(v) => updateField("showLauncherText", v)}
            />
          </div>

          {formData.showLauncherText && (
            <>
              <Input
                label="Launcher Text"
                placeholder="e.g., Need help?"
                value={formData.launcherText}
                onValueChange={(v) => updateField("launcherText", v)}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Text Background</label>
                  <div className="flex items-center gap-3">
                    <label
                      className="w-10 h-10 rounded-lg border border-divider cursor-pointer shadow-sm hover:scale-105 transition-transform"
                      style={{ backgroundColor: formData.launcherTextBackgroundColor }}
                    >
                      <input
                        type="color"
                        value={formData.launcherTextBackgroundColor}
                        onChange={(e) => updateField("launcherTextBackgroundColor", e.target.value)}
                        className="opacity-0 w-0 h-0"
                      />
                    </label>
                    <Input
                      value={formData.launcherTextBackgroundColor}
                      onValueChange={(v) => updateField("launcherTextBackgroundColor", v)}
                      className="w-24 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Text Color</label>
                  <div className="flex items-center gap-3">
                    <label
                      className="w-10 h-10 rounded-lg border border-divider cursor-pointer shadow-sm hover:scale-105 transition-transform"
                      style={{ backgroundColor: formData.launcherTextColor }}
                    >
                      <input
                        type="color"
                        value={formData.launcherTextColor}
                        onChange={(e) => updateField("launcherTextColor", e.target.value)}
                        className="opacity-0 w-0 h-0"
                      />
                    </label>
                    <Input
                      value={formData.launcherTextColor}
                      onValueChange={(v) => updateField("launcherTextColor", v)}
                      className="w-24 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
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

          <Textarea
            label="Welcome Message"
            value={formData.welcomeMessage}
            onValueChange={(v) => updateField("welcomeMessage", v)}
            minRows={2}
            description="First message shown when chat opens"
          />

          <Input
            label="Input Placeholder"
            placeholder="e.g., Type your question..."
            value={formData.placeholderText}
            onValueChange={(v) => updateField("placeholderText", v)}
            description="Placeholder text shown in the message input"
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

          {/* Stream Display Options - moved from Features */}
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
        </div>
      ),
    },
    {
      key: "human-escalation",
      label: "Human Escalation",
      icon: UserCheck,
      content: (
        <div className="space-y-6 p-6">
          {/* Enable Human Escalation */}
          <div className="flex items-center justify-between rounded-lg border border-divider p-4">
            <div>
              <span className="font-medium">Enable Human Escalation</span>
              <p className="text-sm text-muted-foreground">
                Allow conversations to be escalated to human agents
              </p>
            </div>
            <Switch
              isSelected={escalationFormData.escalationEnabled}
              onValueChange={(v) => updateEscalationField("escalationEnabled", v)}
            />
          </div>

          {escalationFormData.escalationEnabled && (
            <>
              {/* Routing Rules Section */}
              <div className="border-t border-divider pt-6">
                <h3 className="font-semibold mb-4">Routing Rules</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  How should escalations be routed to human agents?
                </p>

                <Select
                  label="Routing Rule"
                  options={ROUTING_RULE_OPTIONS}
                  selectedKeys={new Set([escalationFormData.escalationRoutingRule])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as "round_robin" | "least_busy" | "preferred";
                    updateEscalationField("escalationRoutingRule", selected);
                  }}
                />

                {escalationFormData.escalationRoutingRule === "preferred" && (
                  <div className="mt-4">
                    <Select
                      label="Preferred Agent"
                      description="Select the support agent to always route escalations to"
                      options={supportAgents.map((agent) => ({
                        value: agent.id,
                        label: `${agent.name || agent.email} (${agent.role.replace("chatapp.", "")})`,
                      }))}
                      selectedKeys={
                        escalationFormData.escalationPreferredAgentId
                          ? new Set([escalationFormData.escalationPreferredAgentId])
                          : new Set()
                      }
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        updateEscalationField("escalationPreferredAgentId", selected || "");
                      }}
                      placeholder="Select agent..."
                    />
                    {supportAgents.length === 0 && (
                      <p className="text-sm text-warning-600 mt-2">
                        No support agents found. Add team members with support agent or company admin roles.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Automatic Escalation Triggers */}
              <div className="border-t border-divider pt-6">
                <h3 className="font-semibold mb-4">Automatic Escalation Triggers</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure when conversations should automatically escalate to human agents.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium">
                      Escalate after {escalationFormData.maxTurnsBeforeEscalation} conversation turns
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Automatically escalate if the conversation exceeds this many exchanges
                    </p>
                    <Slider
                      aria-label="Max turns before escalation"
                      value={[escalationFormData.maxTurnsBeforeEscalation]}
                      onValueChange={(v) => updateEscalationField("maxTurnsBeforeEscalation", v[0] ?? 5)}
                      min={3}
                      max={20}
                      step={1}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-divider p-4">
                    <div>
                      <span className="font-medium">Auto-escalate on negative sentiment</span>
                      <p className="text-sm text-muted-foreground">
                        Escalate when user expresses frustration or negative emotions
                      </p>
                    </div>
                    <Switch
                      isSelected={escalationFormData.autoEscalateOnSentiment}
                      onValueChange={(v) => updateEscalationField("autoEscalateOnSentiment", v)}
                    />
                  </div>

                  {escalationFormData.autoEscalateOnSentiment && (
                    <div>
                      <label className="text-sm font-medium">
                        Sentiment threshold: {escalationFormData.sentimentThreshold}%
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Escalate when negative sentiment score exceeds this threshold
                      </p>
                      <Slider
                        aria-label="Sentiment threshold"
                        value={[escalationFormData.sentimentThreshold]}
                        onValueChange={(v) => updateEscalationField("sentimentThreshold", v[0] ?? 30)}
                        min={10}
                        max={80}
                        step={5}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Escalation Rules */}
              <div className="border-t border-divider pt-6">
                <h3 className="font-semibold mb-4">Custom Escalation Rules</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Define custom rules for when to escalate. The AI will interpret these rules during conversations.
                </p>

                {/* Current Rules */}
                {escalationFormData.escalationRules.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {escalationFormData.escalationRules.map((rule, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm">{rule}</span>
                        <button
                          type="button"
                          onClick={() => removeEscalationRule(rule)}
                          className="text-muted-foreground hover:text-danger transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Rule */}
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a rule or select from suggestions..."
                      value={newEscalationRule}
                      onValueChange={(v) => {
                        setNewEscalationRule(v);
                        setShowRuleSuggestions(true);
                      }}
                      onFocus={() => setShowRuleSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newEscalationRule.trim()) {
                          e.preventDefault();
                          addEscalationRule(newEscalationRule);
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onPress={() => addEscalationRule(newEscalationRule)}
                      disabled={!newEscalationRule.trim()}
                      startContent={<Plus size={16} />}
                    >
                      Add
                    </Button>
                  </div>

                  {/* Suggestions Dropdown */}
                  {showRuleSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-divider rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => addEscalationRule(suggestion)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Press Enter or click Add to create a custom rule. Click suggestions to add them.
                </p>
              </div>
            </>
          )}
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

                {formData.showAgentListOnTop && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Agents listing type</label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Choose how agents are displayed at the top of the widget
                      </p>
                    </div>

                    {/* 4 Clickable preview cards in 2x2 grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Minimal */}
                      <div
                        onClick={() => updateField("agentListingType", "minimal")}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                          formData.agentListingType === "minimal"
                            ? "border-primary bg-primary/5"
                            : "border-divider hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-sm">Minimal</p>
                        <p className="text-xs text-muted-foreground mb-2">Agent Name only</p>
                        <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                          <div>
                            <p className="text-xs font-medium">Agent Name</p>
                          </div>
                        </div>
                      </div>

                      {/* Compact */}
                      <div
                        onClick={() => updateField("agentListingType", "compact")}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                          formData.agentListingType === "compact"
                            ? "border-primary bg-primary/5"
                            : "border-divider hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-sm">Compact</p>
                        <p className="text-xs text-muted-foreground mb-2">Name + Designation</p>
                        <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                          <div>
                            <p className="text-xs font-medium">Agent Name</p>
                            <p className="text-[10px] text-muted-foreground">Designation</p>
                          </div>
                        </div>
                      </div>

                      {/* Standard */}
                      <div
                        onClick={() => updateField("agentListingType", "standard")}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                          formData.agentListingType === "standard"
                            ? "border-primary bg-primary/5"
                            : "border-divider hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-sm">Standard</p>
                        <p className="text-xs text-muted-foreground mb-2">Avatar + Name</p>
                        <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                          <div
                            className="h-8 w-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: formData.primaryColor + "33" }}
                          />
                          <div>
                            <p className="text-xs font-medium">Agent Name</p>
                          </div>
                        </div>
                      </div>

                      {/* Detailed */}
                      <div
                        onClick={() => updateField("agentListingType", "detailed")}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                          formData.agentListingType === "detailed"
                            ? "border-primary bg-primary/5"
                            : "border-divider hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-sm">Detailed</p>
                        <p className="text-xs text-muted-foreground mb-2">Avatar + Name + Designation</p>
                        <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                          <div
                            className="h-8 w-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: formData.primaryColor + "33" }}
                          />
                          <div>
                            <p className="text-xs font-medium">Agent Name</p>
                            <p className="text-[10px] text-muted-foreground">Designation</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
              <h2 className="text-lg font-semibold">Live Widget Preview</h2>
            </CardHeader>
            <CardBody>
              <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-muted to-muted/50">
                {/* Chat Window Preview */}
                <div className="h-[480px]">
                  <ChatWindow
                    isDemo={true}
                    configJson={previewConfig}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Launcher Preview */}
              <div className="mt-4 pt-4 border-t border-divider">
                <p className="text-sm text-muted-foreground mb-3">Launcher Preview</p>
                <div className="flex items-center justify-end gap-2 bg-gradient-to-br from-muted to-muted/50 p-4 rounded-lg">
                  {/* Launcher Text */}
                  {formData.showLauncherText && formData.launcherText && (
                    <div
                      className="px-3 py-2 rounded-lg text-sm font-medium shadow-lg"
                      style={{
                        backgroundColor: formData.launcherTextBackgroundColor,
                        color: formData.launcherTextColor,
                        borderRadius: `${Math.min(parseInt(formData.borderRadius, 10), 16)}px`,
                      }}
                    >
                      {formData.launcherText}
                    </div>
                  )}
                  {/* Launcher Button */}
                  <button
                    className="relative flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
                    style={{
                      width: `${formData.buttonSize}px`,
                      height: `${formData.buttonSize}px`,
                      backgroundColor: formData.primaryColor,
                      borderRadius: `${formData.launcherIconBorderRadius}%`,
                      boxShadow: formData.launcherIconPulseGlow
                        ? `0 0 20px ${formData.primaryColor}80`
                        : undefined,
                    }}
                  >
                    {formData.launcherIcon === "chat" && <MessageCircle size={24} />}
                    {formData.launcherIcon === "message" && <MessageSquare size={24} />}
                    {formData.launcherIcon === "help" && <HelpCircle size={24} />}
                    {formData.launcherIcon === "sparkle" && <Sparkles size={24} />}
                    {formData.launcherIconPulseGlow && (
                      <span
                        className="absolute inset-0 animate-ping opacity-30"
                        style={{
                          backgroundColor: formData.primaryColor,
                          borderRadius: `${formData.launcherIconBorderRadius}%`,
                        }}
                      />
                    )}
                  </button>
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
