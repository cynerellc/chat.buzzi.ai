"use client";

import { use } from "react";

import { KnowledgeDetailPage } from "@/components/shared/knowledge";
import { useSetBreadcrumbs } from "@/contexts/page-context";

interface PageProps {
  params: Promise<{ sourceId: string }>;
}

export default function KnowledgeSourceDetailPage({ params }: PageProps) {
  const { sourceId } = use(params);

  useSetBreadcrumbs([
    { label: "Knowledge Base", href: "/knowledge" },
    { label: "Source Details" },
  ]);

  return (
    <KnowledgeDetailPage
      sourceId={sourceId}
      apiUrl="/api/company/knowledge"
      backUrl="/knowledge"
    />
  );
}
