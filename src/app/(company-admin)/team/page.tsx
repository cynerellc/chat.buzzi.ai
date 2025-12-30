"use client";

import { TeamManagementPage } from "@/components/shared/team";
import { useSetPageTitle } from "@/contexts/page-context";

export default function TeamPage() {
  useSetPageTitle("Team");

  return (
    <TeamManagementPage
      title="Team Management"
      subtitle="Manage your team members and invitations"
      baseApiUrl="/api/company/team"
      showCurrentUserBadge={true}
    />
  );
}
