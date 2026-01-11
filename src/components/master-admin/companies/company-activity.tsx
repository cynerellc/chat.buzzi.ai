"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Bot,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  Key,
  LogIn,
  MessageSquare,
  RefreshCw,
  Settings,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
  type BadgeVariant,
} from "@/components/ui";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface CompanyActivityProps {
  companyId: string;
}

const actionIcons: Record<string, typeof Activity> = {
  "user.login": LogIn,
  "user.logout": LogIn,
  "user.create": User,
  "user.update": User,
  "user.delete": User,
  "agent.create": Bot,
  "agent.update": Bot,
  "agent.delete": Bot,
  "conversation.create": MessageSquare,
  "conversation.close": MessageSquare,
  "subscription.update": CreditCard,
  "subscription.cancel": CreditCard,
  "settings.update": Settings,
  "api_key.create": Key,
  "api_key.revoke": Key,
  "file.upload": FileText,
  "file.delete": FileText,
  "team.invite": Users,
  "team.remove": Users,
};

const actionBadgeVariants: Record<string, BadgeVariant> = {
  create: "success",
  update: "info",
  delete: "danger",
  login: "default",
  logout: "default",
  invite: "info",
  revoke: "warning",
  cancel: "danger",
  close: "default",
  upload: "success",
};

const filterOptions = [
  { value: "all", label: "All Activity" },
  { value: "user", label: "User Actions" },
  { value: "agent", label: "Agent Changes" },
  { value: "conversation", label: "Conversations" },
  { value: "subscription", label: "Subscription" },
  { value: "settings", label: "Settings" },
];

const timeframeOptions = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function CompanyActivity({ companyId }: CompanyActivityProps) {
  const [filter, setFilter] = useState("all");
  const [timeframe, setTimeframe] = useState("7d");

  const { data, isLoading, error, mutate } = useSWR<{
    activities: ActivityItem[];
  }>(
    `/api/master-admin/companies/${companyId}/activity?filter=${filter}&timeframe=${timeframe}`,
    fetcher
  );

  const getActionIcon = (action: string) => {
    const Icon = actionIcons[action] ?? Activity;
    return Icon;
  };

  const getActionBadgeVariant = (action: string): BadgeVariant => {
    const parts = action.split(".");
    const actionType = parts[parts.length - 1] ?? "";
    return actionBadgeVariants[actionType] ?? "default";
  };

  const formatActionLabel = (action: string): string => {
    return action
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const groupActivitiesByDate = (activities: ActivityItem[]) => {
    const groups: Record<string, ActivityItem[]> = {};

    activities.forEach((activity) => {
      const date = format(new Date(activity.createdAt), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    return groups;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-danger">{error.message}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          startContent={<RefreshCw size={16} />}
          onPress={() => mutate()}
        >
          Retry
        </Button>
      </Card>
    );
  }

  const activities = data?.activities ?? [];
  const groupedActivities = groupActivitiesByDate(activities);
  const sortedDates = Object.keys(groupedActivities).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity size={20} />
          <h3 className="font-semibold">Activity Log</h3>
          <Badge variant="default" size="sm">
            {activities.length} events
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select
            selectedKeys={new Set([filter])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setFilter(selected ?? "all");
            }}
            options={filterOptions}
            className="w-40"
            aria-label="Filter activities"
          />
          <Select
            selectedKeys={new Set([timeframe])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setTimeframe(selected ?? "7d");
            }}
            options={timeframeOptions}
            className="w-36"
            aria-label="Select timeframe"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            aria-label="Refresh activity"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Activity Timeline */}
      {activities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No Activity"
          description={`No activity found for the selected filters in the last ${
            timeframe === "24h"
              ? "24 hours"
              : timeframe === "7d"
              ? "7 days"
              : timeframe === "30d"
              ? "30 days"
              : "90 days"
          }.`}
        />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-default-400" />
                <span className="text-sm font-medium text-default-600">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                </span>
                <Badge variant="default" size="sm">
                  {(groupedActivities[date] ?? []).length} events
                </Badge>
              </div>

              {/* Activities for this date */}
              <div className="space-y-3 ml-5 border-l-2 border-divider pl-4">
                {(groupedActivities[date] ?? []).map((activity) => {
                  const Icon = getActionIcon(activity.action);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 py-2"
                    >
                      <div className="p-1.5 rounded-lg bg-default-100 -ml-6 border-2 border-background">
                        <Icon size={16} className="text-default-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={getActionBadgeVariant(activity.action)}
                            size="sm"
                          >
                            {formatActionLabel(activity.action)}
                          </Badge>
                          <span className="text-sm">
                            {activity.resource}
                            {activity.resourceId && (
                              <code className="text-xs ml-1 bg-default-100 px-1 rounded">
                                {activity.resourceId.slice(0, 8)}...
                              </code>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-default-500">
                          {activity.userName || activity.userEmail ? (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {activity.userName ?? activity.userEmail}
                            </span>
                          ) : (
                            <span className="text-default-400">System</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDistanceToNow(new Date(activity.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                          {activity.ipAddress && (
                            <span className="font-mono">
                              {activity.ipAddress}
                            </span>
                          )}
                        </div>
                        {activity.details &&
                          Object.keys(activity.details).length > 0 && (
                            <div className="mt-2 p-2 bg-default-50 rounded text-xs">
                              <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(activity.details, null, 2)}
                              </pre>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
