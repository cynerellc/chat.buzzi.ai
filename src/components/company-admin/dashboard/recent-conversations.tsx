"use client";

import { motion } from "framer-motion";
import { MessageSquare, ChevronRight, CheckCircle, Clock, UserCheck, ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Avatar, Badge, Button, Card, CardHeader, CardBody, Skeleton } from "@/components/ui";
import type { RecentConversation } from "@/hooks/company";

interface RecentConversationsProps {
  conversations: RecentConversation[];
  isLoading?: boolean;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "active":
      return { variant: "success" as const, label: "Active", icon: Clock, bg: "bg-success/10", text: "text-success" };
    case "resolved":
      return { variant: "default" as const, label: "Resolved", icon: CheckCircle, bg: "bg-muted", text: "text-muted-foreground" };
    case "escalated":
      return { variant: "warning" as const, label: "Escalated", icon: UserCheck, bg: "bg-warning/10", text: "text-warning" };
    case "waiting":
      return { variant: "info" as const, label: "Waiting", icon: Clock, bg: "bg-blue-500/10", text: "text-blue-500" };
    default:
      return { variant: "default" as const, label: status, icon: MessageSquare, bg: "bg-muted", text: "text-muted-foreground" };
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

function ConversationRow({ conversation, index }: { conversation: RecentConversation; index: number }) {
  const statusConfig = getStatusConfig(conversation.status);
  const StatusIcon = statusConfig.icon;
  const displayName =
    conversation.endUser.name || conversation.endUser.email || "Anonymous";
  const timeAgo = formatTimeAgo(
    conversation.lastMessageAt || conversation.createdAt
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/conversations/${conversation.id}`}>
        <div className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 cursor-pointer">
          <div className="relative">
            <Avatar
              src={conversation.endUser.avatarUrl || undefined}
              name={displayName}
              size="sm"
              className="ring-2 ring-background"
            />
            {conversation.status === "active" && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-medium truncate group-hover:text-primary transition-colors">{displayName}</span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded-md">{conversation.agent.name}</span>
            </div>
            {conversation.lastMessage && (
              <p className="text-sm text-muted-foreground truncate">
                {conversation.lastMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              statusConfig.bg, statusConfig.text
            )}>
              <StatusIcon size={10} />
              {statusConfig.label}
            </div>
            <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function RecentConversations({
  conversations,
  isLoading,
}: RecentConversationsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="font-semibold">Recent Conversations</h3>
            <p className="text-sm text-muted-foreground">Latest customer interactions</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="group">
            <Link href="/conversations" className="flex items-center gap-1">
              View All
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        {conversations.length > 0 ? (
          <div className="space-y-1">
            {conversations.map((conversation, index) => (
              <ConversationRow key={conversation.id} conversation={conversation} index={index} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Inbox size={28} className="text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No conversations yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Conversations will appear here once customers start chatting with your agents
            </p>
          </motion.div>
        )}
      </CardBody>
    </Card>
  );
}
