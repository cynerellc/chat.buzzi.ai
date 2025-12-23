"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  StarOff,
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
}

export default function StarredInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch starred conversations
  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/support-agent/conversations?filter=starred");
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

  // Toggle star
  const toggleStar = async (conversationId: string) => {
    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unstar" }),
      });

      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  };

  // Open conversation
  const openConversation = (conversationId: string) => {
    router.push(`/inbox/${conversationId}`);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "escalated":
        return <Badge variant="danger">Escalated</Badge>;
      case "resolved":
        return <Badge variant="default">Resolved</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Starred Conversations"
        description="Your important conversations"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            isLoading={refreshing}
          >
            <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
          </Button>
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
            <Star size={64} className="opacity-30 mb-4" />
            <p className="text-sm font-medium">No starred conversations</p>
            <p className="text-xs text-default-400 mt-1">
              Star important conversations to find them quickly
            </p>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="p-4 hover:bg-content2 transition-colors cursor-pointer"
                onClick={() => openConversation(conversation.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Star Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(conversation.id);
                    }}
                    className="mt-1 text-warning hover:text-default-400 transition-colors"
                  >
                    <Star size={18} className="fill-warning" />
                  </button>

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
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-default-400">
                          {conversation.lastMessageAt
                            ? formatDistanceToNow(new Date(conversation.lastMessageAt), {
                                addSuffix: true,
                              })
                            : "No messages"}
                        </span>
                        {getStatusBadge(conversation.status)}
                      </div>
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

                    {/* Tags and Agent */}
                    <div className="flex items-center gap-2 mt-2">
                      {conversation.agent && (
                        <Chip size="sm" variant="flat" className="text-xs">
                          {conversation.agent.name}
                        </Chip>
                      )}
                      {(conversation.tags as string[])?.slice(0, 3).map((tag) => (
                        <Chip key={tag} size="sm" variant="bordered" className="text-xs">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
