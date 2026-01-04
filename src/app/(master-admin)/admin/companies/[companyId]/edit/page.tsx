"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  addToast,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { updateCompany } from "@/hooks/master-admin";
import { useCompanyContext } from "../company-context";

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

export default function EditCompanyPage() {
  const router = useRouter();
  const { company, companyId, isLoading, refresh } = useCompanyContext();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    domain: "",
    status: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form when company loads
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name,
        domain: company.domain ?? "",
        status: company.status,
      });
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

      addToast({
        title: "Company Updated",
        description: "Company details have been saved successfully",
        color: "success",
      });

      refresh();
      router.push(`/admin/companies/${companyId}/overview`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to update company"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/admin/companies/${companyId}/overview`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Edit Company</h2>
          <p className="text-sm text-muted-foreground">Update company details</p>
        </div>
        <Card>
          <CardBody>
            <Skeleton className="h-64 w-full" />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Edit Company</h2>
        <p className="text-sm text-muted-foreground">
          Update details for {company?.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-medium">Company Information</h3>
        </CardHeader>
        <CardBody className="space-y-4">
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

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onPress={handleCancel} isDisabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
