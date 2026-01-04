"use client";

import { Package } from "lucide-react";

import type { PackageListItem } from "@/hooks/master-admin";
import { Card, Skeleton } from "@/components/ui";
import { PackageCard } from "./package-card";

interface PackagesGridProps {
  packages: PackageListItem[];
  isLoading: boolean;
  onConfigure: (pkg: PackageListItem) => void;
  onEditCode: (pkg: PackageListItem) => void;
}

export function PackagesGrid({ packages, isLoading, onConfigure, onEditCode }: PackagesGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-12 w-12 rounded-none mb-4" />
            <Skeleton className="h-6 w-24 mb-2 rounded-none" />
            <Skeleton className="h-5 w-16 mb-3 rounded-none" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-none" />
              <Skeleton className="h-4 w-full rounded-none" />
              <Skeleton className="h-4 w-3/4 rounded-none" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Package size={48} className="mx-auto mb-4 text-default-300" />
        <h3 className="font-semibold mb-2">No Packages Found</h3>
        <p className="text-default-500">
          Create your first agent package to get started.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {packages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          package={pkg}
          onConfigure={onConfigure}
          onEditCode={onEditCode}
        />
      ))}
    </div>
  );
}
