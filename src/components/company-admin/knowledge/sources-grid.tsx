"use client";

import { useRouter } from "next/navigation";
import {
  FileText,
  Link as LinkIcon,
  FileType,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  Trash2,
  Eye,
  RefreshCw,
} from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  Badge,
  Dropdown,
  type DropdownMenuItem,
  Skeleton,
} from "@/components/ui";

interface KnowledgeSource {
  id: string;
  name: string;
  description: string | null;
  type: "file" | "url" | "text";
  status: "pending" | "processing" | "indexed" | "failed";
  chunkCount: number;
  tokenCount: number;
  processingError: string | null;
  createdAt: string;
}

interface SourcesGridProps {
  sources: KnowledgeSource[];
  isLoading: boolean;
  onDelete: (sourceId: string) => void;
  onReprocess: (sourceId: string) => void;
}

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
};

const defaultStatusConfig: StatusConfig = { label: "Pending", variant: "default", icon: Clock };

const statusConfig: Record<string, StatusConfig> = {
  pending: defaultStatusConfig,
  processing: { label: "Processing", variant: "info", icon: Loader2 },
  indexed: { label: "Indexed", variant: "success", icon: CheckCircle },
  failed: { label: "Failed", variant: "danger", icon: AlertCircle },
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  url: LinkIcon,
  text: FileType,
};

function getStatusConfig(status: string): StatusConfig {
  return statusConfig[status] ?? defaultStatusConfig;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function SourcesGrid({
  sources,
  isLoading,
  onDelete,
  onReprocess,
}: SourcesGridProps) {
  const router = useRouter();

  const handleSourceClick = (sourceId: string) => {
    router.push(`/knowledge/${sourceId}`);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Create New Source Card */}
      <Card
        className="flex min-h-[180px] cursor-pointer items-center justify-center border-dashed border-2 transition-colors hover:border-primary hover:bg-default-100"
        isPressable
        onPress={() => router.push("/knowledge/new")}
      >
        <CardBody className="flex flex-col items-center gap-2 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <span className="font-medium">Add Source</span>
          <span className="text-sm text-default-500">
            Upload files, URLs, or text
          </span>
        </CardBody>
      </Card>

      {/* Source Cards */}
      {sources.map((source) => {
        const status = getStatusConfig(source.status);
        const StatusIcon = status.icon;
        const TypeIcon = typeIcons[source.type] || FileText;

        const dropdownItems: DropdownMenuItem[] = [
          { key: "view", label: "View Details", icon: Eye },
          ...(source.status === "failed"
            ? [{ key: "reprocess", label: "Reprocess", icon: RefreshCw }]
            : []),
          { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
        ];

        return (
          <Card key={source.id} className="min-h-[180px]">
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default-100">
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <button
                      onClick={() => handleSourceClick(source.id)}
                      className="font-medium truncate hover:text-primary transition-colors text-left"
                    >
                      {source.name}
                    </button>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={status.variant}>
                        <StatusIcon className={`h-3 w-3 mr-1 ${source.status === "processing" ? "animate-spin" : ""}`} />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Dropdown
                  trigger={
                    <Button variant="light" isIconOnly size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  }
                  items={dropdownItems}
                  onAction={(key) => {
                    if (key === "view") {
                      handleSourceClick(source.id);
                    } else if (key === "reprocess") {
                      onReprocess(source.id);
                    } else if (key === "delete") {
                      onDelete(source.id);
                    }
                  }}
                />
              </div>

              {source.description && (
                <p className="text-sm text-default-500 mt-3 line-clamp-2">
                  {source.description}
                </p>
              )}

              {source.processingError && (
                <p className="text-sm text-danger mt-2 line-clamp-2">
                  Error: {source.processingError}
                </p>
              )}

              <div className="flex items-center gap-4 mt-4 text-xs text-default-400">
                <span className="capitalize">{source.type}</span>
                <span>{source.chunkCount} chunks</span>
                <span>{formatTokenCount(source.tokenCount)} tokens</span>
              </div>

              <p className="text-xs text-default-400 mt-2">
                Added {formatDate(source.createdAt)}
              </p>
            </CardBody>
          </Card>
        );
      })}

      {/* Empty State */}
      {sources.length === 0 && (
        <Card className="col-span-full flex min-h-[180px] items-center justify-center">
          <CardBody className="flex flex-col items-center gap-2 p-6 text-center">
            <FileText className="h-12 w-12 text-default-400" />
            <p className="text-default-500">No knowledge sources found</p>
            <Button
              variant="bordered"
              size="sm"
              onPress={() => router.push("/knowledge/new")}
            >
              Add your first source
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
