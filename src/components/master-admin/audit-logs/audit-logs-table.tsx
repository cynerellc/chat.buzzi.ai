"use client";

import { Eye } from "lucide-react";

import { Badge, Button, Card, Skeleton } from "@/components/ui";
import type { AuditLogListItem } from "@/hooks/master-admin";

interface AuditLogsTableProps {
  logs: AuditLogListItem[];
  isLoading: boolean;
  onViewDetails: (log: AuditLogListItem) => void;
}

function getActionBadgeColor(action: string) {
  if (action.includes("created")) return "success";
  if (action.includes("updated")) return "info";
  if (action.includes("deleted")) return "danger";
  if (action.includes("suspended")) return "warning";
  if (action.includes("impersonated")) return "warning";
  return "default";
}

function formatAction(action: string) {
  // Convert "company.created" to "Company Created"
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AuditLogsTable({
  logs,
  isLoading,
  onViewDetails,
}: AuditLogsTableProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-default-500">No audit logs found</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-default-200">
              <th className="text-left p-4 text-sm font-medium text-default-500">
                Timestamp
              </th>
              <th className="text-left p-4 text-sm font-medium text-default-500">
                User
              </th>
              <th className="text-left p-4 text-sm font-medium text-default-500">
                Action
              </th>
              <th className="text-left p-4 text-sm font-medium text-default-500">
                Resource
              </th>
              <th className="text-left p-4 text-sm font-medium text-default-500">
                Company
              </th>
              <th className="text-right p-4 text-sm font-medium text-default-500">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-default-100 hover:bg-default-50 transition-colors"
              >
                <td className="p-4">
                  <span className="text-sm text-default-600">
                    {formatDate(log.createdAt)}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm">
                    {log.userEmail ?? log.userName ?? "System"}
                  </span>
                </td>
                <td className="p-4">
                  <Badge
                    variant={getActionBadgeColor(log.action)}
                    size="sm"
                  >
                    {formatAction(log.action)}
                  </Badge>
                </td>
                <td className="p-4">
                  <span className="text-sm capitalize">{log.resource}</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-default-500">
                    {log.companyName ?? "-"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <Button
                    variant="flat"
                    size="sm"
                    startContent={<Eye size={14} />}
                    onPress={() => onViewDetails(log)}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
