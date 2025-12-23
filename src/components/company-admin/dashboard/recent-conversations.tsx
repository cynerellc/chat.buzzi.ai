"use client";

import { MessageSquare, ChevronRight, CheckCircle, Clock, UserCheck } from "lucide-react";
import Link from "next/link";

import { Avatar, Badge, Button, Card, Skeleton } from "@/components/ui";
import type { RecentConversation } from "@/hooks/company";

interface RecentConversationsProps {
  conversations: RecentConversation[];
  isLoading?: boolean;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "active":
      return { variant: "success" as const, label: "Active", icon: Clock };
    case "resolved":
      return { variant: "default" as const, label: "Resolved", icon: CheckCircle };
    case "escalated":
      return { variant: "warning" as const, label: "Escalated", icon: UserCheck };
    case "waiting":
      return { variant: "info" as const, label: "Waiting", icon: Clock };
    default:
      return { variant: "default" as const, label: status, icon: MessageSquare };
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function ConversationRow({ conversation }: { conversation: RecentConversation }) {
  const statusConfig = getStatusConfig(conversation.status);
  const StatusIcon = statusConfig.icon;
  const displayName =
    conversation.endUser.name || conversation.endUser.email || "Anonymous";
  const timeAgo = formatTimeAgo(
    conversation.lastMessageAt || conversation.createdAt
  );

  return (
    <Link href={`/conversations/${conversation.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-default-50 transition-colors cursor-pointer">
        <Avatar
          src={conversation.endUser.avatarUrl || undefined}
          name={displayName}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{displayName}</span>
            <span className="text-xs text-default-400">{conversation.agent.name}</span>
            <span className="text-xs text-default-400">{timeAgo}</span>
          </div>
          {conversation.lastMessage && (
            <p className="text-sm text-default-500 truncate">
              {conversation.lastMessage}
            </p>
          )}
        </div>
        <Badge variant={statusConfig.variant} className="flex items-center gap-1">
          <StatusIcon size={12} />
          {statusConfig.label}
        </Badge>
        <ChevronRight size={16} className="text-default-400" />
      </div>
    </Link>
  );
}

export function RecentConversations({
  conversations,
  isLoading,
}: RecentConversationsProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Recent Conversations</h3>
        <Button as={Link} href="/inbox" variant="light" size="sm">
          View All →
        </Button>
      </div>
      {conversations.length > 0 ? (
        <div className="divide-y divide-default-100">
          {conversations.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare size={40} className="text-default-300 mb-2" />
          <p className="text-default-500">No conversations yet</p>
          <p className="text-sm text-default-400">
            Conversations will appear here once customers start chatting
          </p>
        </div>
      )}
    </Card>
  );
}
