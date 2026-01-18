"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { KnowledgeNewPage } from "@/components/shared/knowledge";
import { useSetBreadcrumbs } from "@/contexts/page-context";

function KnowledgeNewPageContent() {
  useSetBreadcrumbs([
    { label: "Knowledge Base", href: "/knowledge" },
    { label: "Add Source" },
  ]);
  const searchParams = useSearchParams();
  const isFaqMode = searchParams.get("type") === "faq";
  const editFaqId = searchParams.get("edit");
  const categoryFromUrl = searchParams.get("category");

  return (
    <KnowledgeNewPage
      baseApiUrl="/api/company/knowledge"
      uploadApiUrl="/api/company/knowledge/upload"
      backUrl="/knowledge"
      isFaqMode={isFaqMode}
      editFaqId={editFaqId}
      categoryFromUrl={categoryFromUrl}
    />
  );
}

export default function KnowledgeNewPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <KnowledgeNewPageContent />
    </Suspense>
  );
}
