"use client";

import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";

import {
  Button,
  Select,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Textarea,
} from "@/components/ui";

import type { AgentDetail } from "@/hooks/company/useAgents";

interface PromptTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
}

const DEFAULT_PROMPT = `You are a helpful customer support agent for {company_name}.

Your name is {agent_name} and your role is to:
- Answer customer questions accurately and helpfully
- Help resolve issues efficiently
- Escalate complex issues to human agents when needed

Guidelines:
- Be professional, friendly, and concise
- Use the knowledge base to find accurate answers
- Ask clarifying questions when the request is unclear
- If you cannot help, offer to connect to a human agent

Current date: {current_date}`;

const AI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Most capable)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast & cost-effective)" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (Balanced)" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku (Fast)" },
];

export function PromptTab({ agent, onSave, isSaving }: PromptTabProps) {
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [modelId, setModelId] = useState(agent.modelId);
  const [temperature, setTemperature] = useState(agent.temperature);

  useEffect(() => {
    setSystemPrompt(agent.systemPrompt);
    setModelId(agent.modelId);
    setTemperature(agent.temperature);
  }, [agent]);

  const handleSave = async () => {
    await onSave({
      systemPrompt,
      modelId,
      temperature,
    });
  };

  const handleResetPrompt = () => {
    setSystemPrompt(DEFAULT_PROMPT);
  };

  const hasChanges =
    systemPrompt !== agent.systemPrompt ||
    modelId !== agent.modelId ||
    temperature !== agent.temperature;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">System Prompt</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              The system prompt defines your agent&apos;s personality and behavior.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Available variables:</span>
              <Badge variant="secondary">{"{company_name}"}</Badge>
              <Badge variant="secondary">{"{agent_name}"}</Badge>
              <Badge variant="secondary">{"{current_date}"}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">System Prompt</label>
              <Button
                variant="ghost"
                size="sm"
                onPress={handleResetPrompt}
                leftIcon={RotateCcw}
              >
                Reset to Default
              </Button>
            </div>
            <Textarea
              value={systemPrompt}
              onValueChange={setSystemPrompt}
              minRows={12}
              classNames={{
                input: "font-mono text-sm",
              }}
            />
            <p className="text-sm text-muted-foreground text-right">
              {systemPrompt.length} / 4000 characters
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">AI Configuration</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Model Selection */}
          <Select
            label="AI Model"
            options={AI_MODELS}
            selectedKeys={new Set([modelId])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              if (selected) setModelId(selected as string);
            }}
          />

          {/* Temperature */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Temperature</label>
              <span className="text-sm text-muted-foreground">
                {(temperature / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Precise</span>
              <input
                type="range"
                value={temperature}
                onChange={(e) => setTemperature(parseInt(e.target.value))}
                min={0}
                max={100}
                step={1}
                className="flex-1 h-2 rounded-full bg-muted appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <span className="text-sm text-muted-foreground">Creative</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Lower values make responses more focused and deterministic. Higher
              values make responses more creative and varied.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" isDisabled>
          Test Prompt
        </Button>
        <Button
          color="primary"
          onPress={handleSave}
          isDisabled={!hasChanges}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
