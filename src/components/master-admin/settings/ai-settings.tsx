"use client";

import { Zap } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input, RadioGroup, Radio, Select } from "@/components/ui";
import type { AISettings as AISettingsType } from "@/lib/settings";
import { testAIConnection } from "@/hooks/master-admin";

const openaiModelOptions = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const embeddingModelOptions = [
  { value: "text-embedding-ada-002", label: "text-embedding-ada-002" },
  { value: "text-embedding-3-small", label: "text-embedding-3-small" },
  { value: "text-embedding-3-large", label: "text-embedding-3-large" },
];

interface AISettingsProps {
  settings: AISettingsType;
  onChange: (updates: Partial<AISettingsType>) => void;
}

export function AISettings({ settings, onChange }: AISettingsProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testAIConnection();
      setTestResult({
        success: result.success,
        message: result.message ?? result.error ?? "Unknown result",
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Default AI Provider</h3>
        <RadioGroup
          value={settings.defaultProvider}
          onValueChange={(v) =>
            onChange({ defaultProvider: v as "openai" | "anthropic" | "custom" })
          }
          orientation="horizontal"
        >
          <Radio value="openai">OpenAI</Radio>
          <Radio value="anthropic">Anthropic</Radio>
          <Radio value="custom">Custom</Radio>
        </RadioGroup>
      </Card>

      {settings.defaultProvider === "openai" && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">OpenAI Settings</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input
                label="API Key"
                type="password"
                placeholder="sk-..."
                value={settings.openaiApiKey}
                onValueChange={(v) => onChange({ openaiApiKey: v })}
              />
            </div>
            <Select
              label="Default Model"
              selectedKeys={new Set([settings.openaiDefaultModel])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                onChange({ openaiDefaultModel: selected });
              }}
              options={openaiModelOptions}
            />
            <Select
              label="Embedding Model"
              selectedKeys={new Set([settings.openaiEmbeddingModel])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                onChange({ openaiEmbeddingModel: selected });
              }}
              options={embeddingModelOptions}
            />
          </div>
        </Card>
      )}

      {settings.defaultProvider === "anthropic" && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Anthropic Settings</h3>
          <Input
            label="API Key"
            type="password"
            placeholder="sk-ant-..."
            value={settings.anthropicApiKey}
            onValueChange={(v) => onChange({ anthropicApiKey: v })}
          />
        </Card>
      )}

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Rate Limits</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Max Tokens per Request"
            type="number"
            value={settings.maxTokensPerRequest.toString()}
            onValueChange={(v) =>
              onChange({ maxTokensPerRequest: parseInt(v, 10) || 4096 })
            }
          />
          <Input
            label="Max Requests per Minute"
            type="number"
            value={settings.maxRequestsPerMinute.toString()}
            onValueChange={(v) =>
              onChange({ maxRequestsPerMinute: parseInt(v, 10) || 60 })
            }
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Test Connection</h3>
        <Button
          color="primary"
          variant="flat"
          startContent={<Zap size={16} />}
          onPress={handleTestConnection}
          isLoading={isTesting}
        >
          Test AI Connection
        </Button>
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              testResult.success
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-700"
            }`}
          >
            {testResult.message}
          </div>
        )}
      </Card>
    </div>
  );
}
