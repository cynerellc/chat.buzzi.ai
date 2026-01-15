"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, Settings, Volume2, Mic, Save, Loader2, AlertCircle, Play, Square, Loader } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Label,
  Button,
  Select,
  Slider,
  Textarea,
  Alert,
  Separator,
} from "@/components/ui";
import type { VoiceConfig, CallWidgetConfig } from "@/hooks/company";

// ============================================================================
// Types
// ============================================================================

interface VoiceSettingsProps {
  chatbotId: string;
  enabledCall: boolean;
  callAiProvider: "OPENAI" | "GEMINI" | null;
  voiceConfig: VoiceConfig;
  callWidgetConfig: CallWidgetConfig;
  onSave: (data: {
    enabledCall: boolean;
    callAiProvider: "OPENAI" | "GEMINI" | null;
    voiceConfig: VoiceConfig;
    callWidgetConfig: CallWidgetConfig;
  }) => Promise<void>;
}

// Voice options for each provider
const OPENAI_VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy", description: "Neutral and balanced" },
  { value: "ash", label: "Ash", description: "Calm and professional" },
  { value: "ballad", label: "Ballad", description: "Warm and expressive" },
  { value: "coral", label: "Coral", description: "Friendly and approachable" },
  { value: "echo", label: "Echo", description: "Clear and authoritative" },
  { value: "sage", label: "Sage", description: "Wise and thoughtful" },
  { value: "shimmer", label: "Shimmer", description: "Light and energetic" },
  { value: "verse", label: "Verse", description: "Narrative and engaging" },
];

const GEMINI_VOICE_OPTIONS = [
  { value: "Kore", label: "Kore", description: "Confident and professional" },
  { value: "Aoede", label: "Aoede", description: "Melodic and friendly" },
  { value: "Puck", label: "Puck", description: "Playful and energetic" },
  { value: "Charon", label: "Charon", description: "Deep and authoritative" },
  { value: "Fenrir", label: "Fenrir", description: "Strong and commanding" },
];

const AI_PROVIDER_OPTIONS = [
  { value: "OPENAI", label: "OpenAI Realtime", description: "GPT-4 with natural voice" },
  { value: "GEMINI", label: "Google Gemini Live", description: "Gemini 2.0 Flash with multimodal" },
];

const VAD_SENSITIVITY_OPTIONS = [
  { value: "LOW", label: "Low", description: "Requires louder speech to trigger" },
  { value: "MEDIUM", label: "Medium", description: "Balanced sensitivity" },
  { value: "HIGH", label: "High", description: "Sensitive to quieter speech" },
];

const POSITION_OPTIONS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
];

const BUTTON_STYLE_OPTIONS = [
  { value: "orb", label: "Orb (Circular)" },
  { value: "pill", label: "Pill (Rounded)" },
];

// ============================================================================
// Component
// ============================================================================

export function VoiceSettings({
  chatbotId,
  enabledCall: initialEnabledCall,
  callAiProvider: initialCallAiProvider,
  voiceConfig: initialVoiceConfig,
  callWidgetConfig: initialCallWidgetConfig,
  onSave,
}: VoiceSettingsProps) {
  // State
  const [enabledCall, setEnabledCall] = useState(initialEnabledCall);
  const [callAiProvider, setCallAiProvider] = useState<"OPENAI" | "GEMINI" | null>(
    initialCallAiProvider
  );
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(initialVoiceConfig);
  const [callWidgetConfig, setCallWidgetConfig] = useState<CallWidgetConfig>(initialCallWidgetConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Voice preview state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Track changes
  useEffect(() => {
    const hasChanged =
      enabledCall !== initialEnabledCall ||
      callAiProvider !== initialCallAiProvider ||
      JSON.stringify(voiceConfig) !== JSON.stringify(initialVoiceConfig) ||
      JSON.stringify(callWidgetConfig) !== JSON.stringify(initialCallWidgetConfig);
    setHasChanges(hasChanged);
  }, [
    enabledCall,
    callAiProvider,
    voiceConfig,
    callWidgetConfig,
    initialEnabledCall,
    initialCallAiProvider,
    initialVoiceConfig,
    initialCallWidgetConfig,
  ]);

  // Handlers
  const handleProviderChange = (provider: string) => {
    const typedProvider = provider as "OPENAI" | "GEMINI";
    setCallAiProvider(typedProvider);
    // Set default voice for the new provider
    if (typedProvider === "OPENAI") {
      setVoiceConfig((prev) => ({
        ...prev,
        openai_voice: prev.openai_voice || "alloy",
        vad_threshold: prev.vad_threshold ?? 0.5,
      }));
    } else {
      setVoiceConfig((prev) => ({
        ...prev,
        gemini_voice: prev.gemini_voice || "Kore",
        vad_sensitivity: prev.vad_sensitivity || "MEDIUM",
      }));
    }
  };

  const handleVoiceConfigChange = <K extends keyof VoiceConfig>(
    key: K,
    value: VoiceConfig[K]
  ) => {
    setVoiceConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleCallWidgetConfigChange = <K extends keyof CallWidgetConfig>(
    key: K,
    value: CallWidgetConfig[K]
  ) => {
    setCallWidgetConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        enabledCall,
        callAiProvider,
        voiceConfig,
        callWidgetConfig,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Voice preview handlers
  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
  }, []);

  const playVoicePreview = useCallback(async () => {
    if (!callAiProvider) return;

    // Stop any existing playback
    stopPreview();

    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const voice =
        callAiProvider === "OPENAI"
          ? voiceConfig.openai_voice || "alloy"
          : voiceConfig.gemini_voice || "Kore";

      const response = await fetch("/api/company/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: callAiProvider,
          voice,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate preview");
      }

      // Clean up previous audio URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      // Create audio from response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      // Play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPreviewPlaying(false);
      };

      audio.onerror = () => {
        setPreviewError("Failed to play audio");
        setIsPreviewPlaying(false);
      };

      await audio.play();
      setIsPreviewPlaying(true);
    } catch (error) {
      console.error("Voice preview error:", error);
      setPreviewError(
        error instanceof Error ? error.message : "Failed to play voice preview"
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }, [callAiProvider, voiceConfig.openai_voice, voiceConfig.gemini_voice, stopPreview]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voice Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure voice call capabilities for this chatbot
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Enable Call Feature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Voice Call Feature
          </CardTitle>
          <CardDescription>
            Enable voice calling to allow users to speak with your chatbot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-call">Enable Voice Calls</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to start voice calls from the chat widget
              </p>
            </div>
            <Switch
              id="enable-call"
              checked={enabledCall}
              onCheckedChange={setEnabledCall}
            />
          </div>

          {enabledCall && !callAiProvider && (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              Please select an AI provider to enable voice calls
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* AI Provider Selection */}
      {enabledCall && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Provider
            </CardTitle>
            <CardDescription>
              Choose the AI service that will power voice conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Voice AI Provider"
              placeholder="Select AI provider"
              options={AI_PROVIDER_OPTIONS}
              value={callAiProvider || undefined}
              onValueChange={handleProviderChange}
            />
          </CardContent>
        </Card>
      )}

      {/* Voice Configuration */}
      {enabledCall && callAiProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice Configuration
            </CardTitle>
            <CardDescription>
              Configure the voice and speech settings for your chatbot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Voice Selection with Preview */}
            <div className="space-y-3">
              {callAiProvider === "OPENAI" ? (
                <Select
                  label="Voice"
                  options={OPENAI_VOICE_OPTIONS}
                  value={voiceConfig.openai_voice || "alloy"}
                  onValueChange={(value) =>
                    handleVoiceConfigChange(
                      "openai_voice",
                      value as VoiceConfig["openai_voice"]
                    )
                  }
                />
              ) : (
                <Select
                  label="Voice"
                  options={GEMINI_VOICE_OPTIONS}
                  value={voiceConfig.gemini_voice || "Kore"}
                  onValueChange={(value) =>
                    handleVoiceConfigChange(
                      "gemini_voice",
                      value as VoiceConfig["gemini_voice"]
                    )
                  }
                />
              )}

              {/* Voice Preview Button */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={isPreviewPlaying ? stopPreview : playVoicePreview}
                  disabled={isPreviewLoading}
                >
                  {isPreviewLoading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : isPreviewPlaying ? (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Preview Voice
                    </>
                  )}
                </Button>
                {previewError && (
                  <span className="text-sm text-destructive">{previewError}</span>
                )}
              </div>
            </div>

            <Separator />

            {/* VAD Settings */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Voice Activity Detection</Label>
                <p className="text-xs text-muted-foreground">
                  Controls when the AI detects user speech
                </p>
              </div>

              {callAiProvider === "OPENAI" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="vad-threshold">
                        Threshold: {((voiceConfig.vad_threshold || 0.5) * 100).toFixed(0)}%
                      </Label>
                    </div>
                    <Slider
                      id="vad-threshold"
                      min={0}
                      max={100}
                      step={5}
                      value={[(voiceConfig.vad_threshold || 0.5) * 100]}
                      onValueChange={([value]) =>
                        handleVoiceConfigChange("vad_threshold", (value ?? 50) / 100)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher values require louder speech to trigger
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="silence-duration">
                        Silence Duration: {voiceConfig.silence_duration_ms || 700}ms
                      </Label>
                    </div>
                    <Slider
                      id="silence-duration"
                      min={300}
                      max={2000}
                      step={100}
                      value={[voiceConfig.silence_duration_ms || 700]}
                      onValueChange={([value]) =>
                        handleVoiceConfigChange("silence_duration_ms", value ?? 700)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      How long to wait after silence before responding
                    </p>
                  </div>
                </div>
              ) : (
                <Select
                  label="Sensitivity Level"
                  options={VAD_SENSITIVITY_OPTIONS}
                  value={voiceConfig.vad_sensitivity || "MEDIUM"}
                  onValueChange={(value) =>
                    handleVoiceConfigChange(
                      "vad_sensitivity",
                      value as VoiceConfig["vad_sensitivity"]
                    )
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Prompts */}
      {enabledCall && callAiProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Call Prompts
            </CardTitle>
            <CardDescription>
              Configure what your chatbot says during voice calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="call-greeting">Call Greeting</Label>
              <Textarea
                id="call-greeting"
                placeholder="Hello! I'm your virtual assistant. How can I help you today?"
                value={voiceConfig.call_greeting || ""}
                onChange={(e) => handleVoiceConfigChange("call_greeting", e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                The first thing your chatbot says when a call starts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system-prompt-call">System Prompt for Calls</Label>
              <Textarea
                id="system-prompt-call"
                placeholder="You are a helpful voice assistant. Speak naturally and conversationally. Keep responses concise and clear."
                value={voiceConfig.system_prompt_call || ""}
                onChange={(e) =>
                  handleVoiceConfigChange("system_prompt_call", e.target.value)
                }
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Additional instructions for voice call behavior. Leave empty to use the default
                system prompt.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Widget Settings */}
      {enabledCall && callAiProvider && (
        <Card>
          <CardHeader>
            <CardTitle>Call Widget Settings</CardTitle>
            <CardDescription>
              Customize how the call button appears in the chat widget
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="widget-enabled">Show Call Button</Label>
                <p className="text-sm text-muted-foreground">
                  Display the call button in the chat widget
                </p>
              </div>
              <Switch
                id="widget-enabled"
                checked={callWidgetConfig.enabled !== false}
                onCheckedChange={(checked) =>
                  handleCallWidgetConfigChange("enabled", checked)
                }
              />
            </div>

            <Separator />

            <Select
              label="Button Position"
              options={POSITION_OPTIONS}
              value={callWidgetConfig.position || "bottom-right"}
              onValueChange={(value) =>
                handleCallWidgetConfigChange(
                  "position",
                  value as "bottom-right" | "bottom-left"
                )
              }
            />

            <Select
              label="Button Style"
              options={BUTTON_STYLE_OPTIONS}
              value={callWidgetConfig.callButton?.style || "orb"}
              onValueChange={(value) =>
                handleCallWidgetConfigChange("callButton", {
                  ...callWidgetConfig.callButton,
                  style: value as "orb" | "pill",
                })
              }
            />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-visualizer">Audio Visualizer</Label>
                <p className="text-sm text-muted-foreground">
                  Show waveform during active calls
                </p>
              </div>
              <Switch
                id="show-visualizer"
                checked={callWidgetConfig.callDialog?.showVisualizer !== false}
                onCheckedChange={(checked) =>
                  handleCallWidgetConfigChange("callDialog", {
                    ...callWidgetConfig.callDialog,
                    showVisualizer: checked,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-transcript">Live Transcript</Label>
                <p className="text-sm text-muted-foreground">
                  Display conversation text during calls
                </p>
              </div>
              <Switch
                id="show-transcript"
                checked={callWidgetConfig.callDialog?.showTranscript !== false}
                onCheckedChange={(checked) =>
                  handleCallWidgetConfigChange("callDialog", {
                    ...callWidgetConfig.callDialog,
                    showTranscript: checked,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
