"use client";

import { use } from "react";
import { redirect } from "next/navigation";

// This page redirects to the main agent detail page
// The /agents/[agentId] page already serves as the agent editor

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default function AgentEditRedirectPage({ params }: PageProps) {
  const { agentId } = use(params);
  redirect(`/agents/${agentId}`);
}
