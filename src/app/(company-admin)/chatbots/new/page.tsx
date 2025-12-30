"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock, Variable } from "lucide-react";

import { Button, Input, Select, Card, CardHeader, CardBody, Textarea, addToast } from "@/components/ui";
import { PackageSelector } from "@/components/company-admin/agents/package-selector";
import { useSetPageTitle } from "@/contexts/page-context";
import { useAgentPackages, useCreateAgent } from "@/hooks/company";

type Step = "package" | "details" | "variables";

const TYPE_OPTIONS = [
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

export default function NewChatbotPage() {
  useSetPageTitle("New Chatbot");
  const router = useRouter();
  const [step, setStep] = useState<Step>("package");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"support" | "sales" | "general" | "custom">("custom");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { packages, isLoading: packagesLoading } = useAgentPackages();
  const { createAgent } = useCreateAgent();

  // Get selected package and its variables
  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId),
    [packages, selectedPackageId]
  );

  const packageVariables = useMemo(
    () => selectedPackage?.variables || [],
    [selectedPackage]
  );

  const hasVariables = packageVariables.length > 0;

  const handlePackageSelect = (packageId: string | null) => {
    setSelectedPackageId(packageId);
    // Reset variable values when package changes
    setVariableValues({});
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
      // Initialize variable values with defaults
      if (pkg?.variables) {
        const defaults: Record<string, string> = {};
        pkg.variables.forEach((v) => {
          if (v.defaultValue) {
            defaults[v.name] = v.defaultValue;
          }
        });
        setVariableValues(defaults);
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

  const updateVariableValue = (name: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
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

    // Validate variables if there are any
    if (hasVariables && !validateVariables()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        packageId: selectedPackageId || undefined,
        variableValues: hasVariables ? variableValues : undefined,
      });

      addToast({ title: "Chatbot created successfully", color: "success" });
      router.push(`/chatbots/${result.agent.id}`);
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
        return "Configure your chatbot details";
      case "variables":
        return "Set up your configuration variables";
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href="/chatbots">
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
                    {selectedPackage?.name || "Selected package"}
                  </p>
                  {hasVariables && (
                    <p className="text-xs text-primary mt-1">
                      This template has {packageVariables.length} configuration variable{packageVariables.length !== 1 ? "s" : ""}
                    </p>
                  )}
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
                Set the values for your agent&apos;s configuration variables. Secured variables will be encrypted.
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
