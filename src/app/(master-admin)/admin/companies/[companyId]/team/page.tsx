"use client";

import { TeamManagementPage } from "@/components/shared/team";

import { useCompanyContext } from "../company-context";

export default function CompanyTeamPage() {
  const { companyId, company } = useCompanyContext();

  return (
    <TeamManagementPage
      title="Team Management"
      subtitle={`Manage team members for ${company?.name || "company"}`}
      baseApiUrl={`/api/master-admin/companies/${companyId}/team`}
      showCurrentUserBadge={false}
    />
  );
}
