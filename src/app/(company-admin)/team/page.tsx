"use client";

import { TeamManagementPage } from "@/components/shared/team";
import { useSetBreadcrumbs } from "@/contexts/page-context";

export default function TeamPage() {
  useSetBreadcrumbs([{ label: "Team" }]);

  return (
    <TeamManagementPage
      title="Team Management"
      subtitle="Manage your team members and invitations"
      baseApiUrl="/api/company/team"
      showCurrentUserBadge={true}
    />
  );
}
