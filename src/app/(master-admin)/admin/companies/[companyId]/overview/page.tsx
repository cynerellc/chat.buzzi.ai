"use client";

import { CompanyOverview } from "@/components/master-admin/companies";

import { useCompanyContext } from "../company-context";

export default function CompanyOverviewPage() {
  const { company } = useCompanyContext();

  if (!company) {
    return null;
  }

  return <CompanyOverview company={company} />;
}
