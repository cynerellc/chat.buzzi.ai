"use client";

import { useEffect, useState } from "react";

import type { PlanListItem } from "@/hooks/master-admin";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
} from "@/components/ui";
import { createPlan, updatePlan } from "@/hooks/master-admin";

interface PlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: PlanListItem | null; // null for create, plan object for edit
}

interface FormData {
  name: string;
  description: string;
  basePrice: string;
  maxAgents: number;
  maxConversationsPerMonth: number;
  maxKnowledgeSources: number;
  maxStorageGb: number;
  maxTeamMembers: number;
  trialDays: number;
  customBranding: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  advancedAnalytics: boolean;
  customIntegrations: boolean;
  isActive: boolean;
  isPublic: boolean;
}

const defaultFormData: FormData = {
  name: "",
  description: "",
  basePrice: "0",
  maxAgents: 1,
  maxConversationsPerMonth: 1000,
  maxKnowledgeSources: 5,
  maxStorageGb: 1,
  maxTeamMembers: 1,
  trialDays: 14,
  customBranding: false,
  prioritySupport: false,
  apiAccess: false,
  advancedAnalytics: false,
  customIntegrations: false,
  isActive: true,
  isPublic: true,
};

export function PlanEditorModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: PlanEditorModalProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = !!plan;

  // Reset form when plan changes
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        description: plan.description ?? "",
        basePrice: plan.basePrice,
        maxAgents: plan.maxAgents,
        maxConversationsPerMonth: plan.maxConversationsPerMonth,
        maxKnowledgeSources: plan.maxKnowledgeSources,
        maxStorageGb: plan.maxStorageGb,
        maxTeamMembers: plan.maxTeamMembers,
        trialDays: plan.trialDays,
        customBranding: plan.customBranding,
        prioritySupport: plan.prioritySupport,
        apiAccess: plan.apiAccess,
        advancedAnalytics: plan.advancedAnalytics,
        customIntegrations: plan.customIntegrations,
        isActive: plan.isActive,
        isPublic: plan.isPublic,
      });
    } else {
      setFormData(defaultFormData);
    }
    setErrors({});
    setSubmitError(null);
  }, [plan]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Plan name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Plan name must be at least 2 characters";
    }

    const price = parseFloat(formData.basePrice);
    if (isNaN(price) || price < 0) {
      newErrors.basePrice = "Please enter a valid price";
    }

    if (formData.maxAgents < 1) {
      newErrors.maxAgents = "Must be at least 1";
    }

    if (formData.maxTeamMembers < 1) {
      newErrors.maxTeamMembers = "Must be at least 1";
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
        basePrice: formData.basePrice,
        maxAgents: formData.maxAgents,
        maxConversationsPerMonth: formData.maxConversationsPerMonth,
        maxKnowledgeSources: formData.maxKnowledgeSources,
        maxStorageGb: formData.maxStorageGb,
        maxTeamMembers: formData.maxTeamMembers,
        trialDays: formData.trialDays,
        customBranding: formData.customBranding,
        prioritySupport: formData.prioritySupport,
        apiAccess: formData.apiAccess,
        advancedAnalytics: formData.advancedAnalytics,
        customIntegrations: formData.customIntegrations,
        isActive: formData.isActive,
        isPublic: formData.isPublic,
      };

      if (isEditMode && plan) {
        await updatePlan(plan.id, data);
      } else {
        await createPlan(data);
      }

      onSuccess();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save plan"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setErrors({});
      setSubmitError(null);
      onClose();
    }
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalContent>
        <ModalHeader>
          {isEditMode ? "Edit Subscription Plan" : "Create Subscription Plan"}
        </ModalHeader>
        <ModalBody className="gap-6 max-h-[70vh] overflow-y-auto">
          {submitError && (
            <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              {submitError}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h4 className="font-medium mb-3">Basic Information</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Plan Name"
                placeholder="e.g., Professional"
                value={formData.name}
                onValueChange={(v) => updateField("name", v)}
                isInvalid={!!errors.name}
                errorMessage={errors.name}
                isRequired
              />
              <Input
                label="Monthly Price"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                startContent={<span className="text-default-400">$</span>}
                value={formData.basePrice}
                onValueChange={(v) => updateField("basePrice", v)}
                isInvalid={!!errors.basePrice}
                errorMessage={errors.basePrice}
                isRequired
              />
            </div>
            <Input
              label="Description"
              placeholder="Brief description of this plan"
              value={formData.description}
              onValueChange={(v) => updateField("description", v)}
              className="mt-4"
            />
          </div>

          {/* Limits */}
          <div>
            <h4 className="font-medium mb-3">Limits</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Max Agents"
                type="number"
                min="1"
                value={String(formData.maxAgents)}
                onValueChange={(v) => updateField("maxAgents", parseInt(v) || 1)}
                isInvalid={!!errors.maxAgents}
                errorMessage={errors.maxAgents}
              />
              <Input
                label="Messages/Month"
                type="number"
                min="0"
                value={String(formData.maxConversationsPerMonth)}
                onValueChange={(v) =>
                  updateField("maxConversationsPerMonth", parseInt(v) || 0)
                }
              />
              <Input
                label="Team Members"
                type="number"
                min="1"
                value={String(formData.maxTeamMembers)}
                onValueChange={(v) =>
                  updateField("maxTeamMembers", parseInt(v) || 1)
                }
                isInvalid={!!errors.maxTeamMembers}
                errorMessage={errors.maxTeamMembers}
              />
              <Input
                label="Storage (GB)"
                type="number"
                min="0"
                value={String(formData.maxStorageGb)}
                onValueChange={(v) =>
                  updateField("maxStorageGb", parseInt(v) || 0)
                }
              />
              <Input
                label="Knowledge Sources"
                type="number"
                min="0"
                value={String(formData.maxKnowledgeSources)}
                onValueChange={(v) =>
                  updateField("maxKnowledgeSources", parseInt(v) || 0)
                }
              />
              <Input
                label="Trial Days"
                type="number"
                min="0"
                value={String(formData.trialDays)}
                onValueChange={(v) =>
                  updateField("trialDays", parseInt(v) || 0)
                }
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-medium mb-3">Features</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <Checkbox
                isSelected={formData.customBranding}
                onValueChange={(v) => updateField("customBranding", v)}
              >
                Custom Branding
              </Checkbox>
              <Checkbox
                isSelected={formData.prioritySupport}
                onValueChange={(v) => updateField("prioritySupport", v)}
              >
                Priority Support
              </Checkbox>
              <Checkbox
                isSelected={formData.apiAccess}
                onValueChange={(v) => updateField("apiAccess", v)}
              >
                API Access
              </Checkbox>
              <Checkbox
                isSelected={formData.advancedAnalytics}
                onValueChange={(v) => updateField("advancedAnalytics", v)}
              >
                Advanced Analytics
              </Checkbox>
              <Checkbox
                isSelected={formData.customIntegrations}
                onValueChange={(v) => updateField("customIntegrations", v)}
              >
                Custom Integrations
              </Checkbox>
            </div>
          </div>

          {/* Status */}
          <div>
            <h4 className="font-medium mb-3">Status</h4>
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
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={handleClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
          >
            {isEditMode ? "Save Changes" : "Create Plan"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
