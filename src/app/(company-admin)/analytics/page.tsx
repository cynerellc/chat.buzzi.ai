"use client";

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bot,
  CheckCircle,
  Clock,
  Download,
  MessageSquare,
  Minus,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layouts/page-header";
import { useSetPageTitle } from "@/contexts/page-context";
import { useAnalytics } from "@/hooks/company";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Select,
  Skeleton,
  TableRoot,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/ui";

const dateRangeOptions = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendValue,
  color = "primary",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "primary" | "success" | "warning" | "danger" | "secondary";
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    secondary: "bg-secondary/10 text-secondary",
  };

  return (
    <Card>
      <CardBody className="p-6">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && trendValue && (
            <div
              className={`flex items-center gap-1 text-sm ${
                trend === "up"
                  ? "text-success"
                  : trend === "down"
                  ? "text-danger"
                  : "text-muted-foreground"
              }`}
            >
              {trend === "up" ? (
                <ArrowUp className="w-4 h-4" />
              ) : trend === "down" ? (
                <ArrowDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              {trendValue}
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{title}</p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export default function AnalyticsPage() {
  useSetPageTitle("Analytics");
  const [days, setDays] = useState(30);
  const { summary, dailyMetrics, topTopics, channelBreakdown, dateRange, isLoading } =
    useAnalytics(days);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Track your support performance" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Track your support performance"
        actions={
          <div className="flex gap-2">
            <Select
              options={dateRangeOptions}
              value={days.toString()}
              onValueChange={(value) => {
                if (value) setDays(parseInt(value));
              }}
              className="w-40"
            />
            <Button variant="outline" leftIcon={Download}>
              Export
            </Button>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Conversations"
          value={summary?.totalConversations?.toLocaleString() ?? "0"}
          icon={MessageSquare}
          color="primary"
        />
        <StatCard
          title="Resolved"
          value={summary?.resolvedConversations?.toLocaleString() ?? "0"}
          icon={CheckCircle}
          description={
            summary?.totalConversations
              ? `${Math.round(
                  (summary.resolvedConversations / summary.totalConversations) * 100
                )}% resolution rate`
              : undefined
          }
          color="success"
        />
        <StatCard
          title="AI Resolution Rate"
          value={`${summary?.aiResolutionRate ?? 0}%`}
          icon={Bot}
          description="Resolved without human help"
          color="secondary"
        />
        <StatCard
          title="Avg. Resolution Time"
          value={formatDuration(summary?.averageResolutionTime ?? null)}
          icon={Clock}
          color="warning"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Escalated"
          value={summary?.escalatedConversations?.toLocaleString() ?? "0"}
          icon={Users}
          description={
            summary?.totalConversations
              ? `${Math.round(
                  (summary.escalatedConversations / summary.totalConversations) * 100
                )}% escalation rate`
              : undefined
          }
          color="warning"
        />
        <StatCard
          title="Satisfaction Score"
          value={summary?.satisfactionScore ? `${summary.satisfactionScore}/5` : "N/A"}
          icon={Star}
          color="success"
        />
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date Range</p>
                <p className="font-medium">
                  {dateRange ? `${dateRange.start} to ${dateRange.end}` : "N/A"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Daily Metrics Chart Placeholder */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Conversation Trends</h3>
        </CardHeader>
        <CardBody>
          {dailyMetrics.length > 0 ? (
            <div className="space-y-4">
              {/* Simple bar visualization */}
              <div className="flex items-end gap-1 h-48">
                {dailyMetrics.slice(-14).map((metric, index) => {
                  const maxConversations = Math.max(
                    ...dailyMetrics.slice(-14).map((m) => m.conversations),
                    1
                  );
                  const height = (metric.conversations / maxConversations) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-primary rounded-t transition-all"
                        style={{ height: `${height}%` }}
                        title={`${metric.date}: ${metric.conversations} conversations`}
                      />
                      <span className="text-xs text-muted-foreground rotate-45 origin-left">
                        {new Date(metric.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded" />
                  <span>Conversations</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No data available for this period</p>
              <p className="text-sm text-muted-foreground mt-1">
                Analytics will appear as conversations are recorded
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Channel Breakdown & Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Channel Breakdown</h3>
          </CardHeader>
          <CardBody>
            {Object.keys(channelBreakdown).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(channelBreakdown).map(([channel, count]) => {
                  const total = Object.values(channelBreakdown).reduce((a, b) => a + b, 0);
                  const percent = Math.round((count / total) * 100);
                  return (
                    <div key={channel} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="capitalize font-medium">{channel}</span>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()} ({percent}%)
                        </span>
                      </div>
                      <Progress value={percent} color="primary" className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No channel data available</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Top Topics */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Top Topics</h3>
          </CardHeader>
          <CardBody>
            {topTopics.length > 0 ? (
              <TableRoot>
                <TableHeader>
                  <TableRow>
                    <TableColumn>TOPIC</TableColumn>
                    <TableColumn>COUNT</TableColumn>
                    <TableColumn>RESOLUTION</TableColumn>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topTopics.map((topic, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <span className="font-medium">{topic.topic}</span>
                      </TableCell>
                      <TableCell>{topic.occurrences}</TableCell>
                      <TableCell>
                        {topic.resolutionRate !== null ? (
                          <Chip
                            size="sm"
                            color={topic.resolutionRate >= 80 ? "success" : "warning"}
                          >
                            {topic.resolutionRate}%
                          </Chip>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableRoot>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Topic analysis will appear as more conversations are recorded</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Performance Tips */}
      <Card>
        <CardBody className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Performance Insights</h4>
              <p className="text-sm text-muted-foreground">
                {summary?.aiResolutionRate && summary.aiResolutionRate >= 70
                  ? "Your AI is handling most queries effectively. Consider expanding the knowledge base to improve further."
                  : summary?.aiResolutionRate && summary.aiResolutionRate >= 50
                  ? "Good AI performance. Review escalated conversations to identify areas for improvement."
                  : "Consider adding more training data to your knowledge base to improve AI resolution rates."}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
