"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { KnowledgeNewPage } from "@/components/shared/knowledge";

import { useCompanyContext } from "../../company-context";

function KnowledgeNewPageContent() {
  const searchParams = useSearchParams();
  const { companyId } = useCompanyContext();

  const isFaqMode = searchParams.get("type") === "faq";
  const editFaqId = searchParams.get("edit");
  const categoryFromUrl = searchParams.get("category");

  return (
    <KnowledgeNewPage
      baseApiUrl={`/api/master-admin/companies/${companyId}/knowledge`}
      uploadApiUrl={`/api/master-admin/companies/${companyId}/knowledge/upload`}
      backUrl={`/admin/companies/${companyId}/knowledge`}
      isFaqMode={isFaqMode}
      editFaqId={editFaqId}
      categoryFromUrl={categoryFromUrl}
    />
  );
}

export default function MasterAdminKnowledgeNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <KnowledgeNewPageContent />
    </Suspense>
  );
}
