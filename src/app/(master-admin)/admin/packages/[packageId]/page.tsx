"use client";

import { Plus, Save, Trash2, Users, User, Bot, Variable, ChevronDown, ChevronUp, Lock, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, useCallback } from "react";

import { PageHeader } from "@/components/layouts";
import { AgentAvatarPicker } from "@/components/shared";
import {
  Button,
  Card,
  ConfirmationDialog,
  Input,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  createPackage,
  deletePackage,
  updatePackage,
  usePackage,
  type AgentListItemData,
} from "@/hooks/master-admin";

interface PackageEditorPageProps {
  params: Promise<{ packageId: string }>;
}

// Package variable definition (matches schema)
interface PackageVariableData {
  name: string;
  displayName: string;
  description?: string;
  variableType: "variable" | "secured_variable";
  dataType: "string" | "number" | "boolean" | "json";
  defaultValue?: string;
  required: boolean;
  validationPattern?: string;
  placeholder?: string;
}

interface FormData {
  name: string;
  description: string;
  category: string;
  packageType: "single_agent" | "multi_agent";
  isActive: boolean;
  isPublic: boolean;
  agents: AgentListItemData[];
  variables: PackageVariableData[];
}

const defaultAgentData: AgentListItemData = {
  agent_identifier: "",
  name: "New Agent",
  designation: "",
  routing_prompt: "",
  agent_type: "worker",
  avatar_url: "",
  default_system_prompt: "",
  default_model_id: "gpt-5-mini-2025-08-07",
  model_settings: { temperature: 0.7, max_tokens: 4096, top_p: 1 },
  tools: [],
  managed_agent_ids: [],
  sort_order: 0,
};

const defaultVariableData: PackageVariableData = {
  name: "",
  displayName: "",
  description: "",
  variableType: "variable",
  dataType: "string",
  defaultValue: "",
  required: true,
  placeholder: "",
};

const defaultFormData: FormData = {
  name: "",
  description: "",
  category: "support",
  packageType: "single_agent",
  isActive: true,
  isPublic: true,
  agents: [{ ...defaultAgentData, agent_identifier: crypto.randomUUID().slice(0, 8) }],
  variables: [],
};

const categoryOptions = [
  { value: "support", label: "Customer Support" },
  { value: "sales", label: "Sales Assistant" },
  { value: "faq", label: "FAQ Bot" },
  { value: "custom", label: "Custom" },
];


export default function PackageEditorPage({ params }: PackageEditorPageProps) {
  useSetPageTitle("Package Editor");
  const { packageId } = use(params);
  const router = useRouter();
  const isNewPackage = packageId === "new";
  const { package: pkg, isLoading } = usePackage(isNewPackage ? null : packageId);

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeAgentTab, setActiveAgentTab] = useState("0");
  const [expandedVariables, setExpandedVariables] = useState<Set<number>>(new Set());

  // Load package data when available
  useEffect(() => {
    if (pkg) {
      const agentsList: AgentListItemData[] = pkg.agentsList?.length
        ? pkg.agentsList.map((agent) => ({
          agent_identifier: agent.agent_identifier,
          name: agent.name,
          designation: agent.designation ?? "",
          routing_prompt: agent.routing_prompt ?? "",
          agent_type: agent.agent_type as "worker" | "supervisor",
          avatar_url: agent.avatar_url ?? "",
          default_system_prompt: agent.default_system_prompt,
          default_model_id: agent.default_model_id,
          model_settings: agent.model_settings ?? { temperature: 0.7, max_tokens: 4096, top_p: 1 },
          tools: (agent.tools as unknown[]) ?? [],
          managed_agent_ids: (agent.managed_agent_ids as string[]) ?? [],
          sort_order: agent.sort_order ?? 0,
        }))
        : [{ ...defaultAgentData, agent_identifier: crypto.randomUUID().slice(0, 8) }];

      // Load variables from package
      const packageVariables: PackageVariableData[] = (pkg.variables || []).map((v) => ({
        name: v.name,
        displayName: v.displayName,
        description: v.description ?? "",
        variableType: v.variableType as "variable" | "secured_variable",
        dataType: v.dataType as "string" | "number" | "boolean" | "json",
        defaultValue: v.defaultValue ?? "",
        required: v.required ?? true,
        validationPattern: v.validationPattern ?? "",
        placeholder: v.placeholder ?? "",
      }));

      setFormData({
        name: pkg.name,
        description: pkg.description ?? "",
        category: pkg.category ?? "custom",
        packageType: (pkg.packageType as "single_agent" | "multi_agent") ?? "single_agent",
        isActive: pkg.isActive,
        isPublic: pkg.isPublic,
        agents: agentsList,
        variables: packageVariables,
      });
    }
  }, [pkg]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Package name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Package name must be at least 2 characters";
    }

    // Validate each agent
    formData.agents.forEach((agent, index) => {
      if (!agent.name.trim()) {
        newErrors[`agent_${index}_name`] = "Agent name is required";
      }
      if (!agent.default_system_prompt.trim()) {
        newErrors[`agent_${index}_default_system_prompt`] = "System prompt is required";
      }
    });

    // Validate each variable
    formData.variables.forEach((variable, index) => {
      if (!variable.name.trim()) {
        newErrors[`variable_${index}_name`] = "Variable name is required";
      } else if (!/^[A-Z][A-Z0-9_]*$/.test(variable.name)) {
        newErrors[`variable_${index}_name`] = "Must be UPPERCASE with underscores only";
      }
      if (!variable.displayName.trim()) {
        newErrors[`variable_${index}_displayName`] = "Display name is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category,
        packageType: formData.packageType,
        isActive: formData.isActive,
        isPublic: formData.isPublic,
        agentsList: formData.agents.map((agent, index) => ({
          ...agent,
          sort_order: index,
        })),
        // Variables stored as JSONB array
        variables: formData.variables.map((v) => ({
          name: v.name,
          displayName: v.displayName,
          description: v.description || undefined,
          variableType: v.variableType,
          dataType: v.dataType,
          defaultValue: v.variableType === "secured_variable" ? undefined : (v.defaultValue || undefined),
          required: v.required,
          validationPattern: v.validationPattern || undefined,
          placeholder: v.placeholder || undefined,
        })),
      };

      if (isNewPackage) {
        await createPackage(data);
      } else {
        await updatePackage(packageId, data);
      }

      router.push("/admin/packages");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save package"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePackage(packageId);
      router.push("/admin/packages");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to delete package"
      );
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateAgentField = <K extends keyof AgentListItemData>(
    agentIndex: number,
    field: K,
    value: AgentListItemData[K]
  ) => {
    setFormData((prev) => {
      const newAgents = [...prev.agents];
      const existingAgent = newAgents[agentIndex];
      if (existingAgent) {
        newAgents[agentIndex] = { ...existingAgent, [field]: value };
      }
      return { ...prev, agents: newAgents };
    });
  };

  const addAgent = () => {
    const newAgent: AgentListItemData = {
      ...defaultAgentData,
      agent_identifier: crypto.randomUUID().slice(0, 8),
      name: `Agent ${formData.agents.length + 1}`,
      sort_order: formData.agents.length,
    };
    setFormData((prev) => ({
      ...prev,
      agents: [...prev.agents, newAgent],
    }));
    setActiveAgentTab(String(formData.agents.length));
  };

  const removeAgent = (index: number) => {
    if (formData.agents.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      agents: prev.agents.filter((_, i) => i !== index),
    }));
    if (parseInt(activeAgentTab) >= formData.agents.length - 1) {
      setActiveAgentTab(String(Math.max(0, formData.agents.length - 2)));
    }
  };

  const handlePackageTypeChange = (type: "single_agent" | "multi_agent") => {
    updateField("packageType", type);
    if (type === "single_agent" && formData.agents.length > 1) {
      // Keep only the first agent for single-agent mode
      setFormData((prev) => {
        const firstAgent = prev.agents[0];
        return {
          ...prev,
          agents: firstAgent ? [firstAgent] : prev.agents,
        };
      });
      setActiveAgentTab("0");
    }
  };

  // Variable management functions
  const addVariable = () => {
    const newIndex = formData.variables.length;
    setFormData((prev) => ({
      ...prev,
      variables: [...prev.variables, { ...defaultVariableData }],
    }));
    // Auto-expand newly added variable
    setExpandedVariables((prev) => new Set(prev).add(newIndex));
  };

  const removeVariable = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }));
    // Update expanded indices after removal
    setExpandedVariables((prev) => {
      const newSet = new Set<number>();
      prev.forEach((i) => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  };

  const updateVariableField = <K extends keyof PackageVariableData>(
    varIndex: number,
    field: K,
    value: PackageVariableData[K]
  ) => {
    setFormData((prev) => {
      const newVariables = [...prev.variables];
      const existingVar = newVariables[varIndex];
      if (existingVar) {
        newVariables[varIndex] = { ...existingVar, [field]: value };
      }
      return { ...prev, variables: newVariables };
    });
  };

  const toggleVariableExpanded = (index: number) => {
    setExpandedVariables((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (!isNewPackage && isLoading) {
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

  if (!isNewPackage && !pkg && !isLoading) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Package Not Found</h2>
          <p className="text-muted-foreground">
            The package you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
        </Card>
      </div>
    );
  }

  const getAgentTabs = () =>
    formData.agents.map((agent, index) => ({
      key: String(index),
      label: agent.name || `Agent ${index + 1}`,
      content: <div className="pt-4">{renderAgentForm(index)}</div>,
    }));

  return (
    <div className="p-6">
      <PageHeader
        title={isNewPackage ? "Create Agent Package" : "Edit Agent Package"}
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Packages", href: "/admin/packages" },
          { label: isNewPackage ? "New Package" : (pkg?.name ?? "Edit") },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!isNewPackage && (
              <Button
                variant="secondary"
                color="danger"
                startContent={<Trash2 size={16} />}
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Delete
              </Button>
            )}
            <Button
              color="primary"
              startContent={<Save size={16} />}
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              {isNewPackage ? "Create Package" : "Save Changes"}
            </Button>
          </div>
        }
      />

      {submitError && (
        <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm mb-6">
          {submitError}
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h4 className="font-medium mb-4">Basic Information</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Package Name"
              placeholder="e.g., Customer Support"
              value={formData.name}
              onValueChange={(v) => updateField("name", v)}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              isRequired
            />
            <Select
              label="Category"
              selectedKeys={new Set([formData.category])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                updateField("category", selected ?? "custom");
              }}
              options={categoryOptions}
            />
          </div>
          <Textarea
            label="Description"
            placeholder="Brief description of this package"
            value={formData.description}
            onValueChange={(v) => updateField("description", v)}
            className="mt-4"
            minRows={2}
          />

          {/* Package ID (read-only for existing packages) */}
          {!isNewPackage && pkg && (
            <div className="mt-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                Package ID
              </label>
              <code className="text-sm bg-default-100 px-3 py-2 rounded-lg block">
                {pkg.id}
              </code>
              <p className="text-xs text-muted-foreground mt-1">
                Use this ID in your agent package code: <code>createAgentPackage(&quot;{pkg.id}&quot;, ...)</code>
              </p>
            </div>
          )}
        </Card>

        {/* Package Type Selection */}
        <Card className="p-6">
          <h4 className="font-medium mb-4">Package Type</h4>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handlePackageTypeChange("single_agent")}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${formData.packageType === "single_agent"
                  ? "border-primary bg-primary-50"
                  : "border-default-200 hover:border-default-300"
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formData.packageType === "single_agent" ? "bg-primary-100" : "bg-default-100"
                  }`}>
                  <User size={24} className={formData.packageType === "single_agent" ? "text-primary" : "text-default-500"} />
                </div>
                <div className="text-left">
                  <p className="font-medium">Single Agent</p>
                  <p className="text-sm text-muted-foreground">One AI agent handles all interactions</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePackageTypeChange("multi_agent")}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${formData.packageType === "multi_agent"
                  ? "border-primary bg-primary-50"
                  : "border-default-200 hover:border-default-300"
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formData.packageType === "multi_agent" ? "bg-primary-100" : "bg-default-100"
                  }`}>
                  <Users size={24} className={formData.packageType === "multi_agent" ? "text-primary" : "text-default-500"} />
                </div>
                <div className="text-left">
                  <p className="font-medium">Multi-Agent</p>
                  <p className="text-sm text-muted-foreground">Multiple specialized agents with orchestration</p>
                </div>
              </div>
            </button>
          </div>
        </Card>

        {/* Agents Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <h4 className="font-medium">
                {formData.packageType === "single_agent" ? "Agent Configuration" : "Agents Configuration"}
              </h4>
            </div>
            {formData.packageType === "multi_agent" && (
              <Button
                variant="secondary"
                size="sm"
                startContent={<Plus size={16} />}
                onClick={addAgent}
              >
                Add Agent
              </Button>
            )}
          </div>

          {formData.packageType === "multi_agent" && formData.agents.length > 1 ? (
            <Tabs
              selectedKey={activeAgentTab}
              onSelectionChange={(key) => setActiveAgentTab(key)}
              items={getAgentTabs()}
              className="mb-4"
            />
          ) : (
            renderAgentForm(0)
          )}
        </Card>

        {/* Package Variables */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Variable size={20} />
              <h4 className="font-medium">Package Variables</h4>
            </div>
            <Button
              variant="secondary"
              size="sm"
              startContent={<Plus size={16} />}
              onClick={addVariable}
            >
              Add Variable
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Define configuration variables that can be customized per-agent when deploying this package.
            Secured variables (API keys, secrets) will be encrypted and masked in the UI.
          </p>

          {formData.variables.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-default-200 rounded-lg">
              <Variable className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-sm text-muted-foreground">No variables defined</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add variables for API keys, configuration values, or other settings
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {formData.variables.map((variable, index) => {
                const isExpanded = expandedVariables.has(index);
                const hasError = errors[`variable_${index}_name`] || errors[`variable_${index}_displayName`];

                return (
                  <div
                    key={index}
                    className={`border rounded-lg overflow-hidden transition-all ${hasError ? "border-danger" : "border-default-200"
                      }`}
                  >
                    {/* Collapsed Header - Always Visible */}
                    <div
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-default-50 transition-colors ${isExpanded ? "bg-default-50 border-b border-default-200" : ""
                        }`}
                      onClick={() => toggleVariableExpanded(index)}
                    >
                      {/* Expand/Collapse Icon */}
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-default-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVariableExpanded(index);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        )}
                      </button>

                      {/* Variable Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium truncate">
                            {variable.name || <span className="text-muted-foreground italic">VARIABLE_NAME</span>}
                          </span>
                          {variable.displayName && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground truncate">
                                {variable.displayName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {variable.variableType === "secured_variable" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-warning-100 text-warning-700 rounded-full">
                            <Shield size={12} />
                            Secret
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs font-medium bg-default-100 text-default-600 rounded-full">
                          {variable.dataType}
                        </span>
                        {variable.required && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                            Required
                          </span>
                        )}
                        {hasError && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-danger-100 text-danger-700 rounded-full">
                            Error
                          </span>
                        )}
                      </div>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        color="danger"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeVariable(index);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 bg-default-50">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Input
                            label="Variable Name"
                            placeholder="e.g., API_KEY"
                            value={variable.name}
                            onValueChange={(v) => updateVariableField(index, "name", v.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                            isInvalid={!!errors[`variable_${index}_name`]}
                            errorMessage={errors[`variable_${index}_name`]}
                            description="UPPERCASE with underscores only"
                            isRequired
                          />
                          <Input
                            label="Display Name"
                            placeholder="e.g., API Key"
                            value={variable.displayName}
                            onValueChange={(v) => updateVariableField(index, "displayName", v)}
                            isInvalid={!!errors[`variable_${index}_displayName`]}
                            errorMessage={errors[`variable_${index}_displayName`]}
                            isRequired
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <Select
                            label="Variable Type"
                            selectedKeys={new Set([variable.variableType])}
                            onSelectionChange={(keys) => {
                              const selected = Array.from(keys)[0] as "variable" | "secured_variable";
                              updateVariableField(index, "variableType", selected);
                            }}
                            options={[
                              { value: "variable", label: "Variable" },
                              { value: "secured_variable", label: "Secured (Secret)" },
                            ]}
                          />
                          <Select
                            label="Data Type"
                            selectedKeys={new Set([variable.dataType])}
                            onSelectionChange={(keys) => {
                              const selected = Array.from(keys)[0] as "string" | "number" | "boolean" | "json";
                              updateVariableField(index, "dataType", selected);
                            }}
                            options={[
                              { value: "string", label: "String" },
                              { value: "number", label: "Number" },
                              { value: "boolean", label: "Boolean" },
                              { value: "json", label: "JSON" },
                            ]}
                          />
                          <div className="flex items-end">
                            <Switch
                              isSelected={variable.required}
                              onValueChange={(v) => updateVariableField(index, "required", v)}
                            >
                              Required
                            </Switch>
                          </div>
                        </div>

                        <Input
                          label="Description"
                          placeholder="Brief description of this variable"
                          value={variable.description ?? ""}
                          onValueChange={(v) => updateVariableField(index, "description", v)}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                          {variable.variableType !== "secured_variable" && (
                            <Input
                              label="Default Value"
                              placeholder="Optional default value"
                              value={variable.defaultValue ?? ""}
                              onValueChange={(v) => updateVariableField(index, "defaultValue", v)}
                            />
                          )}
                          <Input
                            label="Placeholder"
                            placeholder="Input placeholder text"
                            value={variable.placeholder ?? ""}
                            onValueChange={(v) => updateVariableField(index, "placeholder", v)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Status */}
        <Card className="p-6">
          <h4 className="font-medium mb-4">Status</h4>
          <div className="flex gap-6">
            <Switch
              isSelected={formData.isActive}
              onValueChange={(v) => updateField("isActive", v)}
            >
              Active
            </Switch>
            <Switch
              isSelected={formData.isPublic}
              onValueChange={(v) => updateField("isPublic", v)}
            >
              Public
            </Switch>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Package"
        message="Are you sure you want to delete this package? This action cannot be undone. Agents using this package will continue to work but will no longer receive updates."
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );

  function renderAgentForm(agentIndex: number) {
    const agent = formData.agents[agentIndex];
    if (!agent) return null;

    return (
      <div className="space-y-4">
        {/* Avatar Picker */}
        <div className="flex items-center gap-4">
          <AgentAvatarPicker
            value={agent.avatar_url || undefined}
            onChange={(url) => updateAgentField(agentIndex, "avatar_url", url ?? "")}
            agentName={agent.name}
            size="lg"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">Agent Avatar</p>
            <p className="text-xs text-muted-foreground">
              Click to select a preset avatar or upload a custom one
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Agent Name"
            placeholder="e.g., Sales Specialist"
            value={agent.name}
            onValueChange={(v) => updateAgentField(agentIndex, "name", v)}
            isInvalid={!!errors[`agent_${agentIndex}_name`]}
            errorMessage={errors[`agent_${agentIndex}_name`]}
            isRequired
            description="This name will appear in the tab above"
          />
          <Input
            label="Designation"
            placeholder="e.g., Senior Support Agent"
            value={agent.designation ?? ""}
            onValueChange={(v) => updateAgentField(agentIndex, "designation", v)}
          />
        </div>

        <Textarea
          label="Duties (Routing Prompt)"
          placeholder="Brief description of this agent's responsibilities for routing decisions..."
          value={agent.routing_prompt ?? ""}
          onValueChange={(v) => updateAgentField(agentIndex, "routing_prompt", v)}
          minRows={2}
          description="Used by the supervisor to route conversations to the right agent"
        />

        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            System Prompt <span className="text-danger">*</span>
          </label>
          <Textarea
            placeholder="Enter the system prompt for this agent..."
            value={agent.default_system_prompt}
            onValueChange={(v) => updateAgentField(agentIndex, "default_system_prompt", v)}
            minRows={6}
            isInvalid={!!errors[`agent_${agentIndex}_default_system_prompt`]}
            errorMessage={errors[`agent_${agentIndex}_default_system_prompt`]}
          />
        </div>

        {/* Agent Identifier (read-only) */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Agent Identifier
          </label>
          <code className="text-sm bg-default-100 px-3 py-2 rounded-lg block">
            {agent.agent_identifier}
          </code>
          <p className="text-xs text-muted-foreground mt-1">
            Use this ID in your code: <code>createBuzziAgent({"{"} agentId: &quot;{agent.agent_identifier}&quot; {"}"})</code>
          </p>
        </div>

        {/* Remove Agent Button (only for multi-agent with more than 1 agent) */}
        {formData.packageType === "multi_agent" && formData.agents.length > 1 && (
          <div className="pt-4 border-t border-divider">
            <Button
              variant="secondary"
              color="danger"
              size="sm"
              startContent={<Trash2 size={14} />}
              onClick={() => removeAgent(agentIndex)}
            >
              Remove this Agent
            </Button>
          </div>
        )}
      </div>
    );
  }
}
