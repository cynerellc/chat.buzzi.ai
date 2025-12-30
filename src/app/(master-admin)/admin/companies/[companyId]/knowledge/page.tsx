"use client";

import { useRouter } from "next/navigation";

import { KnowledgeBasePage } from "@/components/shared/knowledge";

import { useCompanyContext } from "../company-context";

export default function CompanyKnowledgePage() {
  const router = useRouter();
  const { companyId, company } = useCompanyContext();

  const handleAddSource = (categoryName?: string) => {
    const url = categoryName
      ? `/admin/companies/${companyId}/knowledge/new?category=${encodeURIComponent(categoryName)}`
      : `/admin/companies/${companyId}/knowledge/new`;
    router.push(url);
  };

  const handleAddFaq = (categoryName?: string) => {
    const url = categoryName
      ? `/admin/companies/${companyId}/knowledge/new?type=faq&category=${encodeURIComponent(categoryName)}`
      : `/admin/companies/${companyId}/knowledge/new?type=faq`;
    router.push(url);
  };

  const handleViewSource = (sourceId: string) => {
    router.push(`/admin/companies/${companyId}/knowledge/${sourceId}`);
  };

  const handleEditFaq = (faqId: string) => {
    router.push(`/admin/companies/${companyId}/knowledge/new?type=faq&edit=${faqId}`);
  };

  return (
    <KnowledgeBasePage
      title="Knowledge Base"
      subtitle={`Manage knowledge sources for ${company?.name || "company"}`}
      baseApiUrl={`/api/master-admin/companies/${companyId}/knowledge`}
      onAddSource={handleAddSource}
      onAddFaq={handleAddFaq}
      onViewSource={handleViewSource}
      onEditFaq={handleEditFaq}
    />
  );
}
