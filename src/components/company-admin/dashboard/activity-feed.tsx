"use client";

import { Activity } from "lucide-react";

import { Card, Skeleton } from "@/components/ui";
import type { ActivityItem } from "@/hooks/company";

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-2 h-2 mt-2 rounded-full bg-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{activity.userName}</span>{" "}
          <span className="text-default-500">{activity.description}</span>
        </p>
      </div>
      <span className="text-xs text-default-400 shrink-0">
        {formatTimeAgo(activity.createdAt)}
      </span>
    </div>
  );
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Recent Activity</h3>
      {activities.length > 0 ? (
        <div className="divide-y divide-default-100">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity size={40} className="text-default-300 mb-2" />
          <p className="text-default-500">No recent activity</p>
          <p className="text-sm text-default-400">
            Team activity will appear here
          </p>
        </div>
      )}
    </Card>
  );
}
