"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Clock,
  Star,
  ExternalLink,
  MoreVertical,
  Edit2,
  Trash2,
  MapPin,
} from "lucide-react";

import { PageHeader } from "@/components/layouts";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  Card,
  Button,
  Avatar,
  Badge,
  Chip,
  Dropdown,
  Spinner,
  EmptyState,
  Tabs,
  Divider,
} from "@/components/ui";
import type { TabItem, DropdownMenuItemData } from "@/components/ui";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// Types
interface CustomerConversation {
  id: string;
  subject: string | null;
  status: string;
  channel: string;
  messageCount: number;
  sentiment: number | null;
  satisfactionRating: number | null;
  createdAt: string;
  resolvedAt: string | null;
  lastMessageAt: string | null;
  agent: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

interface CustomerData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  channel: string;
  externalId: string | null;
  metadata: Record<string, unknown> | null;
  location: {
    country?: string;
    city?: string;
    timezone?: string;
  } | null;
  totalConversations: number;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerProfileData {
  customer: CustomerData;
  conversations: CustomerConversation[];
  stats: {
    totalConversations: number;
    resolvedConversations: number;
    averageSatisfaction: number | null;
    averageSentiment: number | null;
    averageResponseTime: string | null;
  };
}

type TabFilter = "all" | "active" | "resolved";

export default function CustomerProfilePage() {
  useSetPageTitle("Customer Profile");
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [data, setData] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabFilter>("all");

  // Fetch customer data
  const fetchCustomer = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/support-agent/customers/${customerId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch customer");
      }
      const result: CustomerProfileData = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  // Filter conversations by tab
  const filteredConversations = data?.conversations.filter((conv) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "active") return conv.status !== "resolved" && conv.status !== "abandoned";
    if (selectedTab === "resolved") return conv.status === "resolved" || conv.status === "abandoned";
    return true;
  }) ?? [];

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
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
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // Get channel badge
  const getChannelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      web: "bg-blue-100 text-blue-700",
      whatsapp: "bg-green-100 text-green-700",
      telegram: "bg-sky-100 text-sky-700",
      messenger: "bg-purple-100 text-purple-700",
      slack: "bg-purple-100 text-purple-700",
      email: "bg-gray-100 text-gray-700",
    };
    return (
      <Chip size="sm" className={cn("capitalize", colors[channel] || "bg-gray-100 text-gray-700")}>
        {channel}
      </Chip>
    );
  };

  // Sentiment indicator
  const getSentimentColor = (sentiment: number | null) => {
    if (sentiment === null) return "text-muted-foreground";
    if (sentiment >= 50) return "text-success";
    if (sentiment >= 0) return "text-warning";
    return "text-danger";
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="p-8">
          <EmptyState
            icon={User}
            title="Customer not found"
            description={error || "The customer you're looking for doesn't exist."}
            action={{
              label: "Back to Inbox",
              onClick: () => router.push("/inbox"),
              variant: "ghost",
            }}
          />
        </Card>
      </div>
    );
  }

  const { customer, stats } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Profile"
        description="View customer details and conversation history"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            leftIcon={ArrowLeft}
          >
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info Card */}
        <Card className="lg:col-span-1 p-6">
          <div className="flex items-start justify-between mb-4">
            <Avatar
              name={customer.name ?? "Anonymous"}
              src={customer.avatarUrl ?? undefined}
              size="lg"
            />
            <Dropdown
              trigger={
                <Button variant="ghost" size="icon">
                  <MoreVertical size={16} />
                </Button>
              }
              items={[
                { key: "edit", label: "Edit Customer", icon: Edit2 },
                { key: "delete", label: "Delete Customer", icon: Trash2, isDanger: true },
              ] satisfies DropdownMenuItemData[]}
              onAction={(key) => {
                // Handle actions
                console.log("Action:", key);
              }}
            />
          </div>

          <h2 className="text-xl font-semibold mb-1">
            {customer.name ?? "Anonymous"}
          </h2>
          {getChannelBadge(customer.channel)}

          <Divider className="my-4" />

          {/* Contact Info */}
          <div className="space-y-3">
            {customer.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${customer.email}`} className="text-primary hover:underline truncate">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone size={16} className="text-muted-foreground flex-shrink-0" />
                <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                  {customer.phone}
                </a>
              </div>
            )}
            {customer.location?.city && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="text-muted-foreground flex-shrink-0" />
                <span>
                  {[customer.location.city, customer.location.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {customer.externalId && (
              <div className="flex items-center gap-3 text-sm">
                <ExternalLink size={16} className="text-muted-foreground flex-shrink-0" />
                <span className="font-mono text-xs truncate">{customer.externalId}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Calendar size={16} className="text-muted-foreground flex-shrink-0" />
              <span>Customer since {format(new Date(customer.createdAt), "MMM d, yyyy")}</span>
            </div>
            {customer.lastSeenAt && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-muted-foreground flex-shrink-0" />
                <span>
                  Last seen {formatDistanceToNow(new Date(customer.lastSeenAt), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>

          <Divider className="my-4" />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{stats.totalConversations}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{stats.resolvedConversations}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">
                {stats.averageSatisfaction !== null ? `${stats.averageSatisfaction.toFixed(1)}/5` : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Avg. Rating</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className={cn("text-2xl font-bold", getSentimentColor(stats.averageSentiment))}>
                {stats.averageSentiment !== null ? `${stats.averageSentiment}%` : "-"}
              </p>
              <p className="text-xs text-muted-foreground">Sentiment</p>
            </div>
          </div>

          {/* Custom Metadata */}
          {customer.metadata && Object.keys(customer.metadata).length > 0 && (
            <>
              <Divider className="my-4" />
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Custom Attributes</h3>
              <div className="space-y-2">
                {Object.entries(customer.metadata).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="font-medium truncate ml-2 max-w-[150px]">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Conversations List */}
        <Card className="lg:col-span-2">
          <div className="p-4 border-b border-divider">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Conversation History</h3>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key as TabFilter)}
                variant="underlined"
                size="sm"
                items={[
                  { key: "all", label: "All" },
                  { key: "active", label: "Active" },
                  { key: "resolved", label: "Resolved" },
                ] satisfies TabItem[]}
              />
            </div>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={MessageSquare}
                title="No conversations"
                description={
                  selectedTab === "all"
                    ? "This customer hasn't started any conversations yet."
                    : `No ${selectedTab} conversations found.`
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => router.push(`/inbox/${conversation.id}`)}
                  className="w-full p-4 text-left hover:bg-content2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {conversation.subject ?? "No subject"}
                        </span>
                        {getStatusBadge(conversation.status)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {getChannelBadge(conversation.channel)}
                        <span>{conversation.messageCount} messages</span>
                        {conversation.agent && (
                          <span className="flex items-center gap-1">
                            <Avatar
                              name={conversation.agent.name}
                              src={conversation.agent.avatarUrl ?? undefined}
                              size="sm"
                              className="w-4 h-4"
                            />
                            {conversation.agent.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                      <p>{format(new Date(conversation.createdAt), "MMM d, yyyy")}</p>
                      <p className="text-xs">
                        {formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: true })}
                      </p>
                      {conversation.satisfactionRating && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <Star size={12} className="fill-warning text-warning" />
                          <span>{conversation.satisfactionRating}/5</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
