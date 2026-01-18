"use client";

import { Save, Trash2, Play, Square, Settings, Phone, Database } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

import { FormSection, FormFieldWrapper } from "@/components/shared";
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  addToast,
  ConfirmationDialog,
  Switch,
  Tabs,
  TagInput,
  Slider,
} from "@/components/ui";
import type { VoiceConfig } from "@/lib/db/schema/chatbots";
import type { ModelSettingsSchema } from "@/lib/db/schema";

// Call model type for the dropdown
export interface CallModel {
  id: string;
  provider: "openai" | "google" | "anthropic";
  modelId: string;
  displayName: string;
  description: string | null;
  settingsSchema: ModelSettingsSchema;
}

interface ChatbotData {
  name: string;
  description: string | null;
  status: string;
  enabledChat?: boolean;
  enabledCall?: boolean;
  // Call settings (master admin only)
  callModelId?: string | null;
  callAiProvider?: "OPENAI" | "GEMINI" | null;
  voiceConfig?: VoiceConfig;
  // Package-level feature flags (null if no package = show all options)
  packageEnabledChat?: boolean | null;
  packageEnabledCall?: boolean | null;
  // Settings (includes call system prompt and knowledge base config)
  settings?: {
    callSystemPrompt?: string;
    callKnowledgeBaseEnabled?: boolean;
    callKnowledgeCategories?: string[];
    callKnowledgeBaseThreshold?: number;
  };
}

interface GeneralSettingsProps {
  chatbot: ChatbotData | null;
  apiUrl: string;
  onRefresh: () => void;
  onDelete?: () => Promise<void>;
  isMasterAdmin?: boolean;
  callModels?: CallModel[];
  /** Base API URL for fetching categories (e.g., /api/master-admin/companies/{companyId} or /api/company) */
  categoriesApiBase?: string;
}

// Helper to get the current voice from voiceConfig based on provider
function getCurrentVoice(voiceConfig: VoiceConfig | undefined, provider: string | undefined): string | null {
  if (!voiceConfig || !provider) return null;
  if (provider === "openai") return voiceConfig.openai_voice || null;
  if (provider === "google") return voiceConfig.gemini_voice || null;
  return null;
}

// Helper to build voiceConfig from selected voice and model
function buildVoiceConfig(
  selectedVoice: string | null,
  selectedModel: CallModel | undefined,
  existingConfig: VoiceConfig | undefined
): VoiceConfig {
  if (!selectedVoice || !selectedModel) return existingConfig || {};

  const baseConfig = { ...existingConfig };

  if (selectedModel.provider === "openai") {
    baseConfig.openai_voice = selectedVoice as VoiceConfig["openai_voice"];
  } else if (selectedModel.provider === "google") {
    baseConfig.gemini_voice = selectedVoice as VoiceConfig["gemini_voice"];
  }

  return baseConfig;
}

export function GeneralSettings({
  chatbot,
  apiUrl,
  onRefresh,
  onDelete,
  isMasterAdmin,
  callModels,
  categoriesApiBase,
}: GeneralSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "draft" as "draft" | "active" | "paused" | "archived",
    enabledChat: true,
    enabledCall: false,
    callModelId: null as string | null,
    selectedVoice: null as string | null,
    callSystemPrompt: "",
    callKnowledgeBaseEnabled: false,
    callKnowledgeCategories: [] as string[],
    callKnowledgeBaseThreshold: 0.3,
  });

  // Available categories for TagInput
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);

  // Voice preview state
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (chatbot) {
      const currentVoice = getCurrentVoice(chatbot.voiceConfig, callModels?.find(m => m.id === chatbot.callModelId)?.provider);
      setFormData({
        name: chatbot.name,
        description: chatbot.description ?? "",
        status: chatbot.status as "draft" | "active" | "paused" | "archived",
        enabledChat: chatbot.enabledChat ?? true,
        enabledCall: chatbot.enabledCall ?? false,
        callModelId: chatbot.callModelId ?? null,
        selectedVoice: currentVoice,
        callSystemPrompt: chatbot.settings?.callSystemPrompt ?? "",
        callKnowledgeBaseEnabled: chatbot.settings?.callKnowledgeBaseEnabled ?? false,
        callKnowledgeCategories: chatbot.settings?.callKnowledgeCategories ?? [],
        callKnowledgeBaseThreshold: chatbot.settings?.callKnowledgeBaseThreshold ?? 0.3,
      });
    }
  }, [chatbot, callModels]);

  // Fetch categories when call is enabled (for both master admin and company admin)
  useEffect(() => {
    if (formData.enabledCall && categoriesApiBase) {
      setIsCategoriesLoading(true);
      fetch(`${categoriesApiBase}/knowledge/categories`)
        .then((res) => res.json())
        .then((data) => {
          const categoryNames = (data.categories || []).map((c: { name: string }) => c.name);
          setAvailableCategories(categoryNames);
        })
        .catch((err) => {
          console.error("Failed to fetch categories:", err);
        })
        .finally(() => {
          setIsCategoriesLoading(false);
        });
    }
  }, [formData.enabledCall, categoriesApiBase]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Get the selected call model
  const selectedCallModel = callModels?.find(m => m.id === formData.callModelId);
  const voiceOptions = selectedCallModel?.settingsSchema?.voice?.options || [];

  // Voice preview handlers
  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
    setPlayingVoice(null);
  }, []);

  const playVoicePreview = useCallback(async (voice: string) => {
    // Stop any existing playback
    stopPreview();

    setPlayingVoice(voice);

    try {
      // Use static file instead of API call
      const audio = new Audio(`/voice/${voice.toLowerCase()}.mp3`);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPreviewPlaying(false);
        setPlayingVoice(null);
      };

      audio.onerror = () => {
        addToast({ title: "Voice preview not available", color: "danger" });
        setIsPreviewPlaying(false);
        setPlayingVoice(null);
      };

      await audio.play();
      setIsPreviewPlaying(true);
    } catch (error) {
      console.error("Voice preview error:", error);
      addToast({
        title: "Failed to play voice preview",
        color: "danger",
      });
      setPlayingVoice(null);
    }
  }, [stopPreview]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build voiceConfig from selected voice
      const voiceConfig = buildVoiceConfig(
        formData.selectedVoice,
        selectedCallModel,
        chatbot?.voiceConfig
      );

      let payload;
      if (isMasterAdmin) {
        // Master admin can save everything including callModelId and settings
        payload = {
          name: formData.name,
          description: formData.description,
          status: formData.status,
          enabledChat: formData.enabledChat,
          enabledCall: formData.enabledCall,
          callModelId: formData.callModelId,
          voiceConfig,
          settings: {
            callSystemPrompt: formData.callSystemPrompt,
            callKnowledgeBaseEnabled: formData.callKnowledgeBaseEnabled,
            callKnowledgeCategories: formData.callKnowledgeCategories,
            callKnowledgeBaseThreshold: formData.callKnowledgeBaseThreshold,
          },
        };
      } else {
        // Company admin can save basic info + voiceConfig + knowledge base settings (but NOT callModelId or callSystemPrompt)
        payload = {
          name: formData.name,
          description: formData.description,
          status: formData.status,
          voiceConfig, // Company admin can edit voice
          settings: {
            callKnowledgeBaseEnabled: formData.callKnowledgeBaseEnabled,
            callKnowledgeCategories: formData.callKnowledgeCategories,
            callKnowledgeBaseThreshold: formData.callKnowledgeBaseThreshold,
          },
        };
      }

      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to update chatbot");

      addToast({ title: "Chatbot updated successfully", color: "success" });
      onRefresh();
    } catch {
      addToast({ title: "Failed to update chatbot", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      addToast({ title: "Chatbot deleted successfully", color: "success" });
    } catch {
      addToast({ title: "Failed to delete chatbot", color: "danger" });
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!chatbot) return null;

  // Check if tabs should be shown - now also for company admin when call is enabled
  const showTabs = formData.enabledCall && chatbot.packageEnabledCall !== false;

  // ============================================================
  // Tab Content (as JSX elements, NOT function components)
  // Defining these as function components inside render causes
  // focus loss because React sees them as new component types on every render
  // ============================================================

  // General Settings Tab Content (Basic Info + Features + Danger Zone)
  const generalTabContent = (
    <div className="mt-6 space-y-6">
      <Card className="p-6">
        <FormSection title="Basic Information">
          <FormFieldWrapper label="Chatbot Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter chatbot name"
            />
          </FormFieldWrapper>

          <FormFieldWrapper label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Enter a description for this chatbot"
              rows={3}
            />
          </FormFieldWrapper>

          <FormFieldWrapper label="Status">
            <Select
              selectedKeys={new Set([formData.status])}
              onSelectionChange={(keys) => {
                const status = Array.from(keys)[0] as "draft" | "active" | "paused" | "archived";
                setFormData((prev) => ({ ...prev, status }));
              }}
              options={[
                { value: "draft", label: "Draft" },
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </FormFieldWrapper>
        </FormSection>
      </Card>

      {isMasterAdmin && (chatbot.packageEnabledChat !== false || chatbot.packageEnabledCall !== false) && (
        <Card className="p-6">
          <FormSection title="Features">
            <div className="flex gap-6">
              {/* Show Enable Chat only if no package or package has enabledChat */}
              {chatbot.packageEnabledChat !== false && (
                <Switch
                  isSelected={formData.enabledChat}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, enabledChat: v }))}
                >
                  Enable Chat
                </Switch>
              )}
              {/* Show Enable Call only if no package or package has enabledCall */}
              {chatbot.packageEnabledCall !== false && (
                <Switch
                  isSelected={formData.enabledCall}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, enabledCall: v }))}
                >
                  Enable Call
                </Switch>
              )}
            </div>
          </FormSection>
        </Card>
      )}

      {onDelete && (
        <Card className="border-destructive/50 p-6">
          <FormSection title="Danger Zone">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete this chatbot</p>
                <p className="text-sm text-muted-foreground">
                  Once deleted, this chatbot and all its data will be permanently removed.
                </p>
              </div>
              <Button
                variant="destructive"
                startContent={<Trash2 size={16} />}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Chatbot
              </Button>
            </div>
          </FormSection>
        </Card>
      )}
    </div>
  );

  // Call Configuration Tab Content
  const callTabContent = (
    <div className="mt-6 space-y-6">
      {/* Call Model & Voice Card */}
      <Card className="p-6">
        <FormSection title="Voice Settings" description="Configure the AI model and voice for voice calls">
          {/* Call Model Dropdown - Only show for Master Admin */}
          {isMasterAdmin && (
            <FormFieldWrapper
              label="Call Model"
              description="Select the AI model to use for voice calls"
            >
              <Select
                selectedKeys={formData.callModelId ? new Set([formData.callModelId]) : new Set()}
                onSelectionChange={(keys) => {
                  const modelId = Array.from(keys)[0] as string;
                  setFormData((prev) => ({ ...prev, callModelId: modelId }));
                  // Set default voice from model's settingsSchema
                  const model = callModels?.find((m) => m.id === modelId);
                  const defaultVoice = model?.settingsSchema?.voice?.default as string | undefined;
                  setFormData((prev) => ({ ...prev, selectedVoice: defaultVoice || null }));
                  // Stop any playing preview
                  stopPreview();
                }}
                options={(callModels || []).map((m) => ({
                  value: m.id,
                  label: m.displayName,
                }))}
                placeholder="Select a call model"
              />
            </FormFieldWrapper>
          )}

          {/* Voice Selection with Preview */}
          {formData.callModelId && voiceOptions.length > 0 && (
            <FormFieldWrapper label="Voice" description="Select a voice for the AI assistant">
              <div className="space-y-2">
                {voiceOptions.map((voice) => (
                  <div
                    key={voice}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      formData.selectedVoice === voice
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left font-medium"
                      onClick={() => setFormData((prev) => ({ ...prev, selectedVoice: voice }))}
                    >
                      {voice}
                      {formData.selectedVoice === voice && (
                        <span className="ml-2 text-xs text-primary">(selected)</span>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (playingVoice === voice && isPreviewPlaying) {
                          stopPreview();
                        } else {
                          playVoicePreview(voice);
                        }
                      }}
                    >
                      {playingVoice === voice && isPreviewPlaying ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="ml-1">
                        {playingVoice === voice && isPreviewPlaying ? "Stop" : "Preview"}
                      </span>
                    </Button>
                  </div>
                ))}
              </div>
            </FormFieldWrapper>
          )}
        </FormSection>
      </Card>

      {/* Call System Prompt Card - Only show for Master Admin */}
      {isMasterAdmin && (
        <Card className="p-6">
          <FormSection
            title="System Prompt"
            description="System prompt used during voice calls. This defines the AI's behavior, personality, and capabilities for voice interactions."
          >
            <FormFieldWrapper label="Call System Prompt">
              <Textarea
                value={formData.callSystemPrompt}
                onChange={(e) => setFormData((prev) => ({ ...prev, callSystemPrompt: e.target.value }))}
                placeholder="You are a helpful voice assistant..."
                rows={8}
                className="font-mono text-sm"
              />
            </FormFieldWrapper>
          </FormSection>
        </Card>
      )}

      {/* Knowledge Base Card - Show for both Master Admin and Company Admin */}
      <Card className="p-6">
        <FormSection
          title="Knowledge Base"
          description="Enable the AI to search your knowledge base during voice calls for accurate information retrieval."
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Database size={16} className="text-muted-foreground" />
                  Knowledge Base Access
                </p>
                <p className="text-sm text-muted-foreground">
                  Allow the AI to query your knowledge base during calls
                </p>
              </div>
              <Switch
                isSelected={formData.callKnowledgeBaseEnabled}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, callKnowledgeBaseEnabled: v }))}
              />
            </div>

            {formData.callKnowledgeBaseEnabled && (
              <>
                <FormFieldWrapper
                  label="Knowledge Categories"
                  description="Select which knowledge categories the AI can access during calls. Leave empty to allow access to all categories."
                >
                  <TagInput
                    value={formData.callKnowledgeCategories}
                    onChange={(tags) => setFormData((prev) => ({ ...prev, callKnowledgeCategories: tags }))}
                    suggestions={availableCategories}
                    placeholder="Type to search categories..."
                    allowCreate={false}
                    isLoading={isCategoriesLoading}
                  />
                </FormFieldWrapper>

                <FormFieldWrapper
                  label="Relevance Threshold"
                  description="Minimum relevance score for knowledge search results. Lower values return more results but may include less relevant content."
                >
                  <div className="space-y-2">
                    <Slider
                      value={[formData.callKnowledgeBaseThreshold]}
                      onValueChange={(values) => setFormData((prev) => ({ ...prev, callKnowledgeBaseThreshold: values[0] ?? prev.callKnowledgeBaseThreshold }))}
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      showValue
                      formatValue={(value) => value.toFixed(2)}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>More Results (0.05)</span>
                      <span>More Relevant (0.95)</span>
                    </div>
                  </div>
                </FormFieldWrapper>
              </>
            )}
          </div>
        </FormSection>
      </Card>
    </div>
  );

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header with Save button - always visible */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">General Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure basic chatbot information
          </p>
        </div>
        <Button
          startContent={<Save size={16} />}
          onClick={handleSave}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>

      {/* Conditional Tabs or Single View */}
      {showTabs ? (
        <Tabs
          items={[
            {
              key: "general",
              label: "General Settings",
              icon: Settings,
              content: generalTabContent,
            },
            {
              key: "call",
              label: "Call Configuration",
              icon: Phone,
              content: callTabContent,
            },
          ]}
          syncWithUrl={true}
          urlParam="tab"
        />
      ) : (
        <>
          {/* Render without tabs */}
          <Card className="p-6">
            <FormSection title="Basic Information">
              <FormFieldWrapper label="Chatbot Name" required>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter chatbot name"
                />
              </FormFieldWrapper>

              <FormFieldWrapper label="Description">
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter a description for this chatbot"
                  rows={3}
                />
              </FormFieldWrapper>

              <FormFieldWrapper label="Status">
                <Select
                  selectedKeys={new Set([formData.status])}
                  onSelectionChange={(keys) => {
                    const status = Array.from(keys)[0] as "draft" | "active" | "paused" | "archived";
                    setFormData((prev) => ({ ...prev, status }));
                  }}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
              </FormFieldWrapper>
            </FormSection>
          </Card>

          {isMasterAdmin && (chatbot.packageEnabledChat !== false || chatbot.packageEnabledCall !== false) && (
            <Card className="p-6">
              <FormSection title="Features">
                <div className="flex gap-6">
                  {/* Show Enable Chat only if no package or package has enabledChat */}
                  {chatbot.packageEnabledChat !== false && (
                    <Switch
                      isSelected={formData.enabledChat}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, enabledChat: v }))}
                    >
                      Enable Chat
                    </Switch>
                  )}
                  {/* Show Enable Call only if no package or package has enabledCall */}
                  {chatbot.packageEnabledCall !== false && (
                    <Switch
                      isSelected={formData.enabledCall}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, enabledCall: v }))}
                    >
                      Enable Call
                    </Switch>
                  )}
                </div>
              </FormSection>
            </Card>
          )}

          {/* Call Configuration - Shown when call is enabled (read-only Call Model for company admin, editable Voice for both) */}
          {chatbot.packageEnabledCall !== false && formData.enabledCall && callModels && callModels.length > 0 && (
            <Card className="p-6">
              <FormSection title="Call Configuration" description="Configure the AI model and voice for voice calls">
                {/* Call Model Dropdown */}
                <FormFieldWrapper label="Call Model" description={isMasterAdmin ? "Select the AI model to use for voice calls" : "AI model configured by administrator"}>
                  <Select
                    selectedKeys={formData.callModelId ? new Set([formData.callModelId]) : new Set()}
                    onSelectionChange={(keys) => {
                      if (!isMasterAdmin) return; // Company admin cannot change
                      const modelId = Array.from(keys)[0] as string;
                      setFormData((prev) => ({ ...prev, callModelId: modelId }));
                      // Set default voice from model's settingsSchema
                      const model = callModels.find((m) => m.id === modelId);
                      const defaultVoice = model?.settingsSchema?.voice?.default as string | undefined;
                      setFormData((prev) => ({ ...prev, selectedVoice: defaultVoice || null }));
                      // Stop any playing preview
                      stopPreview();
                    }}
                    options={callModels.map((m) => ({
                      value: m.id,
                      label: m.displayName,
                    }))}
                    placeholder="Select a call model"
                    isDisabled={!isMasterAdmin}
                  />
                </FormFieldWrapper>

                {/* Voice Selection with Preview */}
                {formData.callModelId && voiceOptions.length > 0 && (
                  <FormFieldWrapper label="Voice" description="Select a voice for the AI assistant">
                    <div className="space-y-2">
                      {voiceOptions.map((voice) => (
                        <div
                          key={voice}
                          className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                            formData.selectedVoice === voice
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex-1 text-left font-medium"
                            onClick={() => setFormData((prev) => ({ ...prev, selectedVoice: voice }))}
                          >
                            {voice}
                            {formData.selectedVoice === voice && (
                              <span className="ml-2 text-xs text-primary">(selected)</span>
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (playingVoice === voice && isPreviewPlaying) {
                                stopPreview();
                              } else {
                                playVoicePreview(voice);
                              }
                            }}
                          >
                            {playingVoice === voice && isPreviewPlaying ? (
                              <Square className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            <span className="ml-1">
                              {playingVoice === voice && isPreviewPlaying ? "Stop" : "Preview"}
                            </span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </FormFieldWrapper>
                )}

                {/* Call System Prompt - Master Admin Only */}
                {isMasterAdmin && (
                  <FormFieldWrapper
                    label="Call System Prompt"
                    description="System prompt used during voice calls. This defines the AI's behavior, personality, and capabilities for voice interactions. Include instructions for handling all topics since agent transfers are not available during calls."
                  >
                    <Textarea
                      value={formData.callSystemPrompt}
                      onChange={(e) => setFormData((prev) => ({ ...prev, callSystemPrompt: e.target.value }))}
                      placeholder="You are a helpful voice assistant..."
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </FormFieldWrapper>
                )}
              </FormSection>
            </Card>
          )}

          {onDelete && (
            <Card className="border-destructive/50 p-6">
              <FormSection title="Danger Zone">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete this chatbot</p>
                    <p className="text-sm text-muted-foreground">
                      Once deleted, this chatbot and all its data will be permanently removed.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    startContent={<Trash2 size={16} />}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Chatbot
                  </Button>
                </div>
              </FormSection>
            </Card>
          )}
        </>
      )}

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Chatbot"
        message={
          <>
            Are you sure you want to delete <strong>{chatbot.name}</strong>? This action cannot be undone and will permanently remove all conversations and data associated with this chatbot.
          </>
        }
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
