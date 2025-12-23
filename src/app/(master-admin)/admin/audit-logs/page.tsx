"use client";

import { Download } from "lucide-react";
import { useState, useCallback } from "react";

import { PageHeader } from "@/components/layouts";
import {
  AuditLogsFilters,
  AuditLogsTable,
  LogDetailModal,
} from "@/components/master-admin/audit-logs";
import { Button, Pagination } from "@/components/ui";
import {
  useAuditLogs,
  useAuditLog,
  type AuditLogListItem,
} from "@/hooks/master-admin";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { logs, pagination, isLoading } = useAuditLogs({
    page,
    pageSize: 50,
    search: search || undefined,
    action: action || undefined,
    resource: resource || undefined,
  });

  const { log: selectedLog, isLoading: isLogLoading } = useAuditLog(selectedLogId);

  const handleViewDetails = useCallback((log: AuditLogListItem) => {
    setSelectedLogId(log.id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedLogId(null);
  }, []);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export audit logs");
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Audit Logs"
        description="Track all system actions and changes"
        showBack
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Audit Logs" },
        ]}
        actions={
          <Button
            variant="flat"
            startContent={<Download size={16} />}
            onPress={handleExport}
          >
            Export Logs
          </Button>
        }
      />

      <AuditLogsFilters
        search={search}
        onSearchChange={setSearch}
        action={action}
        onActionChange={setAction}
        resource={resource}
        onResourceChange={setResource}
      />

      <AuditLogsTable
        logs={logs}
        isLoading={isLoading}
        onViewDetails={handleViewDetails}
      />

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={pagination.totalPages}
            page={page}
            onChange={setPage}
            showControls
          />
        </div>
      )}

      <p className="text-sm text-default-500 text-center mt-2">
        Showing {logs.length} of {pagination?.total ?? 0} logs
      </p>

      <LogDetailModal
        isOpen={selectedLogId !== null}
        onClose={handleCloseModal}
        log={selectedLog}
        isLoading={isLogLoading}
      />
    </div>
  );
}
