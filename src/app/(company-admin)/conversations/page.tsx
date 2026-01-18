"use client";

import { useRouter } from "next/navigation";

import { ConversationsPage } from "@/components/shared/conversations";
import { useSetBreadcrumbs } from "@/contexts/page-context";

export default function CompanyConversationsPage() {
  useSetBreadcrumbs([{ label: "Conversations" }]);
  const router = useRouter();

  const handleConversationClick = (conversationId: string) => {
    router.push(`/conversations/${conversationId}`);
  };

  return (
    <ConversationsPage
      title="Conversations"
      subtitle="View and manage customer conversations across all channels"
      baseApiUrl="/api/company/conversations"
      chatbotsApiUrl="/api/company/chatbots"
      onConversationClick={handleConversationClick}
    />
  );
}
