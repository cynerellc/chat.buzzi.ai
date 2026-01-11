"use client";

import { Headphones, ShoppingBag, HelpCircle, Sparkles } from "lucide-react";

import { Card, CardBody, Skeleton, Chip } from "@/components/ui";

import type { ChatbotPackageItem } from "@/app/api/company/chatbots/packages/route";

interface PackageSelectorProps {
  packages: ChatbotPackageItem[];
  isLoading: boolean;
  selectedPackageId: string | null;
  onSelect: (packageId: string | null) => void;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  support: Headphones,
  sales: ShoppingBag,
  faq: HelpCircle,
};

export function PackageSelector({
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
                      <Chip key={i} size="sm" >
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
              Create a fully custom agent
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
