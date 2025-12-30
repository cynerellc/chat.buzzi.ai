"use client";

import { useRouter } from "next/navigation";

import { ConversationsPage } from "@/components/shared/conversations";

import { useCompanyContext } from "../company-context";

export default function MasterAdminConversationsPage() {
  const router = useRouter();
  const { companyId, company } = useCompanyContext();

  const handleConversationClick = (conversationId: string) => {
    router.push(`/admin/companies/${companyId}/conversations/${conversationId}`);
  };

  return (
    <ConversationsPage
      title="Conversations"
      subtitle={`View conversations for ${company?.name || "company"}`}
      baseApiUrl={`/api/master-admin/companies/${companyId}/conversations`}
      agentsApiUrl={`/api/master-admin/companies/${companyId}/agents`}
      onConversationClick={handleConversationClick}
    />
  );
}
