"use client";

import { Bot, Plus, MessageSquare, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  type BadgeVariant,
} from "@/components/ui";
import { useCompanyChatbots } from "@/hooks/master-admin";

import { useCompanyContext } from "../company-context";

const statusBadgeVariants: Record<string, BadgeVariant> = {
  active: "success",
  paused: "warning",
  draft: "default",
  archived: "danger",
};

export default function CompanyChatbotsPage() {
  const { company, companyId } = useCompanyContext();
  const { chatbots, isLoading } = useCompanyChatbots(companyId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Chatbots</h2>
          <p className="text-sm text-muted-foreground">
            Manage chatbots for {company?.name}
          </p>
        </div>
        <Button startContent={<Plus size={16} />}>
          Add Chatbot
        </Button>
      </div>

      {chatbots.length === 0 ? (
        <Card className="p-12 text-center">
          <Bot size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">No Chatbots Yet</h3>
          <p className="text-muted-foreground mb-4">
            This company doesn&apos;t have any chatbots configured.
          </p>
          <Button startContent={<Plus size={16} />}>
            Create First Chatbot
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {chatbots.map((chatbot) => (
            <Card key={chatbot.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/admin/companies/${companyId}/chatbots/${chatbot.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {chatbot.name}
                    </Link>
                    <Badge
                      variant={statusBadgeVariants[chatbot.status] ?? "default"}
                      size="sm"
                    >
                      {chatbot.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chatbot.description ?? chatbot.packageName}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MessageSquare size={14} />
                    <span>{chatbot.conversationCount}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/companies/${companyId}/chatbots/${chatbot.id}`}>
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
