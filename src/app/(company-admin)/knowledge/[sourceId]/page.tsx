"use client";

import { use } from "react";

import { KnowledgeDetailPage } from "@/components/shared/knowledge";
import { useSetPageTitle } from "@/contexts/page-context";

interface PageProps {
  params: Promise<{ sourceId: string }>;
}

export default function KnowledgeSourceDetailPage({ params }: PageProps) {
  useSetPageTitle("Knowledge Source");
  const { sourceId } = use(params);

  return (
    <KnowledgeDetailPage
      sourceId={sourceId}
      apiUrl="/api/company/knowledge"
      backUrl="/knowledge"
    />
  );
}
