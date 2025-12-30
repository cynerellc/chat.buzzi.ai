"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Bot,
  Key,
  Cpu,
  Gauge,
  CheckCircle,
  XCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button, Card, CardHeader, CardBody, Input, RadioGroup, Radio, Select } from "@/components/ui";
import type { AISettings as AISettingsType } from "@/lib/settings";
import { testAIConnection } from "@/hooks/master-admin";

const openaiModelOptions = [
  // GPT-5 Series (Latest)
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  // GPT-4.1 Series
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  // O-Series (Reasoning)
  { value: "o3", label: "o3 (Reasoning)" },
  { value: "o3-mini", label: "o3-mini (Reasoning)" },
  { value: "o4-mini", label: "o4-mini (Reasoning)" },
  { value: "o1", label: "o1 (Reasoning)" },
  { value: "o1-mini", label: "o1-mini (Reasoning)" },
  // GPT-4o (Legacy)
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const embeddingModelOptions = [
  { value: "text-embedding-ada-002", label: "text-embedding-ada-002" },
  { value: "text-embedding-3-small", label: "text-embedding-3-small" },
  { value: "text-embedding-3-large", label: "text-embedding-3-large" },
];

const providerConfig = {
  openai: {
    label: "OpenAI",
    description: "GPT-4o, GPT-4 Turbo, and more",
    gradient: "from-emerald-500/20 to-emerald-600/10",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  anthropic: {
    label: "Anthropic",
    description: "Claude models",
    gradient: "from-amber-500/20 to-amber-600/10",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  custom: {
    label: "Custom",
    description: "Your own endpoint",
    gradient: "from-violet-500/20 to-violet-600/10",
    iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
};

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

  const currentProvider = providerConfig[settings.defaultProvider];

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Default AI Provider</h3>
              <p className="text-sm text-muted-foreground">Choose your primary AI service</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(providerConfig) as Array<keyof typeof providerConfig>).map((provider) => {
              const config = providerConfig[provider];
              const isSelected = settings.defaultProvider === provider;

              return (
                <motion.button
                  key={provider}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onChange({ defaultProvider: provider })}
                  className={cn(
                    "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2"
                    >
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </motion.div>
                  )}
                  <div className={cn("p-2 rounded-lg", config.iconBg)}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* OpenAI Settings */}
      {settings.defaultProvider === "openai" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold">OpenAI Configuration</h3>
                  <p className="text-sm text-muted-foreground">API credentials and model settings</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
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
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Anthropic Settings */}
      {settings.defaultProvider === "anthropic" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                  <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Anthropic Configuration</h3>
                  <p className="text-sm text-muted-foreground">API credentials for Claude models</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <Input
                label="API Key"
                type="password"
                placeholder="sk-ant-..."
                value={settings.anthropicApiKey}
                onValueChange={(v) => onChange({ anthropicApiKey: v })}
              />
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Rate Limits */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/5">
              <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Rate Limits</h3>
              <p className="text-sm text-muted-foreground">Control API usage and costs</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
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
        </CardBody>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-600/5">
              <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold">Connection Test</h3>
              <p className="text-sm text-muted-foreground">Verify your AI configuration works</p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Button
              variant="outline"
              className="group"
              onPress={handleTestConnection}
              isLoading={isTesting}
            >
              <Zap className="h-4 w-4" />
              Test AI Connection
              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </Button>

            {testResult && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium",
                  testResult.success
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.message}
              </motion.div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
