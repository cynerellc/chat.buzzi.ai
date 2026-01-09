"use client";

import { useMemo } from "react";

import { FormFieldWrapper } from "@/components/shared";
import { Input, Select, Slider, Switch } from "@/components/ui";
import { useActiveModels, type ActiveModelInfo } from "@/hooks/shared/useActiveModels";
import type { ModelSettingsSchema, ModelSettingDefinition } from "@/lib/db/schema/models";

interface ModelSettingsFormProps {
  /** The currently selected model ID */
  modelId: string;
  /** Current model settings values */
  settings: Record<string, unknown>;
  /** Called when any setting changes */
  onChange: (settings: Record<string, unknown>) => void;
  /** Called when model selection changes */
  onModelChange: (modelId: string) => void;
}

function getDefaultSettings(schema: ModelSettingsSchema): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    settings[key] = def.default;
  }
  return settings;
}

function SettingField({
  settingKey,
  definition,
  value,
  onChange,
}: {
  settingKey: string;
  definition: ModelSettingDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (definition.type) {
    case "slider":
      return (
        <FormFieldWrapper
          label={`${definition.label}: ${value ?? definition.default}`}
          description={definition.description}
        >
          <Slider
            value={[typeof value === "number" ? value : (definition.default as number)]}
            onValueChange={(v) => onChange(v[0])}
            min={definition.min ?? 0}
            max={definition.max ?? 1}
            step={definition.step ?? 0.1}
          />
        </FormFieldWrapper>
      );

    case "number":
      return (
        <FormFieldWrapper
          label={definition.label}
          description={definition.description}
        >
          <Input
            type="number"
            value={String(value ?? definition.default)}
            onChange={(e) => onChange(parseInt(e.target.value) || definition.default)}
            min={definition.min}
            max={definition.max}
          />
        </FormFieldWrapper>
      );

    case "select":
      return (
        <FormFieldWrapper
          label={definition.label}
          description={definition.description}
        >
          <Select
            value={String(value ?? definition.default)}
            onValueChange={onChange}
            options={
              definition.options?.map((opt) => ({ value: opt, label: opt })) ?? []
            }
          />
        </FormFieldWrapper>
      );

    case "toggle":
      return (
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-medium">{definition.label}</p>
            {definition.description && (
              <p className="text-sm text-muted-foreground">{definition.description}</p>
            )}
          </div>
          <Switch
            checked={Boolean(value ?? definition.default)}
            onCheckedChange={onChange}
          />
        </div>
      );

    default:
      return null;
  }
}

export function ModelSettingsForm({
  modelId,
  settings,
  onChange,
  onModelChange,
}: ModelSettingsFormProps) {
  const { models, isLoading } = useActiveModels();

  // Find the selected model
  const selectedModel = useMemo(
    () => models.find((m) => m.modelId === modelId),
    [models, modelId]
  );

  // Get the settings schema for the selected model
  const settingsSchema = useMemo(
    () => (selectedModel?.settingsSchema ?? {}) as ModelSettingsSchema,
    [selectedModel]
  );

  // Convert models to select options
  const modelOptions = useMemo(
    () =>
      models.map((m: ActiveModelInfo) => ({
        value: m.modelId,
        label: `${m.displayName} (${m.provider})`,
      })),
    [models]
  );

  // Handle model change - reset settings to new model's defaults
  const handleModelChange = (newModelId: string) => {
    const newModel = models.find((m) => m.modelId === newModelId);
    if (newModel) {
      const newSchema = (newModel.settingsSchema ?? {}) as ModelSettingsSchema;
      const newDefaults = getDefaultSettings(newSchema);
      // Preserve temperature if it exists in new schema
      if (newSchema.temperature && settings.temperature !== undefined) {
        newDefaults.temperature = settings.temperature;
      }
      onChange(newDefaults);
    }
    onModelChange(newModelId);
  };

  // Handle individual setting change
  const handleSettingChange = (key: string, value: unknown) => {
    onChange({ ...settings, [key]: value });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  // Define display order for settings
  const settingOrder = ["temperature", "max_tokens", "top_p", "top_k", "reasoning_effort"];
  const sortedSettings = Object.entries(settingsSchema).sort(([a], [b]) => {
    const aIndex = settingOrder.indexOf(a);
    const bIndex = settingOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <FormFieldWrapper label="Model">
        <Select
          value={modelId}
          onValueChange={handleModelChange}
          options={modelOptions}
          placeholder={isLoading ? "Loading models..." : "Select a model"}
          isDisabled={isLoading}
        />
      </FormFieldWrapper>

      {/* Dynamic Settings based on model schema */}
      {sortedSettings.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {sortedSettings.map(([key, definition]) => (
            <SettingField
              key={key}
              settingKey={key}
              definition={definition}
              value={settings[key]}
              onChange={(value) => handleSettingChange(key, value)}
            />
          ))}
        </div>
      )}

      {/* Model info */}
      {selectedModel && (
        <p className="text-xs text-muted-foreground">
          {selectedModel.description}
        </p>
      )}
    </div>
  );
}
