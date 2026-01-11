"use client";

import { useState, useEffect } from "react";
import { Bot, Upload } from "lucide-react";

import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardBody,
  Textarea,
  RadioGroup,
  Radio,
} from "@/components/ui";

import type { ChatbotDetail } from "@/hooks/company/useChatbots";

interface GeneralTabProps {
  agent: ChatbotDetail;
  onSave: (data: Partial<ChatbotDetail>) => Promise<void>;
  isSaving: boolean;
}

const TYPE_OPTIONS = [
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "faq", label: "FAQ" },
  { value: "custom", label: "Custom" },
];

export function GeneralTab({ agent, onSave, isSaving }: GeneralTabProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || "");
  const [welcomeMessage, setWelcomeMessage] = useState(
    agent.behavior?.greeting || "Hello! How can I help you today?"
  );
  const [status, setStatus] = useState(agent.status);
  const [type, setType] = useState(agent.type);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync state with prop changes
    setName(agent.name);
    setDescription(agent.description || "");
    setWelcomeMessage(agent.behavior?.greeting || "Hello! How can I help you today?");
    setStatus(agent.status);
    setType(agent.type);
  }, [agent]);

  const handleSave = async () => {
    await onSave({
      name,
      description,
      status: status as "active" | "paused" | "draft",
      type: type as "support" | "sales" | "faq" | "custom",
      behavior: {
        ...agent.behavior,
        greeting: welcomeMessage,
      },
    });
  };

  const hasChanges =
    name !== agent.name ||
    description !== (agent.description || "") ||
    welcomeMessage !== (agent.behavior?.greeting || "Hello! How can I help you today?") ||
    status !== agent.status ||
    type !== agent.type;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">General Settings</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Avatar */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent Avatar</label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                {agent.avatarUrl ? (
                  <img
                    src={agent.avatarUrl}
                    alt={agent.name}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <Bot className="h-10 w-10 text-primary" />
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" isDisabled leftIcon={Upload}>
                  Upload Image
                </Button>
              </div>
            </div>
          </div>

          {/* Name */}
          <Input
            label="Agent Name"
            value={name}
            onValueChange={setName}
            placeholder="e.g., Support Bot"
            isRequired
          />

          {/* Description */}
          <Textarea
            label="Description"
            value={description}
            onValueChange={setDescription}
            placeholder="Describe what this agent does..."
            minRows={3}
          />

          {/* Type */}
          <Select
            label="Agent Type"
            options={TYPE_OPTIONS}
            selectedKeys={new Set([type])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              if (selected) setType(selected as typeof type);
            }}
          />

          {/* Welcome Message */}
          <Textarea
            label="Welcome Message"
            value={welcomeMessage}
            onValueChange={setWelcomeMessage}
            placeholder="Hi! How can I help you today?"
            minRows={2}
            description="This message is shown when a customer starts a new conversation"
          />

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <RadioGroup value={status} onValueChange={setStatus}>
              <Radio value="active" id="active">
                Active - Agent is live and handling conversations
              </Radio>
              <Radio value="paused" id="paused">
                Paused - Agent is temporarily disabled
              </Radio>
              <Radio value="draft" id="draft">
                Draft - Agent is not yet deployed
              </Radio>
            </RadioGroup>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
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
