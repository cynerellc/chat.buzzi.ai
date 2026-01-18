"use client";

import { use } from "react";

import { useSetBreadcrumbs } from "@/contexts/page-context";
import { ConversationDetailPage } from "@/components/shared/conversations";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationDetail({ params }: PageProps) {
  const { conversationId } = use(params);

  useSetBreadcrumbs([
    { label: "Conversations", href: "/conversations" },
    { label: "Conversation" },
  ]);

  return (
    <ConversationDetailPage
      conversationId={conversationId}
      apiBasePath="/api/company/conversations"
      backUrl="/conversations"
      showAdvancedFeatures={false}
      defaultShowSidebar={true}
      showPreviousConversations={false}
    />
  );
}
