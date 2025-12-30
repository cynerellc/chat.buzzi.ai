"use client";

import { AlertTriangle, Save } from "lucide-react";
import { useState, useEffect } from "react";

import { FormSection, FormFieldWrapper } from "@/components/shared";
import { Button, Card, Switch, Slider, addToast } from "@/components/ui";

interface ChatbotBehavior {
  maxTurnsBeforeEscalation?: number;
  autoEscalateOnSentiment?: boolean;
  sentimentThreshold?: number;
  [key: string]: unknown;
}

interface ChatbotData {
  escalationEnabled?: boolean;
  behavior?: ChatbotBehavior | null;
}

interface EscalationSettingsProps {
  chatbot: ChatbotData | null;
  apiUrl: string;
  onRefresh: () => void;
}

export function EscalationSettings({ chatbot, apiUrl, onRefresh }: EscalationSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    escalationEnabled: false,
    maxTurnsBeforeEscalation: 5,
    autoEscalateOnSentiment: false,
    sentimentThreshold: 30,
  });

  useEffect(() => {
    if (chatbot) {
      const behavior = chatbot.behavior as ChatbotBehavior | undefined;
      setFormData({
        escalationEnabled: chatbot.escalationEnabled ?? false,
        maxTurnsBeforeEscalation: behavior?.maxTurnsBeforeEscalation ?? 5,
        autoEscalateOnSentiment: behavior?.autoEscalateOnSentiment ?? false,
        sentimentThreshold: behavior?.sentimentThreshold ?? 30,
      });
    }
  }, [chatbot]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escalationEnabled: formData.escalationEnabled,
          behavior: {
            ...chatbot?.behavior,
            maxTurnsBeforeEscalation: formData.maxTurnsBeforeEscalation,
            autoEscalateOnSentiment: formData.autoEscalateOnSentiment,
            sentimentThreshold: formData.sentimentThreshold,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to update escalation settings");

      addToast({ title: "Escalation settings updated", color: "success" });
      onRefresh();
    } catch {
      addToast({ title: "Failed to update escalation settings", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!chatbot) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Escalation Rules</h2>
          <p className="text-sm text-muted-foreground">
            Configure when and how conversations are escalated to human agents
          </p>
        </div>
        <Button startContent={<Save size={16} />} onClick={handleSave} isLoading={isSaving}>
          Save Changes
        </Button>
      </div>

      <Card className="p-6">
        <FormSection title="Escalation Settings">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Enable Escalation</p>
              <p className="text-sm text-muted-foreground">
                Allow conversations to be escalated to human agents
              </p>
            </div>
            <Switch
              checked={formData.escalationEnabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, escalationEnabled: checked }))
              }
            />
          </div>
        </FormSection>
      </Card>

      {formData.escalationEnabled && (
        <>
          <Card className="p-6">
            <FormSection title="Turn-Based Escalation">
              <FormFieldWrapper
                label={`Escalate after ${formData.maxTurnsBeforeEscalation} turns without resolution`}
              >
                <Slider
                  value={[formData.maxTurnsBeforeEscalation]}
                  onValueChange={(value) => {
                    const turns = value[0];
                    if (turns !== undefined) {
                      setFormData((prev) => ({
                        ...prev,
                        maxTurnsBeforeEscalation: turns,
                      }));
                    }
                  }}
                  min={2}
                  max={20}
                  step={1}
                />
              </FormFieldWrapper>
            </FormSection>
          </Card>

          <Card className="p-6">
            <FormSection title="Sentiment-Based Escalation">
              <div className="flex items-center justify-between py-2 mb-4">
                <div>
                  <p className="font-medium">Auto-escalate on negative sentiment</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically escalate when customer sentiment is negative
                  </p>
                </div>
                <Switch
                  checked={formData.autoEscalateOnSentiment}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, autoEscalateOnSentiment: checked }))
                  }
                />
              </div>

              {formData.autoEscalateOnSentiment && (
                <FormFieldWrapper
                  label={`Sentiment threshold: ${formData.sentimentThreshold}%`}
                  description="Escalate when sentiment score falls below this threshold"
                >
                  <Slider
                    value={[formData.sentimentThreshold]}
                    onValueChange={(value) => {
                      const threshold = value[0];
                      if (threshold !== undefined) {
                        setFormData((prev) => ({
                          ...prev,
                          sentimentThreshold: threshold,
                        }));
                      }
                    }}
                    min={10}
                    max={50}
                    step={5}
                  />
                </FormFieldWrapper>
              )}
            </FormSection>
          </Card>
        </>
      )}

      {!formData.escalationEnabled && (
        <Card className="p-12 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">Escalation Disabled</h3>
          <p className="text-muted-foreground">
            Enable escalation above to configure escalation rules.
          </p>
        </Card>
      )}
    </div>
  );
}
