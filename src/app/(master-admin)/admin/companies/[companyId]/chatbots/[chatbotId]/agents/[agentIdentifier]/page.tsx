"use client";

import { Bot, Save } from "lucide-react";
import { use, useState, useEffect, useCallback } from "react";

import type { AgentListItem } from "@/lib/db/schema/chatbots";

import { AgentAvatarPicker, FormFieldWrapper, FormSection } from "@/components/shared";
import {
  addToast,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  Slider,
  Switch,
  TagInput,
  Textarea,
} from "@/components/ui";
import { updateCompanyChatbot } from "@/hooks/master-admin";
import { MODEL_OPTIONS } from "@/lib/constants";

import { useChatbotContext } from "../../chatbot-context";

interface CategoryWithCounts {
  name: string;
  sourceCount: number;
  faqCount: number;
}

interface AgentPageProps {
  params: Promise<{ agentIdentifier: string }>;
}

export default function AgentDetailPage({ params }: AgentPageProps) {
  const { agentIdentifier } = use(params);
  const { chatbot, companyId, chatbotId, refresh } = useChatbotContext();
  const [editedAgent, setEditedAgent] = useState<AgentListItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);

  const agentsList = chatbot?.agentsList ?? [];
  const agent = agentsList.find((a) => a.agent_identifier === agentIdentifier);

  // Initialize edited agent when agent changes
  useEffect(() => {
    if (agent) {
      setEditedAgent({ ...agent });
    }
  }, [agent]);

  // Fetch available knowledge categories
  const fetchCategories = useCallback(async () => {
    if (!companyId) return;
    setIsCategoriesLoading(true);
    try {
      const response = await fetch(`/api/master-admin/companies/${companyId}/knowledge/categories`);
      if (response.ok) {
        const data = await response.json();
        setAvailableCategories(
          (data.categories as CategoryWithCounts[]).map((c) => c.name)
        );
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsCategoriesLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSave = async () => {
    if (!editedAgent || !chatbot) return;

    setIsSaving(true);
    try {
      const updatedAgentsList = agentsList.map((a) =>
        a.agent_identifier === editedAgent.agent_identifier ? editedAgent : a
      );

      await updateCompanyChatbot(companyId, chatbotId, {
        agentsList: updatedAgentsList,
      });

      addToast({ title: "Agent updated successfully", color: "success" });
      refresh();
    } catch {
      addToast({ title: "Failed to update agent", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!agent || !editedAgent) {
    return (
      <Card className="p-12 text-center">
        <Bot size={48} className="mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="font-semibold mb-2">Agent Not Found</h3>
        <p className="text-muted-foreground">
          The agent you&apos;re looking for doesn&apos;t exist.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot size={24} className="text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{agent.name}</h2>
              <Badge variant={agent.agent_type === "supervisor" ? "info" : "default"}>
                {agent.agent_type}
              </Badge>
            </div>
            {agent.designation && (
              <p className="text-sm text-muted-foreground">{agent.designation}</p>
            )}
          </div>
        </div>
        <Button
          startContent={<Save size={16} />}
          onClick={handleSave}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>

      {/* Details Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Agent Details</h3>
        </CardHeader>
        <CardBody>
          <FormSection>
            {/* Avatar Picker */}
            <div className="flex items-center gap-4 mb-4">
              <AgentAvatarPicker
                value={editedAgent.avatar_url || undefined}
                onChange={(url) =>
                  setEditedAgent((prev) => prev ? { ...prev, avatar_url: url ?? "" } : null)
                }
                agentName={editedAgent.name}
                size="lg"
              />
              <div>
                <p className="text-sm font-medium">Agent Avatar</p>
                <p className="text-xs text-muted-foreground">
                  Click to select a preset or upload custom
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormFieldWrapper label="Name">
                <Input
                  value={editedAgent.name}
                  onChange={(e) =>
                    setEditedAgent((prev) => prev ? { ...prev, name: e.target.value } : null)
                  }
                />
              </FormFieldWrapper>
              <FormFieldWrapper label="Designation">
                <Input
                  value={editedAgent.designation ?? ""}
                  onChange={(e) =>
                    setEditedAgent((prev) => prev ? { ...prev, designation: e.target.value } : null)
                  }
                  placeholder="e.g., Sales Specialist"
                />
              </FormFieldWrapper>
            </div>
            <FormFieldWrapper
              label="Duties"
              description="Brief description of what this agent handles (used by supervisors for routing)"
            >
              <Textarea
                value={editedAgent.routing_prompt ?? ""}
                onChange={(e) =>
                  setEditedAgent((prev) => prev ? { ...prev, routing_prompt: e.target.value } : null)
                }
                rows={3}
                placeholder="e.g., Handles product inquiries, pricing questions, and sales-related requests"
              />
            </FormFieldWrapper>
          </FormSection>
        </CardBody>
      </Card>

      {/* System Prompt Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">System Prompt</h3>
        </CardHeader>
        <CardBody>
          <FormSection>
            <FormFieldWrapper label="System Prompt">
              <Textarea
                value={editedAgent.default_system_prompt}
                onChange={(e) =>
                  setEditedAgent((prev) =>
                    prev ? { ...prev, default_system_prompt: e.target.value } : null
                  )
                }
                rows={10}
                placeholder="Enter the system prompt for this agent..."
                className="font-mono text-sm"
              />
            </FormFieldWrapper>
            <div className="grid grid-cols-2 gap-4">
              <FormFieldWrapper label="Model">
                <Select
                  selectedKeys={new Set([editedAgent.default_model_id])}
                  onSelectionChange={(keys) => {
                    const modelId = Array.from(keys)[0] as string;
                    setEditedAgent((prev) => prev ? { ...prev, default_model_id: modelId } : null);
                  }}
                  options={[...MODEL_OPTIONS]}
                />
              </FormFieldWrapper>
              <FormFieldWrapper label={`Temperature: ${editedAgent.default_temperature}%`}>
                <Slider
                  value={[editedAgent.default_temperature]}
                  onValueChange={(value) => {
                    const temp = value[0];
                    if (temp !== undefined) {
                      setEditedAgent((prev) =>
                        prev ? { ...prev, default_temperature: temp } : null
                      );
                    }
                  }}
                  min={0}
                  max={100}
                  step={1}
                />
              </FormFieldWrapper>
            </div>
          </FormSection>
        </CardBody>
      </Card>

      {/* Knowledge & Tools Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Knowledge & Tools</h3>
        </CardHeader>
        <CardBody>
          <FormSection>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Knowledge Base Access</p>
                <p className="text-sm text-muted-foreground">
                  Allow this agent to search and retrieve information from the knowledge base
                </p>
              </div>
              <Switch
                checked={editedAgent.knowledge_base_enabled ?? false}
                onCheckedChange={(checked) =>
                  setEditedAgent((prev) =>
                    prev ? { ...prev, knowledge_base_enabled: checked } : null
                  )
                }
              />
            </div>
            {editedAgent.knowledge_base_enabled && (
              <FormFieldWrapper
                label="Knowledge Categories"
                description="Select categories this agent can access (leave empty for all categories)"
              >
                <TagInput
                  value={editedAgent.knowledge_categories ?? []}
                  onChange={(categories) =>
                    setEditedAgent((prev) =>
                      prev
                        ? { ...prev, knowledge_categories: categories }
                        : null
                    )
                  }
                  suggestions={availableCategories}
                  placeholder="Search or create categories..."
                  isLoading={isCategoriesLoading}
                  allowCreate={true}
                />
              </FormFieldWrapper>
            )}
            <Card className="p-6 text-center bg-muted/30">
              <p className="text-muted-foreground text-sm">
                Tool configuration will be available in a future update.
              </p>
            </Card>
          </FormSection>
        </CardBody>
      </Card>
    </div>
  );
}
