"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Link as LinkIcon,
  FileType,
  Plus,
  Search,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Input as HeroInput, Checkbox } from "@heroui/react";
import useSWR from "swr";

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Skeleton,
} from "@/components/ui";

import type { AgentDetail } from "@/hooks/company/useAgents";

interface KnowledgeSource {
  id: string;
  name: string;
  type: "file" | "url" | "text";
  status: "pending" | "processing" | "indexed" | "failed";
  chunkCount: number;
  tokenCount: number;
  createdAt: string;
}

interface KnowledgeResponse {
  sources: KnowledgeSource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface KnowledgeTabProps {
  agent: AgentDetail;
  onSave: (data: Partial<AgentDetail>) => Promise<void>;
  isSaving: boolean;
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
  indexed: { label: "Indexed", variant: "success", icon: Check },
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

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function KnowledgeTab({ agent, onSave, isSaving }: KnowledgeTabProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(agent.knowledgeSourceIds || [])
  );

  const { data, isLoading } = useSWR<KnowledgeResponse>(
    `/api/company/knowledge?limit=100`,
    fetcher
  );

  const sources = data?.sources ?? [];
  const filteredSources = sources.filter(
    (source) =>
      source.name.toLowerCase().includes(searchValue.toLowerCase()) &&
      source.status === "indexed"
  );

  const handleToggleSource = (sourceId: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
    } else {
      newSelected.add(sourceId);
    }
    setSelectedSources(newSelected);
  };

  const handleSave = async () => {
    await onSave({
      knowledgeSourceIds: Array.from(selectedSources),
    });
  };

  const hasChanges = () => {
    const currentIds = new Set(agent.knowledgeSourceIds || []);
    if (currentIds.size !== selectedSources.size) return true;
    for (const id of selectedSources) {
      if (!currentIds.has(id)) return true;
    }
    return false;
  };

  const selectedCount = selectedSources.size;
  const totalTokens = filteredSources
    .filter((s) => selectedSources.has(s.id))
    .reduce((sum, s) => sum + s.tokenCount, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Selected Sources</p>
            <p className="text-2xl font-bold">{selectedCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Total Tokens</p>
            <p className="text-2xl font-bold">{formatTokenCount(totalTokens)}</p>
          </CardBody>
        </Card>
      </div>

      {/* Knowledge Sources */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Knowledge Sources</h2>
          <Button
            as={Link}
            href="/knowledge/new"
            variant="bordered"
            size="sm"
            leftIcon={Plus}
          >
            Add Source
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-default-500">
            Select knowledge sources to include in this agent&apos;s context.
            The agent will use these sources to answer questions.
          </p>

          <HeroInput
            placeholder="Search sources..."
            value={searchValue}
            onValueChange={setSearchValue}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => setSearchValue("")}
          />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-8 text-default-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-default-300" />
              <p>No indexed knowledge sources found</p>
              <Button
                as={Link}
                href="/knowledge/new"
                variant="bordered"
                size="sm"
                className="mt-4"
              >
                Add Your First Source
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSources.map((source) => {
                const status = getStatusConfig(source.status);
                const StatusIcon = status.icon;
                const TypeIcon = typeIcons[source.type] || FileText;
                const isSelected = selectedSources.has(source.id);

                return (
                  <div
                    key={source.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "hover:bg-default-50"
                    }`}
                    onClick={() => handleToggleSource(source.id)}
                  >
                    <Checkbox
                      isSelected={isSelected}
                      onValueChange={() => handleToggleSource(source.id)}
                    />

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default-100">
                      <TypeIcon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{source.name}</span>
                        <Badge variant={status.variant}>
                          <StatusIcon className={`h-3 w-3 mr-1 ${source.status === "processing" ? "animate-spin" : ""}`} />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-default-400">
                        <span className="capitalize">{source.type}</span>
                        <span>{source.chunkCount} chunks</span>
                        <span>{formatTokenCount(source.tokenCount)} tokens</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Link to Knowledge Base */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-default-500">
              Need more knowledge sources?
            </p>
            <Button
              as={Link}
              href="/knowledge"
              variant="light"
              size="sm"
              rightIcon={ExternalLink}
            >
              Manage Knowledge Base
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          color="primary"
          onPress={handleSave}
          isDisabled={!hasChanges()}
          isLoading={isSaving}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
