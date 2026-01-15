"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

import {
  Modal,
  Button,
  Input,
  Textarea,
  Select,
  Switch,
} from "@/components/ui";
import type { ModelListItem, ModelSettingsSchema } from "@/hooks/master-admin/useModels";
import { createModel, updateModel } from "@/hooks/master-admin/useModels";

interface ModelEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  model?: ModelListItem | null;
  onSuccess: () => void;
}

const providers = [
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "anthropic", label: "Anthropic" },
];

const modelTypes = [
  { value: "chat", label: "Chat Only" },
  { value: "call", label: "Call Only" },
  { value: "both", label: "Chat & Call" },
];

// Default settings schema for different providers
const defaultSettingsSchemas: Record<string, ModelSettingsSchema> = {
  openai: {
    temperature: {
      type: "slider",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.7,
      label: "Temperature",
      description: "Controls randomness. Lower values are more focused.",
    },
    max_tokens: {
      type: "number",
      min: 1,
      max: 16384,
      default: 4096,
      label: "Max Output Tokens",
      description: "Maximum tokens in the response.",
    },
    top_p: {
      type: "slider",
      min: 0,
      max: 1,
      step: 0.05,
      default: 1,
      label: "Top P",
      description: "Nucleus sampling probability.",
    },
  },
  google: {
    temperature: {
      type: "slider",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.7,
      label: "Temperature",
      description: "Controls randomness. Lower values are more focused.",
    },
    max_tokens: {
      type: "number",
      min: 1,
      max: 65536,
      default: 8192,
      label: "Max Output Tokens",
      description: "Maximum tokens in the response.",
    },
    top_p: {
      type: "slider",
      min: 0,
      max: 1,
      step: 0.05,
      default: 1,
      label: "Top P",
      description: "Nucleus sampling probability.",
    },
    top_k: {
      type: "number",
      min: 1,
      max: 100,
      default: 40,
      label: "Top K",
      description: "Number of top tokens to consider.",
    },
  },
  anthropic: {
    temperature: {
      type: "slider",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.7,
      label: "Temperature",
      description: "Controls randomness. Lower values are more focused.",
    },
    max_tokens: {
      type: "number",
      min: 1,
      max: 8192,
      default: 4096,
      label: "Max Output Tokens",
      description: "Maximum tokens in the response.",
    },
  },
};

export function ModelEditorModal({ isOpen, onClose, model, onSuccess }: ModelEditorModalProps) {
  const isEditing = !!model;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [provider, setProvider] = useState<"openai" | "google" | "anthropic">("openai");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [modelType, setModelType] = useState<"chat" | "call" | "both">("chat");
  const [supportsAudio, setSupportsAudio] = useState(false);
  const [inputLimit, setInputLimit] = useState("128000");
  const [outputLimit, setOutputLimit] = useState("16384");
  const [inputPricePerMillion, setInputPricePerMillion] = useState("");
  const [outputPricePerMillion, setOutputPricePerMillion] = useState("");
  const [cachedInputPrice, setCachedInputPrice] = useState("");
  const [settingsSchema, setSettingsSchema] = useState<ModelSettingsSchema>({});
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");

  // Reset form when modal opens/closes or model changes
  useEffect(() => {
    if (isOpen && model) {
      setProvider(model.provider);
      setModelId(model.modelId);
      setDisplayName(model.displayName);
      setDescription(model.description ?? "");
      setModelType(model.modelType ?? "chat");
      setSupportsAudio(model.supportsAudio ?? false);
      setInputLimit(String(model.inputLimit));
      setOutputLimit(String(model.outputLimit));
      setInputPricePerMillion(model.inputPricePerMillion ?? "");
      setOutputPricePerMillion(model.outputPricePerMillion ?? "");
      setCachedInputPrice(model.cachedInputPrice ?? "");
      setSettingsSchema(model.settingsSchema ?? {});
      setIsActive(model.isActive);
      setIsDefault(model.isDefault);
      setSortOrder(String(model.sortOrder));
    } else if (isOpen && !model) {
      // Reset for new model
      setProvider("openai");
      setModelId("");
      setDisplayName("");
      setDescription("");
      setModelType("chat");
      setSupportsAudio(false);
      setInputLimit("128000");
      setOutputLimit("16384");
      setInputPricePerMillion("");
      setOutputPricePerMillion("");
      setCachedInputPrice("");
      setSettingsSchema(defaultSettingsSchemas.openai ?? {});
      setIsActive(true);
      setIsDefault(false);
      setSortOrder("0");
    }
  }, [isOpen, model]);

  // Update settings schema when provider changes (only for new models)
  useEffect(() => {
    if (!isEditing && isOpen) {
      setSettingsSchema(defaultSettingsSchemas[provider] || {});
    }
  }, [provider, isEditing, isOpen]);

  const handleSubmit = async () => {
    if (!modelId.trim() || !displayName.trim()) {
      toast.error("Model ID and Display Name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        provider,
        modelId: modelId.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        modelType,
        supportsAudio,
        inputLimit: parseInt(inputLimit),
        outputLimit: parseInt(outputLimit),
        inputPricePerMillion: inputPricePerMillion || undefined,
        outputPricePerMillion: outputPricePerMillion || undefined,
        cachedInputPrice: cachedInputPrice || undefined,
        settingsSchema,
        isActive,
        isDefault,
        sortOrder: parseInt(sortOrder),
      };

      if (isEditing && model) {
        await updateModel(model.id, data);
        toast.success("Model updated successfully");
      } else {
        await createModel(data);
        toast.success("Model created successfully");
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save model");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Model" : "Add New Model"}
      description={isEditing ? "Update model configuration" : "Configure a new AI model"}
      size="xl"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {/* Provider */}
        <Select
          label="Provider"
          options={providers}
          value={provider}
          onValueChange={(value) => setProvider(value as "openai" | "google" | "anthropic")}
          isDisabled={isEditing}
        />

        {/* Model ID */}
        <Input
          label="Model ID"
          placeholder="e.g., gpt-5-mini-2025-08-07"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          isDisabled={isEditing}
          description="The exact model identifier used in API calls"
        />

        {/* Display Name */}
        <Input
          label="Display Name"
          placeholder="e.g., GPT-5 Mini"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Brief description of the model..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minRows={2}
        />

        {/* Model Type and Audio Support */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Model Type"
            options={modelTypes}
            value={modelType}
            onValueChange={(value) => setModelType(value as "chat" | "call" | "both")}
            description="Determines if this model can be used for chat, voice calls, or both"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Audio Support</label>
            <div className="flex items-center h-10">
              <Switch isSelected={supportsAudio} onValueChange={setSupportsAudio}>
                Supports Real-time Audio
              </Switch>
            </div>
            <p className="text-xs text-muted-foreground">Enable for models with real-time audio streaming</p>
          </div>
        </div>

        {/* Token Limits */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            label="Input Token Limit"
            value={inputLimit}
            onChange={(e) => setInputLimit(e.target.value)}
          />
          <Input
            type="number"
            label="Output Token Limit"
            value={outputLimit}
            onChange={(e) => setOutputLimit(e.target.value)}
          />
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Input Price/1M"
            placeholder="0.00"
            value={inputPricePerMillion}
            onChange={(e) => setInputPricePerMillion(e.target.value)}
            startContent={<span className="text-muted-foreground">$</span>}
          />
          <Input
            label="Output Price/1M"
            placeholder="0.00"
            value={outputPricePerMillion}
            onChange={(e) => setOutputPricePerMillion(e.target.value)}
            startContent={<span className="text-muted-foreground">$</span>}
          />
          <Input
            label="Cached Input/1M"
            placeholder="0.00"
            value={cachedInputPrice}
            onChange={(e) => setCachedInputPrice(e.target.value)}
            startContent={<span className="text-muted-foreground">$</span>}
          />
        </div>

        {/* Settings Schema Preview */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Settings Schema</label>
          <div className="bg-muted rounded-lg p-3 text-xs font-mono max-h-32 overflow-auto">
            <pre>{JSON.stringify(settingsSchema, null, 2)}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            Defines available configuration options for this model
          </p>
        </div>

        {/* Sort Order */}
        <Input
          type="number"
          label="Sort Order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          description="Lower numbers appear first in lists"
        />

        {/* Toggles */}
        <div className="flex items-center gap-6">
          <Switch isSelected={isActive} onValueChange={setIsActive}>
            Active
          </Switch>
          <Switch isSelected={isDefault} onValueChange={setIsDefault}>
            Default Model
          </Switch>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        <Button variant="outline" onPress={onClose} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
          {isEditing ? "Save Changes" : "Create Model"}
        </Button>
      </div>
    </Modal>
  );
}
