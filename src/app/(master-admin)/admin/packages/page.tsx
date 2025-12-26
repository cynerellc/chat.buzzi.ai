"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layouts";
import { PackagesFilters, PackagesGrid } from "@/components/master-admin/packages";
import { Button } from "@/components/ui";
import { usePackages, type PackageListItem } from "@/hooks/master-admin";

export default function PackagesPage() {
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const { packages, isLoading } = usePackages({
    category: category === "all" ? undefined : category,
  });

  const handleCreatePackage = () => {
    router.push("/admin/packages/new");
  };

  const handleConfigurePackage = (pkg: PackageListItem) => {
    router.push(`/admin/packages/${pkg.id}`);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Agent Packages"
        description="Manage agent package templates for your customers"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Packages" },
        ]}
        actions={
          <Button
            color="primary"
            startContent={<Plus size={16} />}
            onClick={handleCreatePackage}
          >
            Create Package
          </Button>
        }
      />

      <PackagesFilters
        selectedCategory={category}
        onCategoryChange={setCategory}
      />

      <PackagesGrid
        packages={packages}
        isLoading={isLoading}
        onConfigure={handleConfigurePackage}
      />
    </div>
  );
}
