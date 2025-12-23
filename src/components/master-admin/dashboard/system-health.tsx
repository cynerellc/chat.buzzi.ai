"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Card, Skeleton } from "@/components/ui";
import { useSystemHealth } from "@/hooks/master-admin";
import type { HealthStatus } from "@/app/api/master-admin/dashboard/health/route";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  HealthStatus,
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  healthy: {
    icon: CheckCircle2,
    color: "text-success",
    label: "Healthy",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    label: "Warning",
  },
  critical: {
    icon: XCircle,
    color: "text-danger",
    label: "Critical",
  },
};

export function SystemHealth() {
  const { health, isLoading } = useSystemHealth();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">System Health</h3>
          <p className="text-sm text-default-500">Service status</p>
        </div>
        {health && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              statusConfig[health.overall].color
            )}
          >
            {(() => {
              const StatusIcon = statusConfig[health.overall].icon;
              return <StatusIcon size={16} />;
            })()}
            {statusConfig[health.overall].label}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))
        ) : health ? (
          <>
            {health.services.map((service) => {
              const config = statusConfig[service.status];
              const Icon = config.icon;
              return (
                <div
                  key={service.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-default-600">
                    {service.name}
                  </span>
                  <div className={cn("flex items-center gap-1.5", config.color)}>
                    <Icon size={14} />
                    <span className="text-sm">
                      {service.message ?? config.label}
                    </span>
                    {service.latency !== undefined && service.latency > 0 && (
                      <span className="text-default-400 text-xs">
                        ({service.latency}ms)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-3 mt-3 border-t border-divider">
              <div className="flex items-center justify-between text-sm">
                <span className="text-default-500">Uptime</span>
                <span className="font-medium">{health.uptime}%</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-default-500">Last Incident</span>
                <span className="font-medium">
                  {health.lastIncidentDays} days ago
                </span>
              </div>
            </div>

            <div className="pt-3">
              <Link
                href="/admin/status"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View Status Page
                <ExternalLink size={14} />
              </Link>
            </div>

            {health.lastChecked && (
              <p className="text-xs text-default-400 pt-2">
                Last checked{" "}
                {formatDistanceToNow(new Date(health.lastChecked), {
                  addSuffix: true,
                })}
              </p>
            )}
          </>
        ) : (
          <p className="text-default-400 text-center py-4">
            Unable to fetch health status
          </p>
        )}
      </div>
    </Card>
  );
}
