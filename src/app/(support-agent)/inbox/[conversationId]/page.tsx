"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { useSetBreadcrumbs } from "@/contexts/page-context";
import { ConversationDetailPage } from "@/components/shared/conversations";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function LiveChatPage({ params }: PageProps) {
  useSetBreadcrumbs([{ label: "Inbox", href: "/inbox" }, { label: "Conversation" }]);
  const router = useRouter();
  const { conversationId } = use(params);

  return (
    <ConversationDetailPage
      conversationId={conversationId}
      apiBasePath="/api/support-agent/conversations"
      backUrl="/inbox"
      showAdvancedFeatures={true}
      defaultShowSidebar={true}
      showPreviousConversations={true}
      onPreviousConversationClick={(id) => router.push(`/inbox/${id}`)}
    />
  );
}
