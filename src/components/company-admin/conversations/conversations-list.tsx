"use client";

import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  User as UserIcon,
  Bot,
  ArrowUpRight,
} from "lucide-react";

import {
  Card,
  CardBody,
  Badge,
  Skeleton,
  Button,
} from "@/components/ui";

interface Conversation {
  id: string;
  status: string;
  channel: string;
  messageCount: number;
  createdAt: string;
  lastMessageAt: string | null;
  endUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  agent: {
    id: string;
    name: string;
  };
  lastMessage: {
    content: string;
    role: "user" | "assistant" | "system";
  } | null;
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ConversationsListProps {
  conversations: Conversation[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (conversationId: string) => void;
  compact?: boolean;
}

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
};

const defaultStatus: StatusConfig = { label: "Active", variant: "info", icon: MessageSquare };

const statusConfig: Record<string, StatusConfig> = {
  active: { label: "Active", variant: "info", icon: MessageSquare },
  waiting_human: { label: "Waiting", variant: "warning", icon: Clock },
  with_human: { label: "With Human", variant: "info", icon: UserIcon },
  resolved: { label: "Resolved", variant: "success", icon: CheckCircle },
  abandoned: { label: "Abandoned", variant: "danger", icon: AlertCircle },
};

function getStatusConfig(status: string): StatusConfig {
  return statusConfig[status] ?? defaultStatus;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ConversationsList({
  conversations,
  isLoading,
  selectedId,
  onSelect,
  compact = false,
}: ConversationsListProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardBody className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-default-300" />
          <p className="text-default-500 font-medium">No conversations found</p>
          <p className="text-sm text-default-400">
            Conversations will appear here when customers start chatting
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => {
        const status = getStatusConfig(conversation.status);
        const StatusIcon = status.icon;
        const isSelected = selectedId === conversation.id;

        return (
          <Card
            key={conversation.id}
            isPressable
            onPress={() => onSelect(conversation.id)}
            className={`transition-colors ${
              isSelected ? "border-primary bg-primary/5" : "hover:bg-default-50"
            }`}
          >
            <CardBody className={compact ? "p-3" : "p-4"}>
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {conversation.endUser.avatarUrl ? (
                    <img
                      src={conversation.endUser.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">
                        {conversation.endUser.name ||
                          conversation.endUser.email ||
                          "Anonymous"}
                      </span>
                      <Badge variant={status.variant} className="shrink-0">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-default-400 shrink-0">
                      {conversation.lastMessageAt
                        ? formatTimeAgo(conversation.lastMessageAt)
                        : formatTimeAgo(conversation.createdAt)}
                    </span>
                  </div>

                  {/* Last Message */}
                  {conversation.lastMessage && !compact && (
                    <p className="text-sm text-default-500 mt-1 truncate">
                      {conversation.lastMessage.role === "assistant" && (
                        <Bot className="inline h-3 w-3 mr-1" />
                      )}
                      {conversation.lastMessage.role === "user" && (
                        <UserIcon className="inline h-3 w-3 mr-1" />
                      )}
                      {conversation.lastMessage.content}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-default-400">
                    <span className="flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      {conversation.agent.name}
                    </span>
                    <span>{conversation.messageCount} messages</span>
                    <span className="capitalize">{conversation.channel}</span>
                    {conversation.assignedTo && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {conversation.assignedTo.name || conversation.assignedTo.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* View Button */}
                {!compact && (
                  <Button
                    variant="light"
                    isIconOnly
                    size="sm"
                    onPress={() => {
                      router.push(`/conversations/${conversation.id}`);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

// Compact version for sidebar/embedded use
export function ConversationsListCompact(
  props: Omit<ConversationsListProps, "compact">
) {
  return <ConversationsList {...props} compact />;
}
