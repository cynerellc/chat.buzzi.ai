"use client";

import { motion } from "framer-motion";
import {
  Clock,
  User,
  Shield,
  Globe,
  Monitor,
  Building2,
  FileText,
  Hash,
  ArrowRight,
  X,
  PlusCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Button,
  Skeleton,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import type { AuditLogDetails } from "@/hooks/master-admin";

interface LogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogDetails | undefined;
  isLoading: boolean;
}

type ActionConfig = {
  color: string;
  bg: string;
  icon: typeof PlusCircle;
};

function getActionConfig(action: string): ActionConfig {
  if (action.includes("created")) {
    return { color: "text-success", bg: "bg-success/10", icon: PlusCircle };
  }
  if (action.includes("updated")) {
    return { color: "text-blue-500", bg: "bg-blue-500/10", icon: Pencil };
  }
  if (action.includes("deleted")) {
    return { color: "text-destructive", bg: "bg-destructive/10", icon: Trash2 };
  }
  if (action.includes("suspended")) {
    return { color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle };
  }
  if (action.includes("impersonated")) {
    return { color: "text-amber-500", bg: "bg-amber-500/10", icon: UserCheck };
  }
  return { color: "text-muted-foreground", bg: "bg-muted", icon: FileText };
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAction(action: string) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface ChangesTableProps {
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

function ChangesTable({ oldValues, newValues }: ChangesTableProps) {
  if (!oldValues && !newValues) {
    return (
      <div className="p-4 rounded-xl bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">No changes recorded</p>
      </div>
    );
  }

  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ]);

  if (allKeys.size === 0) {
    return (
      <div className="p-4 rounded-xl bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">No changes recorded</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_24px_1fr] gap-2 px-4 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div>Field</div>
        <div>Before</div>
        <div></div>
        <div>After</div>
      </div>
      <div className="divide-y divide-border/50">
        {[...allKeys].map((key) => {
          const oldVal = oldValues?.[key];
          const newVal = newValues?.[key];
          const hasChanged = oldVal !== newVal;

          return (
            <div
              key={key}
              className={cn(
                "grid grid-cols-[1fr_1fr_24px_1fr] gap-2 px-4 py-3 text-sm",
                hasChanged && "bg-primary/5"
              )}
            >
              <div className="font-medium text-foreground">{key}</div>
              <div className={cn(
                "truncate",
                hasChanged ? "text-destructive/70 line-through" : "text-muted-foreground"
              )}>
                {oldVal !== undefined ? String(oldVal) : "-"}
              </div>
              <div className="flex items-center justify-center">
                {hasChanged && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className={cn(
                "truncate",
                hasChanged ? "text-success font-medium" : "text-muted-foreground"
              )}>
                {newVal !== undefined ? String(newVal) : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  isCode,
}: {
  icon: typeof User;
  label: string;
  value: string;
  isCode?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isCode ? (
          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {value}
          </code>
        ) : (
          <p className="text-sm font-medium truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

export function LogDetailModal({
  isOpen,
  onClose,
  log,
  isLoading,
}: LogDetailModalProps) {
  const actionConfig = log ? getActionConfig(log.action) : null;
  const ActionIcon = actionConfig?.icon ?? FileText;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            actionConfig?.bg ?? "bg-muted",
            actionConfig?.color ?? "text-muted-foreground"
          )}>
            <ActionIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Audit Log Details</h2>
            {log && (
              <p className="text-sm text-muted-foreground">
                {formatAction(log.action)}
              </p>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : log ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Timestamp */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatDateTime(log.createdAt)}
              </div>

              {/* Performed By Section */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Performed By
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    icon={User}
                    label="User"
                    value={`${log.userName ?? "Unknown"} (${log.userEmail ?? "-"})`}
                  />
                  <InfoItem
                    icon={Shield}
                    label="Role"
                    value={log.userRole ?? "-"}
                  />
                  <InfoItem
                    icon={Globe}
                    label="IP Address"
                    value={log.ipAddress ?? "-"}
                  />
                  <InfoItem
                    icon={Monitor}
                    label="User Agent"
                    value={log.userAgent ?? "-"}
                  />
                </div>
              </div>

              {/* Resource Section */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Resource
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem
                    icon={FileText}
                    label="Type"
                    value={log.resource}
                  />
                  <InfoItem
                    icon={Hash}
                    label="Resource ID"
                    value={log.resourceId ?? "-"}
                    isCode
                  />
                  {log.companyName && (
                    <InfoItem
                      icon={Building2}
                      label="Company"
                      value={log.companyName}
                    />
                  )}
                </div>
              </div>

              {/* Changes Section */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Changes
                </h4>
                <ChangesTable
                  oldValues={log.oldValues}
                  newValues={log.newValues}
                />
              </div>
            </motion.div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Log not found</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onPress={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
