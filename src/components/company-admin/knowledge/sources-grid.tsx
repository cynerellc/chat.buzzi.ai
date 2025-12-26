"use client";

import { motion } from "framer-motion";
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
  Database,
  Layers,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  CardBody,
  Badge,
  Dropdown,
  type DropdownMenuItemData,
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
            <CardBody className="p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-6 w-16 rounded-lg" />
                <Skeleton className="h-6 w-20 rounded-lg" />
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card
          className="group flex min-h-[220px] cursor-pointer items-center justify-center border-dashed border-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
          onClick={() => router.push("/knowledge/new")}
        >
          <CardBody className="flex flex-col items-center gap-3 p-6 text-center">
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300",
              "bg-gradient-to-br from-primary/15 to-primary/5",
              "group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20"
            )}>
              <Plus className="h-7 w-7 text-primary" />
            </div>
            <span className="font-semibold group-hover:text-primary transition-colors">Add Knowledge Source</span>
            <span className="text-sm text-muted-foreground">
              Upload files, URLs, or text
            </span>
          </CardBody>
        </Card>
      </motion.div>

      {/* Source Cards */}
      {sources.map((source, index) => {
        const status = getStatusConfig(source.status);
        const StatusIcon = status.icon;
        const TypeIcon = typeIcons[source.type] || FileText;

        const statusColors: Record<string, { bg: string; text: string }> = {
          pending: { bg: "bg-muted", text: "text-muted-foreground" },
          processing: { bg: "bg-blue-500/10", text: "text-blue-500" },
          indexed: { bg: "bg-success/10", text: "text-success" },
          failed: { bg: "bg-destructive/10", text: "text-destructive" },
        };
        const statusStyle = statusColors[source.status] ?? statusColors.pending;

        const dropdownItems: DropdownMenuItemData[] = [
          { key: "view", label: "View Details", icon: Eye },
          ...(source.status === "failed"
            ? [{ key: "reprocess", label: "Reprocess", icon: RefreshCw }]
            : []),
          { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
        ];

        return (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index + 1) * 0.05 }}
          >
            <Card className={cn(
              "group min-h-[220px] hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300",
              source.status === "failed" && "border-destructive/30"
            )}>
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                      "bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
                      "group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:scale-105"
                    )}>
                      <TypeIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => handleSourceClick(source.id)}
                        className="font-semibold truncate hover:text-primary transition-colors text-left block"
                      >
                        {source.name}
                      </button>
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-1.5",
                        statusStyle.bg, statusStyle.text
                      )}>
                        <StatusIcon className={cn("h-3 w-3", source.status === "processing" && "animate-spin")} />
                        {status.label}
                      </div>
                    </div>
                  </div>

                  <Dropdown
                    trigger={
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                    {source.description}
                  </p>
                )}

                {source.processingError && (
                  <div className="mt-3 p-2 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{source.processingError}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50 text-xs">
                    <Layers className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{source.chunkCount}</span>
                    <span className="text-muted-foreground">chunks</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50 text-xs">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{formatTokenCount(source.tokenCount)}</span>
                    <span className="text-muted-foreground">tokens</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Added {formatDate(source.createdAt)}
                </p>
              </CardBody>
            </Card>
          </motion.div>
        );
      })}

      {/* Empty State */}
      {sources.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-full"
        >
          <Card className="flex min-h-[200px] items-center justify-center">
            <CardBody className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">No knowledge sources yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Add knowledge sources to help your AI agents provide accurate, contextual responses
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/knowledge/new")}
                className="mt-2"
              >
                <Plus className="h-4 w-4" />
                Add your first source
              </Button>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
