"use client";

import { useEffect, useState } from "react";

import type { CompanyListItem } from "@/app/api/master-admin/companies/route";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
} from "@/components/ui";
import { updateCompany } from "@/hooks/master-admin";

interface EditCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  company: CompanyListItem | null;
}

const statusOptions = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "grace_period", label: "Grace Period" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

interface FormData {
  name: string;
  domain: string;
  status: string;
}

export function EditCompanyModal({
  isOpen,
  onClose,
  onSuccess,
  company,
}: EditCompanyModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    domain: "",
    status: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form when company changes
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        domain: company.domain ?? "",
        status: company.status,
      });
      setErrors({});
      setSubmitError(null);
    }
  }, [company]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Company name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Company name must be at least 2 characters";
    }

    if (!formData.status) {
      newErrors.status = "Status is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !company) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await updateCompany(company.id, {
        name: formData.name,
        domain: formData.domain || null,
        status: formData.status,
      });

      onSuccess();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to update company"
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent>
        <ModalHeader>Edit Company</ModalHeader>
        <ModalBody className="gap-4">
          {submitError && (
            <div className="p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              {submitError}
            </div>
          )}

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
            description="Company's website domain"
          />

          <Select
            label="Status"
            placeholder="Select status"
            selectedKeys={formData.status ? new Set([formData.status]) : new Set()}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setFormData((prev) => ({ ...prev, status: selected ?? "" }));
            }}
            isInvalid={!!errors.status}
            errorMessage={errors.status}
            isRequired
            options={statusOptions.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
