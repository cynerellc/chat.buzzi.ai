"use client";

import { useState, useMemo, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, Variable, Headphones, ShoppingBag, HelpCircle, Sparkles } from "lucide-react";

import { Button, Input, Select, Card, CardHeader, CardBody, Textarea, addToast, Skeleton, Chip } from "@/components/ui";
import { usePackages, usePackage, type PackageListItem } from "@/hooks/master-admin";
import type { PackageVariableDefinition } from "@/lib/db/schema";

type Step = "package" | "details" | "variables";

const TYPE_OPTIONS = [
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  support: Headphones,
  sales: ShoppingBag,
  faq: HelpCircle,
};

interface NewChatbotPageProps {
  params: Promise<{ companyId: string }>;
}

export default function NewChatbotPage({ params }: NewChatbotPageProps) {
  const { companyId } = use(params);
  const router = useRouter();
  const [step, setStep] = useState<Step>("package");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"support" | "sales" | "general" | "custom">("custom");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { packages, isLoading: packagesLoading } = usePackages();
  const { package: selectedPackageDetails, isLoading: packageDetailsLoading } = usePackage(selectedPackageId);

  // Get active packages only
  const activePackages = useMemo(() =>
    packages.filter(pkg => pkg.isActive),
    [packages]
  );

  // Get package variables from the detailed package fetch
  const packageVariables = useMemo<PackageVariableDefinition[]>(
    () => selectedPackageDetails?.variables || [],
    [selectedPackageDetails]
  );

  const hasVariables = packageVariables.length > 0;

  // Initialize variable values when package details are loaded
  useEffect(() => {
    if (selectedPackageDetails?.variables) {
      const defaults: Record<string, string> = {};
      selectedPackageDetails.variables.forEach((v) => {
        if (v.defaultValue) {
          defaults[v.name] = v.defaultValue;
        }
      });
      setVariableValues(defaults);
    }
  }, [selectedPackageDetails]);

  const handlePackageSelect = (packageId: string | null) => {
    setSelectedPackageId(packageId);
    setVariableValues({});
    if (packageId) {
      const pkg = activePackages.find((p) => p.id === packageId);
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
    if (step === "package") {
      setStep("details");
    } else if (step === "details" && hasVariables) {
      setStep("variables");
    }
  };

  const handleBack = () => {
    if (step === "variables") {
      setStep("details");
    } else if (step === "details") {
      setStep("package");
    }
  };

  const updateVariableValue = (varName: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [varName]: value }));
  };

  const validateVariables = (): boolean => {
    for (const variable of packageVariables) {
      if (variable.required && !variableValues[variable.name]?.trim()) {
        addToast({ title: `${variable.displayName} is required`, color: "warning" });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast({ title: "Please enter a chatbot name", color: "warning" });
      return;
    }

    if (hasVariables && !validateVariables()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/master-admin/companies/${companyId}/chatbots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          packageId: selectedPackageId || undefined,
          variableValues: hasVariables ? variableValues : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chatbot");
      }

      const result = await response.json();
      addToast({ title: "Chatbot created successfully", color: "success" });
      router.push(`/admin/companies/${companyId}/chatbots/${result.chatbot.id}/general`);
    } catch {
      addToast({ title: "Failed to create chatbot", color: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case "package":
        return "Choose a template to get started";
      case "details":
        return "Configure chatbot details";
      case "variables":
        return "Set up configuration variables";
    }
  };

  // Get selected package info for display
  const selectedPackageInfo = useMemo(
    () => activePackages.find((p) => p.id === selectedPackageId),
    [activePackages, selectedPackageId]
  );

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href={`/admin/companies/${companyId}/chatbots`}>
            <ArrowLeft size={18} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Chatbot</h1>
          <p className="text-muted-foreground">{getStepDescription()}</p>
        </div>
      </div>

      {/* Step Progress */}
      {hasVariables && (
        <div className="flex items-center gap-2">
          <div className={`h-2 flex-1 rounded-full ${step === "package" || step === "details" || step === "variables" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full ${step === "details" || step === "variables" ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full ${step === "variables" ? "bg-primary" : "bg-muted"}`} />
        </div>
      )}

      {/* Step 1: Package Selection */}
      {step === "package" && (
        <div className="space-y-6">
          <PackageSelector
            packages={activePackages}
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

      {/* Step 2: Chatbot Details */}
      {step === "details" && (
        <form onSubmit={hasVariables ? (e) => { e.preventDefault(); handleContinue(); } : handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Chatbot Details</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Chatbot Name"
                placeholder="e.g., Support Bot"
                value={name}
                onValueChange={setName}
                isRequired
              />

              <Textarea
                label="Description"
                placeholder="Describe what this chatbot does..."
                value={description}
                onValueChange={setDescription}
                minRows={3}
              />

              <Select
                label="Chatbot Type"
                options={TYPE_OPTIONS}
                selectedKeys={new Set([type])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];
                  if (selected) setType(selected as typeof type);
                }}
              />

              {selectedPackageId && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">Using template:</p>
                  <p className="text-muted-foreground">
                    {selectedPackageInfo?.name || "Selected package"}
                  </p>
                  {packageDetailsLoading ? (
                    <Skeleton className="h-4 w-48 mt-1" />
                  ) : hasVariables ? (
                    <p className="text-xs text-primary mt-1">
                      This template has {packageVariables.length} configuration variable{packageVariables.length !== 1 ? "s" : ""}
                    </p>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onPress={handleBack} leftIcon={ArrowLeft}>
              Back
            </Button>
            {hasVariables ? (
              <Button type="submit" color="primary" rightIcon={ArrowRight}>
                Continue to Variables
              </Button>
            ) : (
              <Button type="submit" color="primary" isLoading={isSubmitting}>
                Create Chatbot
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Step 3: Variables Configuration */}
      {step === "variables" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Variable size={20} />
                <h2 className="text-lg font-semibold">Configuration Variables</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Set the values for the chatbot&apos;s configuration variables.
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              {packageVariables.map((variable) => (
                <div key={variable.name} className="space-y-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium">{variable.displayName}</span>
                    {variable.variableType === "secured_variable" && (
                      <Lock size={14} className="text-muted-foreground" />
                    )}
                    {variable.required && <span className="text-danger text-sm">*</span>}
                  </div>
                  <Input
                    placeholder={variable.placeholder || `Enter ${variable.displayName.toLowerCase()}`}
                    value={variableValues[variable.name] || ""}
                    onValueChange={(v) => updateVariableValue(variable.name, v)}
                    type={variable.variableType === "secured_variable" ? "password" : "text"}
                    description={variable.description}
                  />
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onPress={handleBack} leftIcon={ArrowLeft}>
              Back
            </Button>
            <Button type="submit" color="primary" isLoading={isSubmitting}>
              Create Chatbot
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Inline package selector component for master admin (uses PackageListItem instead of AgentPackageItem)
interface PackageSelectorProps {
  packages: PackageListItem[];
  isLoading: boolean;
  selectedPackageId: string | null;
  onSelect: (packageId: string | null) => void;
}

function PackageSelector({
  packages,
  isLoading,
  selectedPackageId,
  onSelect,
}: PackageSelectorProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardBody className="p-6">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="mt-4 h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-3/4" />
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Start with a template</h2>
        <p className="text-sm text-default-500">
          Choose a pre-configured template or start from scratch
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => {
          const Icon = categoryIcons[pkg.category?.toLowerCase() || ""] || Sparkles;
          const isSelected = selectedPackageId === pkg.id;

          return (
            <Card
              key={pkg.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onSelect(isSelected ? null : pkg.id)}
            >
              <CardBody className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">{pkg.name}</h3>
                <p className="mt-1 text-sm text-default-500 line-clamp-2">
                  {pkg.description || "No description available"}
                </p>
                {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(pkg.features as string[]).slice(0, 3).map((feature, i) => (
                      <Chip key={i} size="sm">
                        {feature}
                      </Chip>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}

        {/* Start from Scratch Option */}
        <Card
          className={`cursor-pointer transition-all ${
            selectedPackageId === null
              ? "border-primary ring-2 ring-primary ring-offset-2"
              : "hover:border-primary/50"
          }`}
          onClick={() => onSelect(null)}
        >
          <CardBody className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-default-100">
              <Sparkles className="h-6 w-6 text-default-500" />
            </div>
            <h3 className="mt-4 font-semibold">Start from Scratch</h3>
            <p className="mt-1 text-sm text-default-500">
              Create a fully custom chatbot
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
