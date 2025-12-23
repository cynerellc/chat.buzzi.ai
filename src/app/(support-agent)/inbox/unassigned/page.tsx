"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  InboxIcon,
  Clock,
  AlertCircle,
  RefreshCw,
  User,
  Bot,
} from "lucide-react";

import { PageHeader } from "@/components/layouts";
import {
  Card,
  Badge,
  Button,
  Avatar,
  Spinner,
  Chip,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// Types (same as inbox page)
interface Conversation {
  id: string;
  status: string;
  subject: string | null;
  messageCount: number;
  sentiment: number | null;
  tags: string[];
  isStarred: boolean;
  createdAt: string;
  lastMessageAt: string | null;
  endUser: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    channel: string;
  } | null;
  agent: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  lastMessage: {
    content: string;
    role: string;
    createdAt: string;
  } | null;
  escalation: {
    priority: string;
    reason: string | null;
    createdAt: string;
  } | null;
}

interface ConversationsResponse {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    unassigned: number;
  };
}

export default function UnassignedInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [takingId, setTakingId] = useState<string | null>(null);

  // Fetch unassigned conversations
  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/support-agent/conversations?filter=unassigned");
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data: ConversationsResponse = await response.json();
      setConversations(data.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  // Take conversation
  const takeConversation = async (conversationId: string) => {
    setTakingId(conversationId);
    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign" }),
      });

      // Navigate to the conversation
      router.push(`/inbox/${conversationId}`);
    } catch (err) {
      console.error("Failed to take conversation:", err);
      setTakingId(null);
    }
  };

  // Take next available conversation
  const takeNext = () => {
    const firstConversation = conversations[0];
    if (firstConversation) {
      takeConversation(firstConversation.id);
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "danger";
      case "high":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unassigned Queue"
        description="Pick up conversations waiting for an agent"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              isLoading={refreshing}
            >
              <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
            </Button>
            {conversations.length > 0 && (
              <Button color="primary" size="sm" onClick={takeNext}>
                Take Next
              </Button>
            )}
          </div>
        }
      />

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-danger">
            <AlertCircle size={48} className="opacity-50 mb-4" />
            <p className="text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-default-400">
            <InboxIcon size={64} className="opacity-30 mb-4" />
            <p className="text-sm font-medium">No unassigned conversations</p>
            <p className="text-xs text-default-400 mt-1">
              All conversations are currently assigned
            </p>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="p-4 hover:bg-content2 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Customer Avatar */}
                  <Avatar
                    name={conversation.endUser?.name ?? "Anonymous"}
                    src={conversation.endUser?.avatarUrl ?? undefined}
                    size="sm"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {conversation.endUser?.name ?? "Anonymous"}
                        </span>
                        {conversation.escalation && (
                          <Badge
                            variant={getPriorityColor(conversation.escalation.priority) as "default" | "danger" | "warning"}
                          >
                            {conversation.escalation.priority}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-default-400 flex-shrink-0">
                        {conversation.lastMessageAt
                          ? formatDistanceToNow(new Date(conversation.lastMessageAt), {
                              addSuffix: true,
                            })
                          : "No messages"}
                      </span>
                    </div>

                    {/* Last message preview */}
                    {conversation.lastMessage && (
                      <p className="text-sm text-default-500 truncate mt-1">
                        {conversation.lastMessage.role === "user" && (
                          <User size={12} className="inline mr-1" />
                        )}
                        {conversation.lastMessage.role === "assistant" && (
                          <Bot size={12} className="inline mr-1" />
                        )}
                        {conversation.lastMessage.content}
                      </p>
                    )}

                    {/* Escalation reason */}
                    {conversation.escalation?.reason && (
                      <p className="text-xs text-warning-600 mt-1">
                        <AlertCircle size={12} className="inline mr-1" />
                        {conversation.escalation.reason}
                      </p>
                    )}

                    {/* Wait time and Agent */}
                    <div className="flex items-center gap-2 mt-2">
                      <Chip size="sm" variant="flat" className="text-xs">
                        <Clock size={12} className="mr-1" />
                        Waiting{" "}
                        {conversation.escalation
                          ? formatDistanceToNow(new Date(conversation.escalation.createdAt))
                          : formatDistanceToNow(new Date(conversation.createdAt))}
                      </Chip>
                      {conversation.agent && (
                        <Chip size="sm" variant="bordered" className="text-xs">
                          {conversation.agent.name}
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* Take Button */}
                  <Button
                    color="primary"
                    size="sm"
                    onClick={() => takeConversation(conversation.id)}
                    isLoading={takingId === conversation.id}
                    className="flex-shrink-0"
                  >
                    Take
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="border-info bg-info/5">
        <div className="p-4">
          <h4 className="font-medium text-info-600 mb-1">About the Queue</h4>
          <p className="text-sm text-default-500">
            These conversations have been escalated from the AI assistant and are waiting
            for a human agent. Conversations are sorted by wait time, with the longest
            waiting shown first.
          </p>
        </div>
      </Card>
    </div>
  );
}
