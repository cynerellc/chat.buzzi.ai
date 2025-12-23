"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  UserPlus,
  CreditCard,
  Settings,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

import { Card, Skeleton } from "@/components/ui";
import { useActivityFeed } from "@/hooks/master-admin";
import { cn } from "@/lib/utils";

const activityIcons: Record<string, { icon: LucideIcon; color: string }> = {
  company: { icon: Building2, color: "text-primary bg-primary/10" },
  user: { icon: UserPlus, color: "text-success bg-success/10" },
  subscription: { icon: CreditCard, color: "text-warning bg-warning/10" },
  settings: { icon: Settings, color: "text-secondary bg-secondary/10" },
  default: { icon: AlertCircle, color: "text-default-500 bg-default-100" },
};

function getActivityIcon(resource: string): { icon: LucideIcon; color: string } {
  if (resource.includes("company")) return activityIcons.company!;
  if (resource.includes("user")) return activityIcons.user!;
  if (resource.includes("subscription")) return activityIcons.subscription!;
  if (resource.includes("setting")) return activityIcons.settings!;
  return activityIcons.default!;
}

function formatActivityMessage(
  action: string,
  resource: string,
  details: Record<string, unknown>
): string {
  const resourceName = details.name ?? details.email ?? resource;

  switch (action) {
    case "create":
      return `New ${resource} created: ${resourceName}`;
    case "update":
      return `${resource} updated: ${resourceName}`;
    case "delete":
      return `${resource} deleted: ${resourceName}`;
    case "login":
      return `User logged in: ${resourceName}`;
    case "logout":
      return `User logged out: ${resourceName}`;
    default:
      return `${action} on ${resource}`;
  }
}

export function ActivityFeed() {
  const { activities, isLoading } = useActivityFeed(10);

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="font-semibold">Recent Activity</h3>
        <p className="text-sm text-default-500">Platform events</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-default-400">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          activities.map((activity) => {
            const { icon: Icon, color } = getActivityIcon(activity.resource);
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    color.split(" ")[1]
                  )}
                >
                  <Icon size={16} className={color.split(" ")[0]} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-default-700 leading-snug">
                    {formatActivityMessage(
                      activity.action,
                      activity.resource,
                      activity.details as Record<string, unknown>
                    )}
                  </p>
                  <p className="text-xs text-default-400 mt-0.5">
                    {activity.userEmail && (
                      <span className="text-default-500">
                        {activity.userEmail}
                        {" · "}
                      </span>
                    )}
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
