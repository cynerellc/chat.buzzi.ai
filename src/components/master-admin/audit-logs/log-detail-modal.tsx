"use client";

import {
  Badge,
  Button,
  Card,
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
    return <p className="text-sm text-default-500">No changes recorded</p>;
  }

  const allKeys = new Set([
    ...Object.keys(oldValues ?? {}),
    ...Object.keys(newValues ?? {}),
  ]);

  if (allKeys.size === 0) {
    return <p className="text-sm text-default-500">No changes recorded</p>;
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-default-200">
            <th className="text-left p-3 text-default-500">Field</th>
            <th className="text-left p-3 text-default-500">Before</th>
            <th className="text-left p-3 text-default-500">After</th>
          </tr>
        </thead>
        <tbody>
          {[...allKeys].map((key) => (
            <tr key={key} className="border-b border-default-100">
              <td className="p-3 font-medium">{key}</td>
              <td className="p-3 text-default-500">
                {oldValues?.[key] !== undefined
                  ? String(oldValues[key])
                  : "-"}
              </td>
              <td className="p-3">
                {newValues?.[key] !== undefined
                  ? String(newValues[key])
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function LogDetailModal({
  isOpen,
  onClose,
  log,
  isLoading,
}: LogDetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader>Audit Log Details</ModalHeader>
        <ModalBody>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : log ? (
            <div className="space-y-6">
              {/* Action Info */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Action:</span>
                  <Badge>{formatAction(log.action)}</Badge>
                </div>
                <p className="text-sm text-default-500">
                  {formatDateTime(log.createdAt)}
                </p>
              </div>

              {/* Performed By */}
              <div>
                <h4 className="font-medium mb-2 border-b border-default-200 pb-1">
                  Performed By
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-default-500">User:</span>{" "}
                    {log.userName ?? "Unknown"} ({log.userEmail ?? "-"})
                  </div>
                  <div>
                    <span className="text-default-500">Role:</span>{" "}
                    <span className="capitalize">{log.userRole ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-default-500">IP Address:</span>{" "}
                    {log.ipAddress ?? "-"}
                  </div>
                  <div>
                    <span className="text-default-500">User Agent:</span>{" "}
                    <span className="text-xs truncate block">
                      {log.userAgent ?? "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resource */}
              <div>
                <h4 className="font-medium mb-2 border-b border-default-200 pb-1">
                  Resource
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-default-500">Type:</span>{" "}
                    <span className="capitalize">{log.resource}</span>
                  </div>
                  <div>
                    <span className="text-default-500">ID:</span>{" "}
                    <code className="text-xs bg-default-100 px-1 py-0.5 rounded">
                      {log.resourceId ?? "-"}
                    </code>
                  </div>
                  {log.companyName && (
                    <div className="col-span-2">
                      <span className="text-default-500">Company:</span>{" "}
                      {log.companyName}
                    </div>
                  )}
                </div>
              </div>

              {/* Changes */}
              <div>
                <h4 className="font-medium mb-2 border-b border-default-200 pb-1">
                  Changes
                </h4>
                <ChangesTable
                  oldValues={log.oldValues}
                  newValues={log.newValues}
                />
              </div>
            </div>
          ) : (
            <p className="text-default-500">Log not found</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
