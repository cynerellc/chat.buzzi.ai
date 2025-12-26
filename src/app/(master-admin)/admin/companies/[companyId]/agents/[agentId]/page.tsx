"use client";

import { format } from "date-fns";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Code,
  MessageSquare,
  Package,
  Pencil,
  Save,
  Settings,
  Sliders,
  Trash2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import useSWR from "swr";

import { PageHeader } from "@/components/layouts";
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  Input,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  type BadgeVariant,
  type TabItem,
} from "@/components/ui";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

interface AgentDetails {
  id: string;
  name: string;
  description: string | null;
  packageId: string;
  packageName: string;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  behavior: Record<string, unknown>;
  isActive: boolean;
  conversationCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CompanyData {
  id: string;
  name: string;
  slug: string;
}

interface PackageOption {
  id: string;
  name: string;
  category: string | null;
}

interface AgentConfigurationPageProps {
  params: Promise<{ companyId: string; agentId: string }>;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  inactive: "default",
};

const modelOptions = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
];

export default function AgentConfigurationPage({
  params,
}: AgentConfigurationPageProps) {
  const { companyId, agentId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("settings");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    packageId: "",
    systemPrompt: "",
    modelId: "gpt-4o-mini",
    temperature: 70,
    isActive: true,
    maxTokens: 2048,
    responseFormat: "text",
  });

  // Fetch company details
  const { data: companyData, isLoading: companyLoading } = useSWR<CompanyData>(
    `/api/master-admin/companies/${companyId}`,
    fetcher
  );

  // Fetch agent details
  const {
    data: agentData,
    isLoading: agentLoading,
    mutate: refreshAgent,
  } = useSWR<AgentDetails>(
    `/api/master-admin/companies/${companyId}/agents/${agentId}`,
    fetcher
  );

  // Fetch available packages
  const { data: packagesData } = useSWR<{ packages: PackageOption[] }>(
    "/api/master-admin/packages?isActive=true",
    fetcher
  );

  // Initialize form data when agent data loads
  useEffect(() => {
    if (agentData) {
      setFormData({
        name: agentData.name,
        description: agentData.description ?? "",
        packageId: agentData.packageId,
        systemPrompt: agentData.systemPrompt,
        modelId: agentData.modelId,
        temperature: agentData.temperature,
        isActive: agentData.isActive,
        maxTokens: (agentData.behavior?.maxTokens as number) ?? 2048,
        responseFormat:
          (agentData.behavior?.responseFormat as string) ?? "text",
      });
    }
  }, [agentData]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/master-admin/companies/${companyId}/agents/${agentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            packageId: formData.packageId,
            systemPrompt: formData.systemPrompt,
            modelId: formData.modelId,
            temperature: formData.temperature,
            isActive: formData.isActive,
            behavior: {
              maxTokens: formData.maxTokens,
              responseFormat: formData.responseFormat,
            },
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to save agent");
      }

      refreshAgent();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/master-admin/companies/${companyId}/agents/${agentId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Failed to delete agent");
      }

      router.push(`/admin/companies/${companyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCancel = () => {
    if (agentData) {
      setFormData({
        name: agentData.name,
        description: agentData.description ?? "",
        packageId: agentData.packageId,
        systemPrompt: agentData.systemPrompt,
        modelId: agentData.modelId,
        temperature: agentData.temperature,
        isActive: agentData.isActive,
        maxTokens: (agentData.behavior?.maxTokens as number) ?? 2048,
        responseFormat:
          (agentData.behavior?.responseFormat as string) ?? "text",
      });
    }
    setIsEditing(false);
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isLoading = companyLoading || agentLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (!companyData || !agentData) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Bot size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Agent Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The agent you&apos;re looking for doesn&apos;t exist or has been
            deleted.
          </p>
          <Button
            variant="secondary"
            startContent={<ArrowLeft size={16} />}
            onClick={() => router.push(`/admin/companies/${companyId}`)}
          >
            Back to Company
          </Button>
        </Card>
      </div>
    );
  }

  const packageOptions =
    packagesData?.packages?.map((p) => ({
      value: p.id,
      label: p.name,
    })) ?? [];

  const tabs: TabItem[] = [
    { key: "settings", label: "Settings", icon: Settings },
    { key: "prompt", label: "System Prompt", icon: Code },
    { key: "behavior", label: "Behavior", icon: Sliders },
    { key: "stats", label: "Statistics", icon: Zap },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title=""
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Companies", href: "/admin/companies" },
          { label: companyData.name, href: `/admin/companies/${companyId}` },
          { label: "Agents" },
          { label: agentData.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  startContent={<Save size={16} />}
                  onClick={handleSave}
                  isLoading={isSaving}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  color="danger"
                  startContent={<Trash2 size={16} />}
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  startContent={<Pencil size={16} />}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Agent Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-4 rounded-xl bg-primary-100">
          <Bot size={32} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{agentData.name}</h1>
            <Badge
              variant={
                statusBadgeVariants[agentData.isActive ? "active" : "inactive"]
              }
              size="sm"
            >
              {agentData.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {agentData.description ?? "No description"} &bull; Using{" "}
            {agentData.packageName}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        items={tabs}
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="mb-6"
      />

      {/* Tab Content */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Basic Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Agent Name"
                value={formData.name}
                onValueChange={(v) => updateField("name", v)}
                readOnly={!isEditing}
                required
              />
              <Select
                label="Agent Package"
                selectedKeys={
                  formData.packageId ? new Set([formData.packageId]) : new Set()
                }
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  updateField("packageId", selected ?? "");
                }}
                options={packageOptions}
                disabled={!isEditing}
              />
            </div>
            <Textarea
              label="Description"
              value={formData.description}
              onValueChange={(v) => updateField("description", v)}
              className="mt-4"
              minRows={2}
              readOnly={!isEditing}
            />
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Model Configuration</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="AI Model"
                selectedKeys={new Set([formData.modelId])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  updateField("modelId", selected ?? "gpt-4o-mini");
                }}
                options={modelOptions}
                disabled={!isEditing}
              />
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Temperature: {formData.temperature}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.temperature}
                  onChange={(e) =>
                    updateField("temperature", parseInt(e.target.value))
                  }
                  className="w-full accent-primary"
                  disabled={!isEditing}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Status</h3>
            <Switch
              isSelected={formData.isActive}
              onValueChange={(v) => updateField("isActive", v)}
              disabled={!isEditing}
            >
              Agent is active and can handle conversations
            </Switch>
          </Card>
        </div>
      )}

      {activeTab === "prompt" && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">System Prompt</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This prompt defines the agent&apos;s behavior, personality, and
            capabilities.
          </p>
          <Textarea
            value={formData.systemPrompt}
            onValueChange={(v) => updateField("systemPrompt", v)}
            minRows={15}
            readOnly={!isEditing}
            className="font-mono text-sm"
          />
        </Card>
      )}

      {activeTab === "behavior" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Response Settings</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                type="number"
                label="Max Tokens"
                value={String(formData.maxTokens)}
                onValueChange={(v) => updateField("maxTokens", parseInt(v) || 2048)}
                readOnly={!isEditing}
                description="Maximum length of the agent's response"
              />
              <Select
                label="Response Format"
                selectedKeys={new Set([formData.responseFormat])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  updateField("responseFormat", selected ?? "text");
                }}
                options={[
                  { value: "text", label: "Plain Text" },
                  { value: "markdown", label: "Markdown" },
                  { value: "json", label: "JSON" },
                ]}
                disabled={!isEditing}
              />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Advanced Behavior</h3>
            <p className="text-sm text-muted-foreground">
              Additional behavior configuration options will be available in a
              future update.
            </p>
          </Card>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-100">
                <MessageSquare size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversations</p>
                <p className="text-2xl font-bold">
                  {agentData.conversationCount.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-100">
                <Zap size={20} className="text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Messages</p>
                <p className="text-2xl font-bold">
                  {agentData.messageCount.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning-100">
                <Package size={20} className="text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Package</p>
                <p className="text-lg font-semibold truncate">
                  {agentData.packageName}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info-100">
                <Calendar size={20} className="text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-lg font-semibold">
                  {format(new Date(agentData.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Agent"
        message={`Are you sure you want to delete "${agentData.name}"? This action cannot be undone. All conversation history associated with this agent will be preserved but the agent will no longer be available.`}
        confirmLabel="Delete Agent"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
