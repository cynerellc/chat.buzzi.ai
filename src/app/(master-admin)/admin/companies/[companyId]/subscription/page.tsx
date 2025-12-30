"use client";

import { CompanySubscription } from "@/components/master-admin/companies";

import { useCompanyContext } from "../company-context";

export default function CompanySubscriptionPage() {
  const { companyId } = useCompanyContext();

  return <CompanySubscription companyId={companyId} />;
}
