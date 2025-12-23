"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Link as LinkIcon,
  FileType,
  Plus,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  Trash2,
  Eye,
  MessageSquareText,
} from "lucide-react";
import { Input as HeroInput, Tabs, Tab } from "@heroui/react";
import { addToast } from "@heroui/react";

import {
  Button,
  Card,
  CardBody,
  Select,
  Badge,
  Dropdown,
  type DropdownMenuItem,
} from "@/components/ui";
import { useKnowledgeSources, useFaqs } from "@/hooks/company";
import type { KnowledgeFilters } from "@/hooks/company/useKnowledge";

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "file", label: "Files" },
  { value: "url", label: "URLs" },
  { value: "text", label: "Text" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "indexed", label: "Indexed" },
  { value: "failed", label: "Failed" },
];

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

export default function KnowledgePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("sources");
  const [filters, setFilters] = useState<KnowledgeFilters>({
    page: 1,
    limit: 20,
  });
  const [searchValue, setSearchValue] = useState("");

  const { sources, pagination, isLoading, mutate } = useKnowledgeSources(filters);
  const { faqs, isLoading: isLoadingFaqs, mutate: mutateFaqs } = useFaqs();

  const handleFilterChange = (key: keyof KnowledgeFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleSourceClick = (sourceId: string) => {
    router.push(`/knowledge/${sourceId}`);
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const response = await fetch(`/api/company/knowledge/${sourceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        addToast({ title: "Knowledge source deleted", color: "success" });
        mutate();
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      addToast({ title: "Failed to delete knowledge source", color: "danger" });
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    try {
      const response = await fetch(`/api/company/knowledge/faq/${faqId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        addToast({ title: "FAQ deleted", color: "success" });
        mutateFaqs();
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      addToast({ title: "Failed to delete FAQ", color: "danger" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-default-500">
            Manage documents, URLs, and FAQs that power your AI agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            leftIcon={MessageSquareText}
            onPress={() => router.push("/knowledge/new?type=faq")}
          >
            Add FAQ
          </Button>
          <Button
            color="primary"
            leftIcon={Plus}
            onPress={() => router.push("/knowledge/new")}
          >
            Add Source
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
      >
        <Tab key="sources" title="Knowledge Sources" />
        <Tab key="faqs" title="FAQs" />
      </Tabs>

      {activeTab === "sources" ? (
        <>
          {/* Filters */}
          <Card>
            <CardBody>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <HeroInput
                    placeholder="Search sources..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                    startContent={<Search className="h-4 w-4 text-default-400" />}
                    isClearable
                    onClear={() => setSearchValue("")}
                  />
                </div>

                <Select
                  options={TYPE_OPTIONS}
                  selectedKeys={new Set([filters.type || "all"])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    handleFilterChange("type", selected as string);
                  }}
                  className="w-[150px]"
                />

                <Select
                  options={STATUS_OPTIONS}
                  selectedKeys={new Set([filters.status || "all"])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    handleFilterChange("status", selected as string);
                  }}
                  className="w-[150px]"
                />
              </div>
            </CardBody>
          </Card>

          {/* Sources List */}
          <Card>
            <CardBody className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-default-500">Loading sources...</div>
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-default-300 mb-4" />
                  <p className="text-default-500 font-medium">No knowledge sources</p>
                  <p className="text-default-400 text-sm mb-4">
                    Add documents, URLs, or text to train your AI agents
                  </p>
                  <Button
                    color="primary"
                    leftIcon={Plus}
                    onPress={() => router.push("/knowledge/new")}
                  >
                    Add Your First Source
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {sources.map((source) => {
                    const status = getStatusConfig(source.status);
                    const StatusIcon = status.icon;
                    const TypeIcon = typeIcons[source.type] || FileText;

                    const dropdownItems: DropdownMenuItem[] = [
                      { key: "view", label: "View Details", icon: Eye },
                      { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
                    ];

                    return (
                      <div
                        key={source.id}
                        className="p-4 hover:bg-default-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {/* Icon */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default-100">
                            <TypeIcon className="h-5 w-5" />
                          </div>

                          {/* Content */}
                          <button
                            onClick={() => handleSourceClick(source.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{source.name}</span>
                              <Badge variant={status.variant}>
                                <StatusIcon className={`h-3 w-3 mr-1 ${source.status === "processing" ? "animate-spin" : ""}`} />
                                {status.label}
                              </Badge>
                            </div>
                            {source.description && (
                              <p className="text-sm text-default-500 truncate mt-1">
                                {source.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-default-400">
                              <span className="capitalize">{source.type}</span>
                              <span>{source.chunkCount} chunks</span>
                              <span>{formatTokenCount(source.tokenCount)} tokens</span>
                              <span>Added {formatDate(source.createdAt)}</span>
                            </div>
                          </button>

                          {/* Actions */}
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
                              } else if (key === "delete") {
                                handleDeleteSource(source.id);
                              }
                            }}
                          />
                        </div>

                        {/* Error message */}
                        {source.processingError && (
                          <div className="mt-2 p-2 rounded bg-danger-50 text-danger-600 text-sm">
                            Error: {source.processingError}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          {/* FAQs List */}
          <Card>
            <CardBody className="p-0">
              {isLoadingFaqs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-default-500">Loading FAQs...</div>
                </div>
              ) : faqs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquareText className="h-12 w-12 text-default-300 mb-4" />
                  <p className="text-default-500 font-medium">No FAQs yet</p>
                  <p className="text-default-400 text-sm mb-4">
                    Add frequently asked questions for quick, accurate responses
                  </p>
                  <Button
                    color="primary"
                    leftIcon={Plus}
                    onPress={() => router.push("/knowledge/new?type=faq")}
                  >
                    Add Your First FAQ
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {faqs.map((faq) => {
                    const dropdownItems: DropdownMenuItem[] = [
                      { key: "edit", label: "Edit", icon: Eye },
                      { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
                    ];

                    return (
                      <div
                        key={faq.id}
                        className="p-4 hover:bg-default-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{faq.question}</span>
                              {faq.category && (
                                <Badge variant="default">{faq.category}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-default-500 mt-1 line-clamp-2">
                              {faq.answer}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-default-400">
                              <span>Used {faq.usageCount} times</span>
                              <span>
                                {faq.helpfulCount} helpful / {faq.notHelpfulCount} not helpful
                              </span>
                              <span>Priority: {faq.priority}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <Dropdown
                            trigger={
                              <Button variant="light" isIconOnly size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                            items={dropdownItems}
                            onAction={(key) => {
                              if (key === "edit") {
                                router.push(`/knowledge/new?type=faq&edit=${faq.id}`);
                              } else if (key === "delete") {
                                handleDeleteFaq(faq.id);
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Pagination for sources */}
      {activeTab === "sources" && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-default-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} sources
          </p>
          <div className="flex gap-2">
            <Button
              variant="bordered"
              size="sm"
              isDisabled={pagination.page <= 1}
              onPress={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="bordered"
              size="sm"
              isDisabled={pagination.page >= pagination.totalPages}
              onPress={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
