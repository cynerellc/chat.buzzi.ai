"use client";

import { useState } from "react";

import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
} from "@/components/ui";
import { createCompany } from "@/hooks/master-admin";

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plans: Array<{ id: string; name: string }>;
}

interface FormData {
  name: string;
  domain: string;
  planId: string;
  adminName: string;
  adminEmail: string;
  sendWelcomeEmail: boolean;
}

export function AddCompanyModal({
  isOpen,
  onClose,
  onSuccess,
  plans,
}: AddCompanyModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    domain: "",
    planId: "",
    adminName: "",
    adminEmail: "",
    sendWelcomeEmail: true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Company name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Company name must be at least 2 characters";
    }

    if (!formData.adminName.trim()) {
      newErrors.adminName = "Admin name is required";
    }

    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = "Admin email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
      newErrors.adminEmail = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createCompany({
        name: formData.name,
        domain: formData.domain || undefined,
        planId: formData.planId || undefined,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
        sendWelcomeEmail: formData.sendWelcomeEmail,
      });

      // Reset form and close
      setFormData({
        name: "",
        domain: "",
        planId: "",
        adminName: "",
        adminEmail: "",
        sendWelcomeEmail: true,
      });
      onSuccess();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create company"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        name: "",
        domain: "",
        planId: "",
        adminName: "",
        adminEmail: "",
        sendWelcomeEmail: true,
      });
      setErrors({});
      setSubmitError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent>
        <ModalHeader>Add New Company</ModalHeader>
        <ModalBody className="gap-6">
          {submitError && (
            <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              {submitError}
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-medium text-default-700">Company Information</h4>

            <Input
              label="Company Name"
              placeholder="Enter company name"
              value={formData.name}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, name: value }))
              }
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              isRequired
            />

            <Input
              label="Domain"
              placeholder="example.com"
              value={formData.domain}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, domain: value }))
              }
              description="Optional - Company's website domain"
            />

            <Select
              label="Subscription Plan"
              placeholder="Select a plan"
              selectedKeys={formData.planId ? new Set([formData.planId]) : new Set()}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setFormData((prev) => ({ ...prev, planId: selected ?? "" }));
              }}
              description="Leave empty for trial account"
              options={plans.map((plan) => ({
                value: plan.id,
                label: plan.name,
              }))}
            />
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-default-700">Admin Account</h4>

            <Input
              label="Admin Name"
              placeholder="Enter admin name"
              value={formData.adminName}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, adminName: value }))
              }
              isInvalid={!!errors.adminName}
              errorMessage={errors.adminName}
              isRequired
            />

            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@example.com"
              value={formData.adminEmail}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, adminEmail: value }))
              }
              isInvalid={!!errors.adminEmail}
              errorMessage={errors.adminEmail}
              isRequired
            />

            <Checkbox
              isSelected={formData.sendWelcomeEmail}
              onValueChange={(checked) =>
                setFormData((prev) => ({ ...prev, sendWelcomeEmail: checked }))
              }
            >
              Send welcome email to admin
            </Checkbox>
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
            Create Company
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
