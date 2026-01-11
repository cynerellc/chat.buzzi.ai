"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";

import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Switch,
  RadioGroup,
  Radio,
} from "@/components/ui";

import type { ChatbotDetail } from "@/hooks/company/useChatbots";

interface EscalationTabProps {
  agent: ChatbotDetail;
  onSave: (data: Partial<ChatbotDetail>) => Promise<void>;
  isSaving: boolean;
}

interface EscalationConfig {
  customerRequest: boolean;
  negativeSentiment: boolean;
  sentimentThreshold: "low" | "medium" | "high";
  lowConfidence: boolean;
  confidenceThreshold: number;
  maxMessages: boolean;
  maxMessageCount: number;
  keywords: string[];
  assignmentRule: "first_available" | "specific_team" | "round_robin";
  notifyEmail: boolean;
  notifySlack: boolean;
  notifySound: boolean;
}

const DEFAULT_CONFIG: EscalationConfig = {
  customerRequest: true,
  negativeSentiment: true,
  sentimentThreshold: "high",
  lowConfidence: true,
  confidenceThreshold: 60,
  maxMessages: true,
  maxMessageCount: 10,
  keywords: ["refund", "cancel", "legal", "lawsuit"],
  assignmentRule: "first_available",
  notifyEmail: true,
  notifySlack: true,
  notifySound: true,
};

const SENTIMENT_OPTIONS = [
  { value: "low", label: "Low Confidence" },
  { value: "medium", label: "Medium Confidence" },
  { value: "high", label: "High Confidence" },
];

export function EscalationTab({ agent, onSave, isSaving }: EscalationTabProps) {
  const [config, setConfig] = useState<EscalationConfig>(DEFAULT_CONFIG);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    // Load config from agent behavior if available
    const behavior = agent.behavior as Record<string, unknown>;
    if (behavior?.escalationConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync state with prop changes
      setConfig({ ...DEFAULT_CONFIG, ...(behavior.escalationConfig as EscalationConfig) });
    }
  }, [agent]);

  const updateConfig = <K extends keyof EscalationConfig>(
    key: K,
    value: EscalationConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !config.keywords.includes(newKeyword.trim().toLowerCase())) {
      updateConfig("keywords", [...config.keywords, newKeyword.trim().toLowerCase()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    updateConfig(
      "keywords",
      config.keywords.filter((k) => k !== keyword)
    );
  };

  const handleSave = async () => {
    await onSave({
      escalationEnabled: agent.escalationEnabled,
      behavior: {
        ...(agent.behavior as Record<string, unknown>),
        escalationConfig: config,
        maxTurnsBeforeEscalation: config.maxMessages ? config.maxMessageCount : undefined,
        autoEscalateOnSentiment: config.negativeSentiment,
        sentimentThreshold:
          config.sentimentThreshold === "low"
            ? -0.3
            : config.sentimentThreshold === "medium"
              ? -0.5
              : -0.7,
      } as typeof agent.behavior,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Escalation Rules</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure when conversations should be escalated to human agents.
          </p>

          <div className="space-y-4">
            <h3 className="font-medium border-b pb-2">
              Automatic Escalation Triggers
            </h3>

            {/* Customer Request */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <span className="font-medium">Customer requests human agent</span>
                <p className="text-sm text-muted-foreground">
                  When customer explicitly asks to speak to a human
                </p>
              </div>
              <Switch
                isSelected={config.customerRequest}
                onValueChange={(v) => updateConfig("customerRequest", v)}
              />
            </div>

            {/* Negative Sentiment */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Negative sentiment detected</span>
                  <p className="text-sm text-muted-foreground">
                    Escalate when customer frustration is detected
                  </p>
                </div>
                <Switch
                  isSelected={config.negativeSentiment}
                  onValueChange={(v) => updateConfig("negativeSentiment", v)}
                />
              </div>
              {config.negativeSentiment && (
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium">Threshold</label>
                  <Select
                    options={SENTIMENT_OPTIONS}
                    selectedKeys={new Set([config.sentimentThreshold])}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0];
                      if (selected) updateConfig("sentimentThreshold", selected as "low" | "medium" | "high");
                    }}
                    className="max-w-xs"
                  />
                </div>
              )}
            </div>

            {/* Low Confidence */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">AI confidence too low</span>
                  <p className="text-sm text-muted-foreground">
                    Escalate when AI is uncertain about the response
                  </p>
                </div>
                <Switch
                  isSelected={config.lowConfidence}
                  onValueChange={(v) => updateConfig("lowConfidence", v)}
                />
              </div>
              {config.lowConfidence && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Confidence threshold</label>
                    <span className="text-sm text-muted-foreground">
                      {config.confidenceThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    value={config.confidenceThreshold}
                    onChange={(e) => updateConfig("confidenceThreshold", parseInt(e.target.value))}
                    min={40}
                    max={90}
                    step={5}
                    className="w-full h-2 rounded-full bg-muted appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                </div>
              )}
            </div>

            {/* Max Messages */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Max messages without resolution</span>
                  <p className="text-sm text-muted-foreground">
                    Escalate after too many back-and-forth messages
                  </p>
                </div>
                <Switch
                  isSelected={config.maxMessages}
                  onValueChange={(v) => updateConfig("maxMessages", v)}
                />
              </div>
              {config.maxMessages && (
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium">Message count</label>
                  <Input
                    type="number"
                    value={config.maxMessageCount.toString()}
                    onValueChange={(v) =>
                      updateConfig("maxMessageCount", parseInt(v) || 10)
                    }
                    className="max-w-[100px]"
                  />
                </div>
              )}
            </div>

            {/* Keywords */}
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <span className="font-medium">Specific keywords detected</span>
                <p className="text-sm text-muted-foreground">
                  Escalate when sensitive keywords are mentioned
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeKeyword(keyword)}
                  >
                    {keyword} x
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onValueChange={setNewKeyword}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Assignment Rules</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="mb-3 block font-medium">When escalated, assign to:</label>
            <RadioGroup
              value={config.assignmentRule}
              onValueChange={(v) =>
                updateConfig("assignmentRule", v as EscalationConfig["assignmentRule"])
              }
            >
              <Radio value="first_available" id="first_available">
                First available agent
              </Radio>
              <Radio value="round_robin" id="round_robin">
                Round robin
              </Radio>
              <Radio value="specific_team" id="specific_team">
                Specific team
              </Radio>
            </RadioGroup>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Notification Settings</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Notify via email</span>
            <Switch
              isSelected={config.notifyEmail}
              onValueChange={(v) => updateConfig("notifyEmail", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Notify via Slack (if connected)</span>
            <Switch
              isSelected={config.notifySlack}
              onValueChange={(v) => updateConfig("notifySlack", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Play sound notification in dashboard</span>
            <Switch
              isSelected={config.notifySound}
              onValueChange={(v) => updateConfig("notifySound", v)}
            />
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button color="primary" onPress={handleSave} isLoading={isSaving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
