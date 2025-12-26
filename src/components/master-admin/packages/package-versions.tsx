"use client";

import { format } from "date-fns";
import {
  ArrowDownToLine,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileCode,
  GitBranch,
  MoreVertical,
  Plus,
  Tag,
} from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import {
  Badge,
  Button,
  Card,
  Dropdown,
  type DropdownMenuItemData,
  Skeleton,
  type BadgeVariant,
} from "@/components/ui";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error ?? "Failed to fetch");
  }
  return res.json();
};

export interface PackageVersion {
  id: string;
  version: string;
  changelog: string | null;
  packageUrl: string | null;
  packageSize: number;
  packageHash: string | null;
  isActive: boolean;
  isCurrent: boolean;
  createdAt: string;
  createdByName: string | null;
  deploymentCount: number;
}

interface PackageVersionsProps {
  packageId: string;
  onUploadNew: () => void;
  onSetActive: (versionId: string) => void;
}

const statusBadgeVariants: Record<string, BadgeVariant> = {
  current: "success",
  active: "info",
  archived: "default",
};

export function PackageVersions({
  packageId,
  onUploadNew,
  onSetActive,
}: PackageVersionsProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set()
  );

  const { data, isLoading, error } = useSWR<{ versions: PackageVersion[] }>(
    `/api/master-admin/packages/${packageId}/versions`,
    fetcher
  );

  const toggleExpanded = (versionId: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getVersionDropdownItems = (version: PackageVersion): DropdownMenuItemData[] => {
    const items: DropdownMenuItemData[] = [];
    if (!version.isCurrent) {
      items.push({
        key: "set-current",
        label: "Set as Current",
        icon: ArrowDownToLine,
      });
    }
    items.push({
      key: "download",
      label: "Download Package",
      icon: Download,
      isDisabled: !version.packageUrl,
    });
    return items;
  };

  const handleVersionAction = (versionId: string, key: React.Key) => {
    if (key === "set-current") {
      onSetActive(versionId);
    }
    // Handle download action if needed
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-danger">{error.message}</p>
      </Card>
    );
  }

  const versions = data?.versions ?? [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch size={20} />
          <h3 className="font-semibold">Version History</h3>
          <Badge variant="default" size="sm">
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus size={16} />}
          onPress={onUploadNew}
        >
          Upload New Version
        </Button>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8">
          <FileCode size={40} className="mx-auto mb-3 text-default-300" />
          <p className="text-default-500 mb-3">No versions uploaded yet</p>
          <Button variant="secondary" startContent={<Plus size={16} />} onPress={onUploadNew}>
            Upload First Version
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <div
              key={version.id}
              className={`border rounded-lg transition-colors ${
                version.isCurrent
                  ? "border-primary bg-primary-50/50"
                  : "border-divider"
              }`}
            >
              {/* Version Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => toggleExpanded(version.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    toggleExpanded(version.id);
                  }
                }}
              >
                <div className="text-default-400">
                  {expandedVersions.has(version.id) ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-default-500" />
                  <span className="font-mono font-semibold">
                    v{version.version}
                  </span>
                </div>

                <div className="flex items-center gap-2 ml-2">
                  {version.isCurrent && (
                    <Badge variant={statusBadgeVariants.current} size="sm">
                      <Check size={12} className="mr-1" />
                      Current
                    </Badge>
                  )}
                  {version.isActive && !version.isCurrent && (
                    <Badge variant={statusBadgeVariants.active} size="sm">
                      Active
                    </Badge>
                  )}
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-4 text-sm text-default-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {format(new Date(version.createdAt), "MMM d, yyyy")}
                  </span>
                  <span>{formatFileSize(version.packageSize)}</span>
                  <span>{version.deploymentCount} deployments</span>
                </div>

                <Dropdown
                  trigger={
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={16} />
                    </Button>
                  }
                  items={getVersionDropdownItems(version)}
                  onAction={(key) => handleVersionAction(version.id, key)}
                />
              </div>

              {/* Version Details (Expanded) */}
              {expandedVersions.has(version.id) && (
                <div className="px-4 pb-4 pt-0 border-t border-divider">
                  <div className="grid gap-4 md:grid-cols-2 mt-4">
                    <div>
                      <p className="text-sm text-default-500 mb-1">Changelog</p>
                      <p className="text-sm">
                        {version.changelog ?? "No changelog provided"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-default-400" />
                        <span className="text-default-500">Uploaded:</span>
                        <span>
                          {format(
                            new Date(version.createdAt),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </span>
                      </div>
                      {version.createdByName && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-default-500">By:</span>
                          <span>{version.createdByName}</span>
                        </div>
                      )}
                      {version.packageHash && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-default-500">Hash:</span>
                          <code className="font-mono text-xs bg-default-100 px-1 rounded">
                            {version.packageHash.slice(0, 16)}...
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
