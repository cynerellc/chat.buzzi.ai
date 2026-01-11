"use client";

import { use } from "react";

import { useSetPageTitle } from "@/contexts/page-context";
import { ConversationDetailPage } from "@/components/shared/conversations";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationDetail({ params }: PageProps) {
  useSetPageTitle("Conversation");
  const { conversationId } = use(params);

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
