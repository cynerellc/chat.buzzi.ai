"use client";

import { motion } from "framer-motion";
import {
  Eye,
  Clock,
  User,
  Building2,
  FileText,
  PlusCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, Card, CardBody, Skeleton } from "@/components/ui";
import type { AuditLogListItem } from "@/hooks/master-admin";

interface AuditLogsTableProps {
  logs: AuditLogListItem[];
  isLoading: boolean;
  onViewDetails: (log: AuditLogListItem) => void;
}

type ActionConfig = {
  color: string;
  bg: string;
  icon: typeof PlusCircle;
  variant: "success" | "info" | "danger" | "warning" | "default";
};

const defaultActionConfig: ActionConfig = {
  color: "text-muted-foreground",
  bg: "bg-muted",
  icon: FileText,
  variant: "default",
};

function getActionConfig(action: string): ActionConfig {
  if (action.includes("created")) {
    return { color: "text-success", bg: "bg-success/10", icon: PlusCircle, variant: "success" };
  }
  if (action.includes("updated")) {
    return { color: "text-blue-500", bg: "bg-blue-500/10", icon: Pencil, variant: "info" };
  }
  if (action.includes("deleted")) {
    return { color: "text-destructive", bg: "bg-destructive/10", icon: Trash2, variant: "danger" };
  }
  if (action.includes("suspended")) {
    return { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle, variant: "warning" };
  }
  if (action.includes("impersonated")) {
    return { color: "text-amber-500", bg: "bg-amber-500/10", icon: UserCheck, variant: "warning" };
  }
  return defaultActionConfig;
}

function formatAction(action: string) {
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

export function AuditLogsTable({
  logs,
  isLoading,
  onViewDetails,
}: AuditLogsTableProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardBody className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No audit logs found</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Audit logs will appear here when system activities occur
            </p>
          </CardBody>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_140px_120px_140px_80px] gap-4 px-5 py-3 border-b border-border/50 bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Timestamp
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          User
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Action
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Resource
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Company
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
          Details
        </div>
      </div>

      {/* Rows */}
      <motion.div
        className="divide-y divide-border/50"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {logs.map((log) => {
          const actionConfig = getActionConfig(log.action);
          const ActionIcon = actionConfig.icon;

          return (
            <motion.div
              key={log.id}
              variants={rowVariants}
              className="group grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_120px_140px_80px] gap-2 md:gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
            >
              {/* Timestamp */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                  actionConfig.bg, actionConfig.color,
                  "group-hover:scale-105"
                )}>
                  <ActionIcon className="h-4 w-4" />
                </div>
                <div className="md:hidden flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">{formatDate(log.createdAt)}</span>
                </div>
                <span className="hidden md:block text-sm text-muted-foreground">
                  {formatDate(log.createdAt)}
                </span>
              </div>

              {/* User */}
              <div className="flex items-center">
                <span className="text-sm font-medium truncate">
                  {log.userEmail ?? log.userName ?? "System"}
                </span>
              </div>

              {/* Action */}
              <div className="flex items-center">
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
                  actionConfig.bg, actionConfig.color
                )}>
                  <ActionIcon className="h-3 w-3" />
                  {formatAction(log.action)}
                </div>
              </div>

              {/* Resource */}
              <div className="flex items-center">
                <span className="text-sm capitalize text-foreground">{log.resource}</span>
              </div>

              {/* Company */}
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground truncate">
                  {log.companyName ?? "-"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onPress={() => onViewDetails(log)}
                >
                  <Eye size={14} />
                  <span className="sr-only">View</span>
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </Card>
  );
}
