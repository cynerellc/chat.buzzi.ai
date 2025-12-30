"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  User as UserIcon,
  Bot,
} from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  Select,
  Badge,
  Input,
} from "@/components/ui";

interface ConversationFilters {
  page?: number;
  limit?: number;
  status?: string;
  agentId?: string;
  channel?: string;
  search?: string;
}

interface EndUser {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface Agent {
  name: string;
}

interface LastMessage {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  status: string;
  channel: string;
  messageCount: number;
  createdAt: string;
  lastMessageAt: string | null;
  endUser: EndUser;
  agent: Agent;
  lastMessage: LastMessage | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AgentItem {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "waiting_human", label: "Waiting for Human" },
  { value: "with_human", label: "With Human" },
  { value: "resolved", label: "Resolved" },
  { value: "abandoned", label: "Abandoned" },
];

const CHANNEL_OPTIONS = [
  { value: "all", label: "All Channels" },
  { value: "web", label: "Web Widget" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Teams" },
];

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

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ConversationsPageProps {
  title?: string;
  subtitle?: string;
  baseApiUrl: string;
  agentsApiUrl: string;
  onConversationClick: (conversationId: string) => void;
}

export function ConversationsPage({
  title = "Conversations",
  subtitle = "View and manage customer conversations across all channels",
  baseApiUrl,
  agentsApiUrl,
  onConversationClick,
}: ConversationsPageProps) {
  const [filters, setFilters] = useState<ConversationFilters>({
    page: 1,
    limit: 20,
  });
  const [searchValue, setSearchValue] = useState("");

  // Build conversations URL with filters
  const conversationsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== "all") params.append("status", filters.status);
    if (filters.agentId) params.append("agentId", filters.agentId);
    if (filters.channel && filters.channel !== "all") params.append("channel", filters.channel);
    if (filters.search) params.append("search", filters.search);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    const queryString = params.toString();
    return queryString ? `${baseApiUrl}?${queryString}` : baseApiUrl;
  }, [baseApiUrl, filters]);

  // Data fetching
  const { data: conversationsData, isLoading } = useSWR<{
    conversations: Conversation[];
    pagination: Pagination;
    statusCounts: Record<string, number>;
  }>(conversationsUrl, fetcher, { refreshInterval: 30000 });

  const { data: agentsData } = useSWR<{
    agents: AgentItem[];
  }>(agentsApiUrl, fetcher);

  const conversations = conversationsData?.conversations ?? [];
  const pagination = conversationsData?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const statusCounts = conversationsData?.statusCounts ?? {};
  const agents = agentsData?.agents ?? [];

  const agentOptions = [
    { value: "all", label: "All Agents" },
    ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
  ];

  const handleFilterChange = (key: keyof ConversationFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      search: searchValue || undefined,
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => {
          const count =
            status.value === "all"
              ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
              : statusCounts[status.value] || 0;
          const isActive = (filters.status || "all") === status.value;

          return (
            <Button
              key={status.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange("status", status.value)}
            >
              {status.label}
              {count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-muted">
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name, email, or message..."
                value={searchValue}
                onValueChange={setSearchValue}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                startContent={<Search className="h-4 w-4 text-muted-foreground" />}
                isClearable
                onClear={() => {
                  setSearchValue("");
                  handleFilterChange("search", "");
                }}
              />
            </div>

            <Select
              options={agentOptions}
              selectedKeys={new Set([filters.agentId || "all"])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                handleFilterChange("agentId", selected === "all" ? "" : (selected as string));
              }}
              className="w-[180px]"
              placeholder="All Agents"
            />

            <Select
              options={CHANNEL_OPTIONS}
              selectedKeys={new Set([filters.channel || "all"])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                handleFilterChange("channel", selected as string);
              }}
              className="w-[150px]"
            />

            <Button variant="outline" leftIcon={Filter} disabled>
              More Filters
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading conversations...</div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No conversations found</p>
              <p className="text-muted-foreground text-sm">
                Conversations will appear here when customers start chatting
              </p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {conversations.map((conversation) => {
                const status = getStatusConfig(conversation.status);
                const StatusIcon = status.icon;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => onConversationClick(conversation.id)}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors focus:outline-none focus:bg-muted"
                  >
                    <div className="flex items-start gap-4">
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
                          <span className="text-xs text-muted-foreground shrink-0">
                            {conversation.lastMessageAt
                              ? formatTimeAgo(conversation.lastMessageAt)
                              : formatTimeAgo(conversation.createdAt)}
                          </span>
                        </div>

                        {/* Last Message */}
                        {conversation.lastMessage && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
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
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Bot className="h-3 w-3" />
                            {conversation.agent.name}
                          </span>
                          <span>{conversation.messageCount} messages</span>
                          <span className="capitalize">{conversation.channel}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} conversations
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onPress={() => handlePageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onPress={() => handlePageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
