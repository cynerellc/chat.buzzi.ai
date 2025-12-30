"use client";

import { Bot, Save } from "lucide-react";
import { use, useState, useEffect, useCallback } from "react";

import type { AgentListItemConfig } from "@/hooks/company/useAgents";

import { AgentAvatarPicker, FormFieldWrapper, FormSection } from "@/components/shared";
import {
  addToast,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  TagInput,
} from "@/components/ui";

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
  const { chatbot, chatbotId, refresh } = useChatbotContext();
  const [editedAgent, setEditedAgent] = useState<AgentListItemConfig | null>(null);
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
    setIsCategoriesLoading(true);
    try {
      const response = await fetch("/api/company/knowledge/categories");
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
  }, []);

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

      const response = await fetch(`/api/company/agents/${chatbotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentsList: updatedAgentsList }),
      });

      if (!response.ok) throw new Error("Failed to update agent");

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

      {/* Avatar Section (Editable) */}
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

      {/* Details Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Agent Details</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Customize the name and designation for this agent
          </p>
        </CardHeader>
        <CardBody>
          <FormSection>
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
          </FormSection>
        </CardBody>
      </Card>

      {/* Knowledge Categories (Editable) - Only show if knowledge base is enabled */}
      {agent.knowledge_base_enabled && (
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Knowledge Categories</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure which knowledge categories this agent can access
          </p>
        </CardHeader>
        <CardBody>
          <FormFieldWrapper
            label="Categories"
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
        </CardBody>
      </Card>
      )}
    </div>
  );
}
