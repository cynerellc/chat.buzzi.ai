"use client";

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bot,
  CheckCircle,
  Clock,
  Download,
  Minus,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layouts/page-header";
import { useSetPageTitle } from "@/contexts/page-context";
import { useCallAnalytics } from "@/hooks/company";
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
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTotalDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hours`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function getStatusColor(status: string): "success" | "warning" | "danger" | "default" | "primary" {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
    case "connecting":
      return "primary";
    case "pending":
      return "warning";
    case "failed":
    case "no_answer":
      return "danger";
    default:
      return "default";
  }
}

function getSourceIcon(source: string) {
  switch (source) {
    case "web":
      return PhoneCall;
    case "whatsapp":
      return PhoneIncoming;
    default:
      return Phone;
  }
}

export default function CallAnalyticsPage() {
  useSetPageTitle("Call Analytics");
  const [days, setDays] = useState(30);
  const {
    summary,
    dailyMetrics,
    sourceBreakdown,
    aiProviderBreakdown,
    statusBreakdown,
    topChatbots,
    recentCalls,
    dateRange,
    isLoading,
  } = useCallAnalytics(days);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Call Analytics" description="Track your voice call performance" />
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
        title="Call Analytics"
        description="Track your voice call performance"
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
          title="Total Calls"
          value={summary?.totalCalls?.toLocaleString() ?? "0"}
          icon={Phone}
          color="primary"
        />
        <StatCard
          title="Completed Calls"
          value={summary?.completedCalls?.toLocaleString() ?? "0"}
          icon={CheckCircle}
          description={
            summary?.totalCalls
              ? `${summary.successRate}% success rate`
              : undefined
          }
          color="success"
        />
        <StatCard
          title="Failed Calls"
          value={summary?.failedCalls?.toLocaleString() ?? "0"}
          icon={XCircle}
          color="danger"
        />
        <StatCard
          title="Avg. Call Duration"
          value={formatDuration(summary?.averageDurationSeconds ?? null)}
          icon={Clock}
          description={
            summary?.totalDurationSeconds
              ? `Total: ${formatTotalDuration(summary.totalDurationSeconds)}`
              : undefined
          }
          color="warning"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Success Rate"
          value={`${summary?.successRate ?? 0}%`}
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          title="Total Turns"
          value={summary?.totalTurns?.toLocaleString() ?? "0"}
          icon={Bot}
          description={
            summary?.averageTurns
              ? `Avg. ${summary.averageTurns} turns per call`
              : undefined
          }
          color="secondary"
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

      {/* Daily Metrics Chart */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Call Trends</h3>
        </CardHeader>
        <CardBody>
          {dailyMetrics.length > 0 ? (
            <div className="space-y-4">
              {/* Simple bar visualization */}
              <div className="flex items-end gap-1 h-48">
                {dailyMetrics.slice(-14).map((metric, index) => {
                  const maxCalls = Math.max(
                    ...dailyMetrics.slice(-14).map((m) => m.calls),
                    1
                  );
                  const totalHeight = (metric.calls / maxCalls) * 100;
                  const completedHeight = metric.calls > 0
                    ? (metric.completed / metric.calls) * totalHeight
                    : 0;
                  const failedHeight = metric.calls > 0
                    ? (metric.failed / metric.calls) * totalHeight
                    : 0;
                  const otherHeight = totalHeight - completedHeight - failedHeight;

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                        style={{ height: `${totalHeight}%` }}
                        title={`${metric.date}: ${metric.calls} calls (${metric.completed} completed, ${metric.failed} failed)`}
                      >
                        <div
                          className="w-full bg-success"
                          style={{ height: `${completedHeight}%` }}
                        />
                        <div
                          className="w-full bg-warning"
                          style={{ height: `${otherHeight}%` }}
                        />
                        <div
                          className="w-full bg-danger"
                          style={{ height: `${failedHeight}%` }}
                        />
                      </div>
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
                  <div className="w-3 h-3 bg-success rounded" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-warning rounded" />
                  <span>Other</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-danger rounded" />
                  <span>Failed</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No call data available for this period</p>
              <p className="text-sm text-muted-foreground mt-1">
                Analytics will appear as calls are recorded
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Call Sources</h3>
          </CardHeader>
          <CardBody>
            {Object.keys(sourceBreakdown).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(sourceBreakdown).map(([source, count]) => {
                  const total = Object.values(sourceBreakdown).reduce((a, b) => a + b, 0);
                  const percent = Math.round((count / total) * 100);
                  const SourceIcon = getSourceIcon(source);
                  return (
                    <div key={source} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SourceIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="capitalize font-medium">{source}</span>
                        </div>
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
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No source data available</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* AI Provider Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">AI Providers</h3>
          </CardHeader>
          <CardBody>
            {Object.keys(aiProviderBreakdown).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(aiProviderBreakdown).map(([provider, count]) => {
                  const total = Object.values(aiProviderBreakdown).reduce((a, b) => a + b, 0);
                  const percent = Math.round((count / total) * 100);
                  return (
                    <div key={provider} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{provider}</span>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()} ({percent}%)
                        </span>
                      </div>
                      <Progress
                        value={percent}
                        color={provider === "OPENAI" ? "success" : "primary"}
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No provider data available</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Call Status</h3>
          </CardHeader>
          <CardBody>
            {Object.keys(statusBreakdown).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(statusBreakdown).map(([status, count]) => {
                  const total = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
                  const percent = Math.round((count / total) * 100);
                  const colorMap: Record<string, "success" | "primary" | "warning" | "danger"> = {
                    completed: "success",
                    in_progress: "primary",
                    connecting: "primary",
                    pending: "warning",
                    failed: "danger",
                    no_answer: "danger",
                  };
                  return (
                    <div key={status} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="capitalize font-medium">{status.replace("_", " ")}</span>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()} ({percent}%)
                        </span>
                      </div>
                      <Progress
                        value={percent}
                        color={colorMap[status] || "primary"}
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No status data available</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Top Chatbots & Recent Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Chatbots */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Top Chatbots by Calls</h3>
          </CardHeader>
          <CardBody>
            {topChatbots.length > 0 ? (
              <TableRoot>
                <TableHeader>
                  <TableRow>
                    <TableColumn>CHATBOT</TableColumn>
                    <TableColumn>CALLS</TableColumn>
                    <TableColumn>AVG DURATION</TableColumn>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topChatbots.map((chatbot) => (
                    <TableRow key={chatbot.chatbotId}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{chatbot.chatbotName}</span>
                          <p className="text-xs text-muted-foreground">
                            {chatbot.completedCalls} completed
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{chatbot.totalCalls}</TableCell>
                      <TableCell>
                        {chatbot.averageDuration !== null
                          ? formatDuration(chatbot.averageDuration)
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableRoot>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No chatbot data available</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Calls</h3>
          </CardHeader>
          <CardBody>
            {recentCalls.length > 0 ? (
              <TableRoot>
                <TableHeader>
                  <TableRow>
                    <TableColumn>CHATBOT</TableColumn>
                    <TableColumn>SOURCE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>DURATION</TableColumn>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{call.chatbotName}</span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(call.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm">
                          {call.source}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" color={getStatusColor(call.status)}>
                          {call.status.replace("_", " ")}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        {call.durationSeconds !== null
                          ? formatDuration(call.durationSeconds)
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableRoot>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PhoneMissed className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent calls</p>
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
              <h4 className="font-medium mb-1">Call Performance Insights</h4>
              <p className="text-sm text-muted-foreground">
                {summary?.successRate && summary.successRate >= 80
                  ? "Excellent call completion rate! Your voice AI is performing well. Consider expanding to more channels."
                  : summary?.successRate && summary.successRate >= 60
                  ? "Good call performance. Review failed calls to identify common issues and improve success rate."
                  : summary?.totalCalls && summary.totalCalls > 0
                  ? "Consider reviewing your voice configuration and system prompts to improve call completion rates."
                  : "No call data yet. Configure voice settings on your chatbots to start receiving calls."}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
