"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MoreVertical,
  Trash2,
  FileText,
  Link as LinkIcon,
  FileType,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  MessageSquareText,
} from "lucide-react";

import {
  Button,
  Badge,
  Dropdown,
  Tabs,
  type TabItem,
  type DropdownMenuItemData,
} from "@/components/ui";

import type { KnowledgeSourceListItem } from "@/app/api/company/knowledge/route";
import type { FaqListItem } from "@/app/api/company/knowledge/faq/route";
import type { CategoryWithCounts } from "@/app/api/company/knowledge/categories/route";

interface CategorySectionProps {
  category: CategoryWithCounts | null;
  sources: KnowledgeSourceListItem[];
  faqs: FaqListItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onAddSource: (categoryName?: string) => void;
  onAddFaq: (categoryName?: string) => void;
  onViewSource: (sourceId: string) => void;
  onEditFaq: (faqId: string) => void;
  onDeleteSource: (sourceId: string) => void;
  onDeleteFaq: (faqId: string) => void;
  onDeleteCategory?: () => void;
}

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
};

const defaultStatus: StatusConfig = { label: "Pending", variant: "default", icon: Clock };

const statusConfig: Record<string, StatusConfig> = {
  pending: defaultStatus,
  processing: { label: "Processing", variant: "info", icon: Loader2 },
  indexed: { label: "Indexed", variant: "success", icon: CheckCircle },
  failed: { label: "Failed", variant: "danger", icon: AlertCircle },
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  url: LinkIcon,
  text: FileType,
};

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

export function CategorySection({
  category,
  sources,
  faqs,
  isExpanded,
  onToggle,
  onAddSource,
  onAddFaq,
  onViewSource,
  onEditFaq,
  onDeleteSource,
  onDeleteFaq,
  onDeleteCategory,
}: CategorySectionProps) {
  const categoryName = category?.name || "Uncategorized";
  const sourceCount = sources.length;
  const faqCount = faqs.length;
  const totalCount = sourceCount + faqCount;

  const [activeTab, setActiveTab] = useState<string>("sources");

  const categoryDropdownItems: DropdownMenuItemData[] = category
    ? [
        { key: "delete", label: "Delete Category", icon: Trash2, isDanger: true },
      ]
    : [];

  const handleCategoryAction = (key: string | number) => {
    if (key === "delete") {
      onDeleteCategory?.();
    }
  };

  const tabItems: TabItem[] = [
    { key: "sources", label: `Sources (${sourceCount})` },
    { key: "faqs", label: `FAQs (${faqCount})` },
  ];

  return (
    <div className="card-extended-corners border border-border bg-card">
      <span className="corner-extensions" />
      {/* Category Header */}
      <div className="flex items-center justify-between p-3 bg-muted/50">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}

          <span className="font-medium">{categoryName}</span>

          <Badge variant="secondary" className="ml-2">
            {totalCount} {totalCount === 1 ? "item" : "items"}
          </Badge>
        </button>

        <div className="flex items-center gap-2">
          {category && categoryDropdownItems.length > 0 && (
            <Dropdown
              trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
              items={categoryDropdownItems}
              onAction={handleCategoryAction}
            />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex items-center justify-between mb-4">
            <Tabs
              items={tabItems}
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              size="sm"
            />
            <div className="flex gap-2">
              {activeTab === "sources" && sources.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Plus}
                  onPress={() => onAddSource(category?.name)}
                >
                  Add Source
                </Button>
              )}
              {activeTab === "faqs" && faqs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Plus}
                  onPress={() => onAddFaq(category?.name)}
                >
                  Add FAQ
                </Button>
              )}
            </div>
          </div>

          {/* Sources Tab Content */}
          {activeTab === "sources" && (
            <>
              {sources.length > 0 ? (
                <div>
                  {sources.map((source, index) => {
                    const status = statusConfig[source.status] ?? defaultStatus;
                    const StatusIcon = status.icon;
                    const TypeIcon = typeIcons[source.type] || FileText;
                    const isLast = index === sources.length - 1;

                    const sourceDropdownItems: DropdownMenuItemData[] = [
                      { key: "view", label: "View Details", icon: Eye },
                      { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
                    ];

                    return (
                      <div
                        key={source.id}
                        className={`py-4 hover:bg-muted/30 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <TypeIcon className="h-5 w-5" />
                          </div>

                          <button
                            onClick={() => onViewSource(source.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{source.name}</span>
                              <Badge variant={status.variant}>
                                <StatusIcon
                                  className={`h-3 w-3 mr-1 ${source.status === "processing" ? "animate-spin" : ""}`}
                                />
                                {status.label}
                              </Badge>
                            </div>
                            {source.description && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {source.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="capitalize">{source.type}</span>
                              <span>{source.chunkCount} chunks</span>
                              <span>{formatTokenCount(source.tokenCount)} tokens</span>
                              <span>Added {formatDate(source.createdAt)}</span>
                            </div>
                          </button>

                          <Dropdown
                            trigger={
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                            items={sourceDropdownItems}
                            onAction={(key) => {
                              if (key === "view") {
                                onViewSource(source.id);
                              } else if (key === "delete") {
                                onDeleteSource(source.id);
                              }
                            }}
                          />
                        </div>

                        {source.processingError && (
                          <div className="mt-2 p-2 rounded bg-danger-50 text-danger-600 text-sm">
                            Error: {source.processingError}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No sources in this category
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Plus}
                    className="mt-3"
                    onPress={() => onAddSource(category?.name)}
                  >
                    Add Source
                  </Button>
                </div>
              )}
            </>
          )}

          {/* FAQs Tab Content */}
          {activeTab === "faqs" && (
            <>
              {faqs.length > 0 ? (
                <div>
                  {faqs.map((faq, index) => {
                    const isLast = index === faqs.length - 1;
                    const faqDropdownItems: DropdownMenuItemData[] = [
                      { key: "edit", label: "Edit", icon: Eye },
                      { key: "delete", label: "Delete", icon: Trash2, isDanger: true },
                    ];

                    return (
                      <div
                        key={faq.id}
                        className={`py-4 hover:bg-muted/30 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <MessageSquareText className="h-5 w-5" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{faq.question}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {faq.answer}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Used {faq.usageCount} times</span>
                              <span>
                                {faq.helpfulCount} helpful / {faq.notHelpfulCount} not helpful
                              </span>
                              <span>Priority: {faq.priority}</span>
                            </div>
                          </div>

                          <Dropdown
                            trigger={
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            }
                            items={faqDropdownItems}
                            onAction={(key) => {
                              if (key === "edit") {
                                onEditFaq(faq.id);
                              } else if (key === "delete") {
                                onDeleteFaq(faq.id);
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <MessageSquareText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No FAQs in this category
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Plus}
                    className="mt-3"
                    onPress={() => onAddFaq(category?.name)}
                  >
                    Add FAQ
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
