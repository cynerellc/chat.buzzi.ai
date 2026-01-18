"use client";

import { useRouter } from "next/navigation";

import { KnowledgeBasePage } from "@/components/shared/knowledge";
import { useSetBreadcrumbs } from "@/contexts/page-context";

export default function KnowledgePage() {
  useSetBreadcrumbs([{ label: "Knowledge Base" }]);
  const router = useRouter();

  const handleAddSource = (categoryName?: string) => {
    const url = categoryName
      ? `/knowledge/new?category=${encodeURIComponent(categoryName)}`
      : "/knowledge/new";
    router.push(url);
  };

  const handleAddFaq = (categoryName?: string) => {
    const url = categoryName
      ? `/knowledge/new?type=faq&category=${encodeURIComponent(categoryName)}`
      : "/knowledge/new?type=faq";
    router.push(url);
  };

  const handleViewSource = (sourceId: string) => {
    router.push(`/knowledge/${sourceId}`);
  };

  const handleEditFaq = (faqId: string) => {
    router.push(`/knowledge/new?type=faq&edit=${faqId}`);
  };

  return (
    <KnowledgeBasePage
      title="Knowledge Base"
      subtitle="Manage documents, URLs, and FAQs that power your AI agents"
      baseApiUrl="/api/company/knowledge"
      onAddSource={handleAddSource}
      onAddFaq={handleAddFaq}
      onViewSource={handleViewSource}
      onEditFaq={handleEditFaq}
    />
  );
}
