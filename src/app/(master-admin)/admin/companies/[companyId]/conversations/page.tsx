"use client";

import { MessageSquare } from "lucide-react";

import { Card } from "@/components/ui";

import { useCompanyContext } from "../company-context";

export default function CompanyConversationsPage() {
  const { company } = useCompanyContext();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Conversations</h2>
        <p className="text-sm text-muted-foreground">
          View conversations for {company?.name}
        </p>
      </div>

      <Card className="p-12 text-center">
        <MessageSquare size={48} className="mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="font-semibold mb-2">No Conversations</h3>
        <p className="text-muted-foreground">
          This company doesn&apos;t have any conversations yet.
        </p>
      </Card>
    </div>
  );
}
