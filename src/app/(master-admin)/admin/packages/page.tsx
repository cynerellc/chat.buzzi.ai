"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layouts";
import { PackagesFilters, PackagesGrid, CodeViewerModal } from "@/components/master-admin/packages";
import { Button } from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import { usePackages, type PackageListItem } from "@/hooks/master-admin";

export default function PackagesPage() {
  useSetPageTitle("Chatbot Packages");
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const [codeViewerPackage, setCodeViewerPackage] = useState<PackageListItem | null>(null);
  const { packages, isLoading } = usePackages({
    category: category === "all" ? undefined : category,
  });

  const handleCreatePackage = () => {
    router.push("/admin/packages/new");
  };

  const handleConfigurePackage = (pkg: PackageListItem) => {
    router.push(`/admin/packages/${pkg.id}`);
  };

  const handleViewCode = (pkg: PackageListItem) => {
    setCodeViewerPackage(pkg);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Chatbot Packages"
        description="Manage chatbot package templates for your customers"
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
        onViewCode={handleViewCode}
      />

      <CodeViewerModal
        isOpen={!!codeViewerPackage}
        onClose={() => setCodeViewerPackage(null)}
        packageId={codeViewerPackage?.id ?? ""}
        packageName={codeViewerPackage?.name ?? ""}
      />
    </div>
  );
}
