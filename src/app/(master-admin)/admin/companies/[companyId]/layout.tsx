"use client";

import { use, useMemo, type ReactNode } from "react";

import { CompanyMenuBar } from "@/components/master-admin/companies";
import { Card, Skeleton } from "@/components/ui";
import { useSetBreadcrumbs } from "@/contexts/page-context";
import { useCompany, useCompanyChatbots } from "@/hooks/master-admin";

import { CompanyContext } from "./company-context";

interface CompanyDetailsLayoutProps {
  children: ReactNode;
  params: Promise<{ companyId: string }>;
}

export default function CompanyDetailsLayout({ children, params }: CompanyDetailsLayoutProps) {
  const { companyId } = use(params);
  const companyData = useCompany(companyId);
  const { company, isLoading } = companyData;
  const { chatbots } = useCompanyChatbots(companyId);

  const breadcrumbs = useMemo(() => [
    { label: "Companies", href: "/admin/companies" },
    { label: company?.name ?? "..." },
  ], [company?.name]);

  useSetBreadcrumbs(breadcrumbs);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
          <p className="text-muted-foreground">
            The company you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <CompanyContext.Provider value={{ ...companyData, companyId }}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 pb-0">
          {/* Menu Bar - Above breadcrumb */}
          <CompanyMenuBar companyId={companyId} chatbots={chatbots} companyName={company.name} />
        </div>

        {/* Full-width Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </CompanyContext.Provider>
  );
}
