"use client";

import { use } from "react";

import { KnowledgeDetailPage } from "@/components/shared/knowledge";

import { useCompanyContext } from "../../company-context";

interface PageProps {
  params: Promise<{ sourceId: string }>;
}

export default function MasterAdminKnowledgeSourceDetailPage({ params }: PageProps) {
  const { sourceId } = use(params);
  const { companyId } = useCompanyContext();

  return (
    <KnowledgeDetailPage
      sourceId={sourceId}
      apiUrl={`/api/master-admin/companies/${companyId}/knowledge`}
      backUrl={`/admin/companies/${companyId}/knowledge`}
    />
  );
}
