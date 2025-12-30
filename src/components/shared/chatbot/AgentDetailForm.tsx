"use client";

import { Bot, Save } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

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
import { MODEL_OPTIONS } from "@/lib/constants";

interface AgentData {
  agent_identifier: string;
  agent_type: string;
  name: string;
  designation?: string | null;
  avatar_url?: string | null;
  routing_prompt?: string | null;
  default_system_prompt: string;
  default_model_id: string;
  default_temperature: number;
  knowledge_base_enabled?: boolean | null;
  knowledge_categories?: string[] | null;
}

interface CategoryWithCounts {
  name: string;
  sourceCount: number;
  faqCount: number;
}

interface AgentDetailFormProps {
  agent: AgentData | null;
  agentsList: AgentData[];
  apiUrl: string;
  categoriesApiUrl: string;
  onRefresh: () => void;
  showAISettings?: boolean;
  showKnowledgeToggle?: boolean;
  showRoutingPrompt?: boolean;
}

export function AgentDetailForm({
  agent,
  agentsList,
  apiUrl,
  categoriesApiUrl,
  onRefresh,
  showAISettings = false,
  showKnowledgeToggle = false,
  showRoutingPrompt = false,
}: AgentDetailFormProps) {
  const [editedAgent, setEditedAgent] = useState<AgentData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);

  // Initialize edited agent when agent changes
  useEffect(() => {
    if (agent) {
      setEditedAgent({ ...agent });
    }
  }, [agent]);

  // Fetch available knowledge categories
  const fetchCategories = useCallback(async () => {
    setIsCategoriesLoading(true);
    try {
      const response = await fetch(categoriesApiUrl);
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
  }, [categoriesApiUrl]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSave = async () => {
    if (!editedAgent) return;

    setIsSaving(true);
    try {
      const updatedAgentsList = agentsList.map((a) =>
        a.agent_identifier === editedAgent.agent_identifier ? editedAgent : a
      );

      const response = await fetch(apiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentsList: updatedAgentsList }),
      });

      if (!response.ok) throw new Error("Failed to update agent");

      addToast({ title: "Agent updated successfully", color: "success" });
      onRefresh();
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

  const showKnowledgeCategories = showKnowledgeToggle
    ? editedAgent.knowledge_base_enabled
    : agent.knowledge_base_enabled;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {editedAgent.avatar_url ? (
            <img
              src={editedAgent.avatar_url}
              alt={editedAgent.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot size={24} className="text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{editedAgent.name}</h2>
              <Badge variant={editedAgent.agent_type === "supervisor" ? "info" : "default"}>
                {editedAgent.agent_type}
              </Badge>
            </div>
            {editedAgent.designation && (
              <p className="text-sm text-muted-foreground">{editedAgent.designation}</p>
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

      {/* Avatar Section - Only show separate card when NOT showing AI settings */}
      {!showAISettings && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Agent Avatar</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Customize the avatar for this agent
            </p>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-4">
              <AgentAvatarPicker
                value={editedAgent.avatar_url || undefined}
                onChange={(url) =>
                  setEditedAgent((prev) => prev ? { ...prev, avatar_url: url ?? "" } : null)
                }
                agentName={editedAgent.name}
                size="lg"
              />
              <div>
                <p className="text-sm font-medium">Click to change avatar</p>
                <p className="text-xs text-muted-foreground">
                  Select a preset or upload a custom image
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Details Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Agent Details</h3>
          {!showAISettings && (
            <p className="text-xs text-muted-foreground mt-1">
              Customize the name and designation for this agent
            </p>
          )}
        </CardHeader>
        <CardBody>
          <FormSection>
            {/* Avatar Picker - Inline when showing AI settings */}
            {showAISettings && (
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
            )}
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
            {showRoutingPrompt && (
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
            )}
          </FormSection>
        </CardBody>
      </Card>

      {/* System Prompt Section - Only for master admin */}
      {showAISettings && (
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
      )}

      {/* Knowledge Section */}
      {(showKnowledgeToggle || showKnowledgeCategories) && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">
              {showKnowledgeToggle ? "Knowledge & Tools" : "Knowledge Categories"}
            </h3>
            {!showKnowledgeToggle && (
              <p className="text-xs text-muted-foreground mt-1">
                Configure which knowledge categories this agent can access
              </p>
            )}
          </CardHeader>
          <CardBody>
            <FormSection>
              {showKnowledgeToggle && (
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
              )}
              {showKnowledgeCategories && (
                <FormFieldWrapper
                  label={showKnowledgeToggle ? "Knowledge Categories" : "Categories"}
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
              {showKnowledgeToggle && (
                <Card className="p-6 text-center bg-muted/30">
                  <p className="text-muted-foreground text-sm">
                    Tool configuration will be available in a future update.
                  </p>
                </Card>
              )}
            </FormSection>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
