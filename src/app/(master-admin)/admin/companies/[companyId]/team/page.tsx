"use client";

import { CompanyUsers } from "@/components/master-admin/companies";

import { useCompanyContext } from "../company-context";

export default function CompanyTeamPage() {
  const { companyId } = useCompanyContext();

  return <CompanyUsers companyId={companyId} />;
}
