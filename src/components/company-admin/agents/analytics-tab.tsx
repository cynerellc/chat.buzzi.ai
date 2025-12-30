"use client";

import { useState } from "react";
import { Download, TrendingUp, TrendingDown, MessageSquare, Clock, ThumbsUp } from "lucide-react";

import {
  Button,
  Select,
  Card,
  CardHeader,
  CardBody,
  Skeleton,
} from "@/components/ui";
import { useAgentAnalytics } from "@/hooks/company";

interface AnalyticsTabProps {
  agentId: string;
}

const DAYS_OPTIONS = [
  { value: "7", label: "7 Days" },
  { value: "14", label: "14 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
];

export function AnalyticsTab({ agentId }: AnalyticsTabProps) {
  const [days, setDays] = useState(7);
  const { analytics, isLoading } = useAgentAnalytics(agentId, days);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardBody>
            </Card>
          ))}
        </div>
        <Card>
          <CardBody className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center p-12">
          <p className="text-default-500">No analytics data available</p>
        </CardBody>
      </Card>
    );
  }

  const resolutionBreakdown = analytics.resolutionBreakdown ?? {
    ai: 0,
    human: 0,
    abandoned: 0,
    escalated: 0,
  };

  const totalResolved =
    resolutionBreakdown.ai +
    resolutionBreakdown.human +
    resolutionBreakdown.abandoned +
    resolutionBreakdown.escalated;

  return (
    <div className="space-y-6">
      {/* Header with date range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Analytics</h2>
        <div className="flex items-center gap-2">
          <Select
            options={DAYS_OPTIONS}
            selectedKeys={new Set([days.toString()])}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];
              if (selected) setDays(parseInt(selected as string));
            }}
            className="w-32"
          />
          <Button variant="outline" size="sm" disabled startContent={<Download size={16} />}>
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Total Conversations"
          value={analytics.totalConversations.toLocaleString()}
          icon={MessageSquare}
        />
        <MetricCard
          title="AI Resolved"
          value={`${analytics.aiResolutionRate}%`}
          icon={TrendingUp}
          trend={analytics.aiResolutionRate >= 80 ? "up" : "neutral"}
        />
        <MetricCard
          title="Avg Response"
          value={analytics.avgResponseTime > 0 ? `${analytics.avgResponseTime}s` : "N/A"}
          icon={Clock}
        />
        <MetricCard
          title="Satisfaction"
          value={analytics.satisfactionScore > 0 ? `${analytics.satisfactionScore / 20}/5` : "N/A"}
          icon={ThumbsUp}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Conversation Volume */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Conversation Volume</h3>
          </CardHeader>
          <CardBody>
            <div className="h-48 flex items-end justify-between gap-1">
              {analytics.conversationsByDay.map((day, i) => {
                const maxCount = Math.max(...analytics.conversationsByDay.map((d) => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <span className="text-xs text-default-500">
                      {new Date(day.date).toLocaleDateString("en", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Resolution Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Resolution Breakdown</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <ResolutionBar
              label="AI Resolved"
              count={resolutionBreakdown.ai}
              total={totalResolved}
              color="bg-success"
            />
            <ResolutionBar
              label="Human Resolved"
              count={resolutionBreakdown.human}
              total={totalResolved}
              color="bg-primary"
            />
            <ResolutionBar
              label="Escalated"
              count={resolutionBreakdown.escalated}
              total={totalResolved}
              color="bg-warning"
            />
            <ResolutionBar
              label="Abandoned"
              count={resolutionBreakdown.abandoned}
              total={totalResolved}
              color="bg-default-400"
            />
          </CardBody>
        </Card>
      </div>

      {/* Topics and Escalation Reasons */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Top Topics</h3>
          </CardHeader>
          <CardBody>
            {analytics.topTopics.length > 0 ? (
              <ol className="space-y-2">
                {analytics.topTopics.map((topic, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>
                      {i + 1}. {topic.topic}
                    </span>
                    <span className="text-default-500">({topic.count})</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-default-500">
                Topic analysis will be available after more conversations.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Escalation Reasons</h3>
          </CardHeader>
          <CardBody>
            {analytics.escalationReasons.length > 0 ? (
              <div className="space-y-3">
                {analytics.escalationReasons.map((reason, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{reason.reason}</span>
                    <span className="text-sm text-default-500">
                      {reason.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-default-500">
                Escalation analysis will be available after more conversations.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardBody className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-default-500">{title}</span>
          <Icon className="h-4 w-4 text-default-400" />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-danger" />}
        </div>
      </CardBody>
    </Card>
  );
}

function ResolutionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-default-500">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-default-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
