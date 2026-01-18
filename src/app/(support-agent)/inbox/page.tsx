"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  MessageSquare,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Star,
  StarOff,
  MoreHorizontal,
  RefreshCw,
  User,
  Bot,
  AlertCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layouts";
import { useSetBreadcrumbs } from "@/contexts/page-context";
import {
  Card,
  Badge,
  Button,
  Input,
  Tabs,
  Avatar,
  Dropdown,
  Spinner,
  Chip,
} from "@/components/ui";
import type { TabItem, DropdownMenuItemData } from "@/components/ui";
import { StatCard } from "@/components/shared";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// Types
interface EndUser {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  channel: string;
}

interface Agent {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
}

interface LastMessage {
  content: string;
  role: string;
  createdAt: string;
}

interface Escalation {
  priority: string;
  reason: string | null;
  createdAt: string;
}

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
  endUser: EndUser | null;
  agent: Agent | null;
  assignedUser: AssignedUser | null;
  lastMessage: LastMessage | null;
  escalation: Escalation | null;
}

interface Stats {
  myConversations: number;
  unassigned: number;
  resolvedToday: number;
  waiting: number;
}

interface ConversationsResponse {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: Stats;
}

type FilterType = "all" | "waiting" | "active" | "resolved" | "starred" | "unassigned";

export default function SupportAgentInbox() {
  useSetBreadcrumbs([{ label: "Inbox" }]);
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats>({
    myConversations: 0,
    unassigned: 0,
    resolvedToday: 0,
    waiting: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch conversations
  const fetchConversations = useCallback(async (filter: FilterType, search?: string) => {
    try {
      setError(null);
      const params = new URLSearchParams({ filter });
      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/support-agent/conversations?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data: ConversationsResponse = await response.json();
      setConversations(data.conversations);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations(selectedFilter, searchQuery);
  }, [fetchConversations, selectedFilter, searchQuery]);

  // H8: Wrap handlers with useCallback to prevent recreation on every render
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations(selectedFilter, searchQuery);
  }, [fetchConversations, selectedFilter, searchQuery]);

  // Star/unstar conversation
  const toggleStar = useCallback(async (conversationId: string, isStarred: boolean) => {
    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isStarred ? "unstar" : "star" }),
      });

      // Update local state
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isStarred: !isStarred } : c
        )
      );
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  }, []);

  // Take conversation
  const takeConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/support-agent/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign" }),
      });

      // Refresh list
      fetchConversations(selectedFilter, searchQuery);
    } catch (err) {
      console.error("Failed to take conversation:", err);
    }
  }, [fetchConversations, selectedFilter, searchQuery]);

  // Open conversation
  const openConversation = useCallback((conversationId: string) => {
    router.push(`/inbox/${conversationId}`);
  }, [router]);

  // Get status badge
  const getStatusBadge = (conversation: Conversation) => {
    if (conversation.escalation) {
      return (
        <Badge variant="danger" className="gap-1">
          <AlertCircle size={12} />
          Escalated
        </Badge>
      );
    }

    switch (conversation.status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "waiting_human":
        return <Badge variant="warning">Waiting</Badge>;
      case "with_human":
        return <Badge variant="info">With Agent</Badge>;
      case "resolved":
        return <Badge variant="default">Resolved</Badge>;
      case "abandoned":
        return <Badge variant="default">Abandoned</Badge>;
      default:
        return <Badge variant="default">{conversation.status}</Badge>;
    }
  };

  // M7: Memoize stats data to prevent recreation on every render
  const statsData = useMemo(() => [
    {
      title: "My Conversations",
      value: stats.myConversations.toString(),
      icon: MessageSquare,
      change: 0,
    },
    {
      title: "Pending Reply",
      value: stats.waiting.toString(),
      icon: Clock,
      change: 0,
    },
    {
      title: "Resolved Today",
      value: stats.resolvedToday.toString(),
      icon: CheckCircle2,
      change: 0,
    },
  ], [stats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Manage your assigned conversations"
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsData.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            change={stat.change}
          />
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs
          selectedKey={selectedFilter}
          onSelectionChange={(key) => setSelectedFilter(key as FilterType)}
          variant="underlined"
          size="sm"
          items={[
            { key: "all", label: "All" },
            { key: "waiting", label: "Waiting", badge: stats.waiting },
            { key: "active", label: "Active" },
            { key: "resolved", label: "Resolved" },
            { key: "starred", label: "Starred" },
          ] satisfies TabItem[]}
        />

        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search size={16} className="text-muted-foreground" />}
            className="w-full sm:w-64"
          />
          <Button variant="outline" size="sm">
            <Filter size={16} />
            Filter
          </Button>
        </div>
      </div>

      {/* Conversation List */}
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
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Inbox size={64} className="opacity-30 mb-4" />
            <p className="text-sm">No conversations found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedFilter === "all"
                ? "Conversations will appear here once assigned"
                : `No ${selectedFilter} conversations`}
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
                      toggleStar(conversation.id, conversation.isStarred);
                    }}
                    className="mt-1 text-muted-foreground hover:text-warning transition-colors"
                  >
                    {conversation.isStarred ? (
                      <Star size={18} className="fill-warning text-warning" />
                    ) : (
                      <StarOff size={18} />
                    )}
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
                        {conversation.endUser?.email && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                            {conversation.endUser.email}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {conversation.lastMessageAt
                            ? formatDistanceToNow(new Date(conversation.lastMessageAt), {
                                addSuffix: true,
                              })
                            : "No messages"}
                        </span>
                        {getStatusBadge(conversation)}
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
                      {conversation.agent && (
                        <Chip size="sm"  className="text-xs">
                          {conversation.agent.name}
                        </Chip>
                      )}
                      {(conversation.tags as string[])?.slice(0, 3).map((tag) => (
                        <Chip key={tag} size="sm" chipVariant="faded" className="text-xs">
                          {tag}
                        </Chip>
                      ))}
                      {conversation.escalation && (
                        <Chip size="sm" color="danger"  className="text-xs">
                          {conversation.escalation.priority} priority
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <Dropdown
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    }
                    items={[
                      { key: "open", label: "Open" },
                      { key: "star", label: conversation.isStarred ? "Unstar" : "Star" },
                      ...(!conversation.assignedUser ? [{ key: "take", label: "Take Conversation" }] : []),
                    ] satisfies DropdownMenuItemData[]}
                    onAction={(key) => {
                      if (key === "open") openConversation(conversation.id);
                      if (key === "star") toggleStar(conversation.id, conversation.isStarred);
                      if (key === "take") takeConversation(conversation.id);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Unassigned Queue Alert */}
      {stats.unassigned > 0 && selectedFilter !== "unassigned" && (
        <Card className="border-warning bg-warning/5">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-warning" size={20} />
              <div>
                <p className="font-medium text-warning-600">
                  {stats.unassigned} unassigned conversation
                  {stats.unassigned > 1 ? "s" : ""} waiting
                </p>
                <p className="text-sm text-muted-foreground">
                  Pick up conversations from the unassigned queue
                </p>
              </div>
            </div>
            <Button
              color="warning"
              variant="secondary"
              size="sm"
              onClick={() => router.push("/inbox/unassigned")}
            >
              View Queue
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
