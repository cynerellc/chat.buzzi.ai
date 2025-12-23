"use client";

import { Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { PageHeader } from "@/components/layouts";
import { SystemPromptEditor } from "@/components/master-admin/packages";
import {
  Button,
  Card,
  ConfirmationDialog,
  Input,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui";
import {
  createPackage,
  deletePackage,
  updatePackage,
  usePackage,
} from "@/hooks/master-admin";

interface PackageEditorPageProps {
  params: Promise<{ packageId: string }>;
}

interface FormData {
  name: string;
  description: string;
  category: string;
  defaultSystemPrompt: string;
  defaultModelId: string;
  defaultTemperature: number;
  isActive: boolean;
  isPublic: boolean;
}

const defaultFormData: FormData = {
  name: "",
  description: "",
  category: "support",
  defaultSystemPrompt: "",
  defaultModelId: "gpt-4o-mini",
  defaultTemperature: 70,
  isActive: true,
  isPublic: true,
};

const categoryOptions = [
  { value: "support", label: "Customer Support" },
  { value: "sales", label: "Sales Assistant" },
  { value: "faq", label: "FAQ Bot" },
  { value: "custom", label: "Custom" },
];

const modelOptions = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "claude-3-opus", label: "Claude 3 Opus" },
];

export default function PackageEditorPage({ params }: PackageEditorPageProps) {
  const { packageId } = use(params);
  const router = useRouter();
  const isNewPackage = packageId === "new";
  const { package: pkg, isLoading } = usePackage(isNewPackage ? null : packageId);

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load package data when available
  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name,
        description: pkg.description ?? "",
        category: pkg.category ?? "custom",
        defaultSystemPrompt: pkg.defaultSystemPrompt,
        defaultModelId: pkg.defaultModelId,
        defaultTemperature: pkg.defaultTemperature,
        isActive: pkg.isActive,
        isPublic: pkg.isPublic,
      });
    }
  }, [pkg]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Package name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Package name must be at least 2 characters";
    }

    if (!formData.defaultSystemPrompt.trim()) {
      newErrors.defaultSystemPrompt = "System prompt is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category,
        defaultSystemPrompt: formData.defaultSystemPrompt,
        defaultModelId: formData.defaultModelId,
        defaultTemperature: formData.defaultTemperature,
        isActive: formData.isActive,
        isPublic: formData.isPublic,
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
          <p className="text-default-500">
            The package you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
        </Card>
      </div>
    );
  }

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
                variant="flat"
                color="danger"
                startContent={<Trash2 size={16} />}
                onPress={() => setIsDeleteDialogOpen(true)}
              >
                Delete
              </Button>
            )}
            <Button
              color="primary"
              startContent={<Save size={16} />}
              onPress={handleSubmit}
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
        </Card>

        {/* System Prompt */}
        <SystemPromptEditor
          value={formData.defaultSystemPrompt}
          onChange={(v) => updateField("defaultSystemPrompt", v)}
        />
        {errors.defaultSystemPrompt && (
          <p className="text-sm text-danger -mt-4">{errors.defaultSystemPrompt}</p>
        )}

        {/* Default Settings */}
        <Card className="p-6">
          <h4 className="font-medium mb-4">Default Settings</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Default Model"
              selectedKeys={new Set([formData.defaultModelId])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                updateField("defaultModelId", selected ?? "gpt-4o-mini");
              }}
              options={modelOptions}
            />
            <div>
              <label className="text-sm font-medium text-default-700 block mb-2">
                Temperature: {formData.defaultTemperature}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.defaultTemperature}
                onChange={(e) =>
                  updateField("defaultTemperature", parseInt(e.target.value))
                }
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-default-400 mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
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
}
