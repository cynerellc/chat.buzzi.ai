"use client";

import { Ban, CheckCircle, Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";

interface BulkActionsProps {
  selectedCount: number;
  onActivate: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onExport: () => void;
  isLoading?: boolean;
}

export function BulkActions({
  selectedCount,
  onActivate,
  onSuspend,
  onDelete,
  onExport,
  isLoading = false,
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
      <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
        {selectedCount} selected
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          startContent={<CheckCircle size={16} />}
          onPress={onActivate}
          isDisabled={isLoading}
        >
          Activate
        </Button>

        <Button
          variant="secondary"
          size="sm"
          startContent={<Ban size={16} />}
          onPress={onSuspend}
          isDisabled={isLoading}
        >
          Suspend
        </Button>

        <Button
          variant="secondary"
          size="sm"
          startContent={<Download size={16} />}
          onPress={onExport}
          isDisabled={isLoading}
        >
          Export
        </Button>

        <Button
          variant="secondary"
          color="danger"
          size="sm"
          startContent={<Trash2 size={16} />}
          onPress={onDelete}
          isDisabled={isLoading}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
