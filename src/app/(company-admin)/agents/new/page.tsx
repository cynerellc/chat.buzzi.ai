"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { addToast, Textarea } from "@heroui/react";

import { Button, Input, Select, Card, CardHeader, CardBody } from "@/components/ui";
import { PackageSelector } from "@/components/company-admin/agents/package-selector";
import { useAgentPackages, useCreateAgent } from "@/hooks/company";

type Step = "package" | "details";

const TYPE_OPTIONS = [
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("package");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"support" | "sales" | "general" | "custom">("custom");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { packages, isLoading: packagesLoading } = useAgentPackages();
  const { createAgent } = useCreateAgent();

  const handlePackageSelect = (packageId: string | null) => {
    setSelectedPackageId(packageId);
    if (packageId) {
      const pkg = packages.find((p) => p.id === packageId);
      if (pkg?.category) {
        const categoryToType: Record<string, typeof type> = {
          support: "support",
          sales: "sales",
          general: "general",
        };
        setType(categoryToType[pkg.category.toLowerCase()] || "custom");
      }
    }
  };

  const handleContinue = () => {
    setStep("details");
  };

  const handleBack = () => {
    setStep("package");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast({ title: "Please enter an agent name", color: "warning" });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        packageId: selectedPackageId || undefined,
      });

      addToast({ title: "Agent created successfully", color: "success" });
      router.push(`/agents/${result.agent.id}`);
    } catch {
      addToast({ title: "Failed to create agent", color: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button as={Link} href="/agents" variant="light" isIconOnly aria-label="Back">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Agent</h1>
          <p className="text-default-500">
            {step === "package"
              ? "Choose a template to get started"
              : "Configure your agent details"}
          </p>
        </div>
      </div>

      {/* Step 1: Package Selection */}
      {step === "package" && (
        <div className="space-y-6">
          <PackageSelector
            packages={packages}
            isLoading={packagesLoading}
            selectedPackageId={selectedPackageId}
            onSelect={handlePackageSelect}
          />

          <div className="flex justify-end">
            <Button color="primary" onPress={handleContinue} rightIcon={ArrowRight}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Agent Details */}
      {step === "details" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Agent Details</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Agent Name"
                placeholder="e.g., Support Bot"
                value={name}
                onValueChange={setName}
                isRequired
              />

              <Textarea
                label="Description"
                placeholder="Describe what this agent does..."
                value={description}
                onValueChange={setDescription}
                minRows={3}
              />

              <Select
                label="Agent Type"
                options={TYPE_OPTIONS}
                selectedKeys={new Set([type])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];
                  if (selected) setType(selected as typeof type);
                }}
              />

              {selectedPackageId && (
                <div className="rounded-lg bg-default-100 p-3 text-sm">
                  <p className="font-medium">Using template:</p>
                  <p className="text-default-500">
                    {packages.find((p) => p.id === selectedPackageId)?.name ||
                      "Selected package"}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="flex justify-between">
            <Button variant="bordered" onPress={handleBack} leftIcon={ArrowLeft}>
              Back
            </Button>
            <Button type="submit" color="primary" isLoading={isSubmitting}>
              Create Agent
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
