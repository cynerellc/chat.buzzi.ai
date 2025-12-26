"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  AlertCircle,
  RefreshCw,
  User,
  Bot,
  Calendar,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

import { PageHeader } from "@/components/layouts";
import {
  Card,
  Badge,
  Button,
  Avatar,
  Spinner,
  Chip,
  Input,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

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

const dateRangeOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

export default function ResolvedInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState("week");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch resolved conversations
  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/support-agent/conversations?filter=resolved");
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

  // Open conversation
  const openConversation = (conversationId: string) => {
    router.push(`/inbox/${conversationId}`);
  };

  // Get sentiment indicator
  const getSentimentIndicator = (sentiment: number | null) => {
    if (sentiment === null) return null;

    if (sentiment >= 50) {
      return (
        <div className="flex items-center gap-1 text-success text-xs">
          <ThumbsUp size={12} />
          <span>Positive</span>
        </div>
      );
    } else if (sentiment <= -50) {
      return (
        <div className="flex items-center gap-1 text-danger text-xs">
          <ThumbsDown size={12} />
          <span>Negative</span>
        </div>
      );
    }

    return null;
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conversation.endUser?.name?.toLowerCase().includes(query) ||
      conversation.endUser?.email?.toLowerCase().includes(query) ||
      conversation.lastMessage?.content.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resolved Conversations"
        description="View your completed conversations"
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search resolved conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Select
          selectedKeys={[dateRange]}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            if (selected) setDateRange(selected);
          }}
          className="w-40"
          aria-label="Date range"
          options={dateRangeOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle size={20} className="text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{filteredConversations.length}</p>
              <p className="text-xs text-muted-foreground">Total Resolved</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {filteredConversations.filter((c) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return c.lastMessageAt && new Date(c.lastMessageAt) >= today;
                }).length}
              </p>
              <p className="text-xs text-muted-foreground">Resolved Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <ThumbsUp size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {Math.round(
                  (filteredConversations.filter((c) => c.sentiment !== null && c.sentiment >= 50).length /
                    Math.max(filteredConversations.filter((c) => c.sentiment !== null).length, 1)) *
                    100
                )}
                %
              </p>
              <p className="text-xs text-muted-foreground">Positive Sentiment</p>
            </div>
          </div>
        </Card>
      </div>

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
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <CheckCircle size={64} className="opacity-30 mb-4" />
            <p className="text-sm font-medium">No resolved conversations</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery
                ? "No conversations match your search"
                : "Resolved conversations will appear here"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className="p-4 hover:bg-content2 transition-colors cursor-pointer"
                onClick={() => openConversation(conversation.id)}
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
                        <Badge variant="success" className="text-xs">
                          <CheckCircle size={10} className="mr-1" />
                          Resolved
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getSentimentIndicator(conversation.sentiment)}
                        <span className="text-xs text-muted-foreground">
                          {conversation.lastMessageAt
                            ? format(new Date(conversation.lastMessageAt), "MMM d, yyyy")
                            : ""}
                        </span>
                      </div>
                    </div>

                    {/* Last message preview */}
                    {conversation.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
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
                      <Chip size="sm"  className="text-xs">
                        {conversation.messageCount} messages
                      </Chip>
                      {conversation.agent && (
                        <Chip size="sm" chipVariant="faded" className="text-xs">
                          {conversation.agent.name}
                        </Chip>
                      )}
                      {(conversation.tags as string[])?.slice(0, 2).map((tag) => (
                        <Chip key={tag} size="sm" chipVariant="faded" className="text-xs">
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
