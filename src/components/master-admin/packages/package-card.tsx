"use client";

import {
  Bot,
  Briefcase,
  HelpCircle,
  Headphones,
  Settings,
} from "lucide-react";

import type { PackageListItem } from "@/hooks/master-admin";
import { Badge, Button, Card, type BadgeVariant } from "@/components/ui";

interface PackageCardProps {
  package: PackageListItem;
  onConfigure: (pkg: PackageListItem) => void;
}

const categoryIcons: Record<string, typeof Bot> = {
  support: Headphones,
  sales: Briefcase,
  faq: HelpCircle,
  custom: Settings,
};

const categoryColors: Record<string, string> = {
  support: "bg-primary-100 text-primary-600",
  sales: "bg-success-100 text-success-600",
  faq: "bg-warning-100 text-warning-600",
  custom: "bg-secondary-100 text-secondary-600",
};

export function PackageCard({ package: pkg, onConfigure }: PackageCardProps) {
  const Icon = categoryIcons[pkg.category ?? "custom"] ?? Bot;
  const colorClass = categoryColors[pkg.category ?? "custom"] ?? categoryColors.custom;
  const statusVariant: BadgeVariant = pkg.isActive ? "success" : "default";

  return (
    <Card className="p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon size={24} />
        </div>
        <Badge variant={statusVariant} size="sm">
          {pkg.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <h3 className="text-lg font-semibold mb-1">{pkg.name}</h3>
      {pkg.category && (
        <Badge variant="info" size="sm" className="mb-3 w-fit capitalize">
          {pkg.category}
        </Badge>
      )}

      {pkg.description && (
        <p className="text-sm text-default-500 flex-1 mb-4 line-clamp-3">
          {pkg.description}
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-divider">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-default-500">
            Used by {pkg.agentsCount} {pkg.agentsCount === 1 ? "agent" : "agents"}
          </span>
        </div>
        <Button
          variant="flat"
          className="w-full"
          onPress={() => onConfigure(pkg)}
        >
          Configure
        </Button>
      </div>
    </Card>
  );
}
