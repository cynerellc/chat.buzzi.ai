"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  RefreshCw,
  FolderPlus,
} from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  Select,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  addToast,
} from "@/components/ui";
import { useSetPageTitle } from "@/contexts/page-context";
import {
  useKnowledgeSources,
  useFaqs,
  useKnowledgeCategories,
  useCreateKnowledgeCategory,
  useDeleteKnowledgeCategory,
  useReindexAll,
} from "@/hooks/company";
import type { KnowledgeFilters } from "@/hooks/company/useKnowledge";

import { CategorySection } from "@/components/company-admin/knowledge/category-section";
import { CategoryModal } from "@/components/company-admin/knowledge/category-modal";
import { ReindexModal } from "@/components/company-admin/knowledge/reindex-modal";

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

export default function KnowledgePage() {
  useSetPageTitle("Knowledge Base");
  const router = useRouter();
  const [filters, setFilters] = useState<KnowledgeFilters>({
    page: 1,
    limit: 100, // Load more to group by category
  });
  const [searchValue, setSearchValue] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["uncategorized"])
  );
  const [isReindexModalOpen, setIsReindexModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [deleteSourceModal, setDeleteSourceModal] = useState<{
    isOpen: boolean;
    sourceId: string;
    sourceName: string;
    chunkCount: number;
  }>({ isOpen: false, sourceId: "", sourceName: "", chunkCount: 0 });
  const [deleteCategoryModal, setDeleteCategoryModal] = useState<{
    isOpen: boolean;
    categoryName: string;
    sourceCount: number;
    faqCount: number;
    chunkCount: number;
  }>({ isOpen: false, categoryName: "", sourceCount: 0, faqCount: 0, chunkCount: 0 });
  const [isDeleting, setIsDeleting] = useState(false);

  // Data fetching
  const { sources, isLoading, mutate } = useKnowledgeSources(filters);
  const { faqs, isLoading: isLoadingFaqs, mutate: mutateFaqs } = useFaqs();
  const { categories, mutate: mutateCategories } = useKnowledgeCategories();
  const { createCategory, isCreating } = useCreateKnowledgeCategory();
  const { deleteCategory } = useDeleteKnowledgeCategory();
  const { reindex, isReindexing, result: reindexResult } = useReindexAll();

  // Group sources by category
  const sourcesByCategory = useMemo(() => {
    const grouped: Record<string, typeof sources> = {};

    // Initialize with all categories
    categories.forEach((cat) => {
      grouped[cat.name] = [];
    });
    grouped["uncategorized"] = [];

    // Group sources by category name
    sources.forEach((source) => {
      const key = source.category || "uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(source);
    });

    // Filter by search
    if (searchValue) {
      const search = searchValue.toLowerCase();
      Object.keys(grouped).forEach((key) => {
        const items = grouped[key];
        if (items) {
          grouped[key] = items.filter(
            (s) =>
              s.name.toLowerCase().includes(search) ||
              s.description?.toLowerCase().includes(search)
          );
        }
      });
    }

    return grouped;
  }, [sources, categories, searchValue]);

  // Group FAQs by category
  const faqsByCategory = useMemo(() => {
    const grouped: Record<string, typeof faqs> = {};

    // Initialize with all categories
    categories.forEach((cat) => {
      grouped[cat.name] = [];
    });
    grouped["uncategorized"] = [];

    // Group FAQs
    faqs.forEach((faq) => {
      const key = faq.category || "uncategorized";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(faq);
    });

    // Filter by search
    if (searchValue) {
      const search = searchValue.toLowerCase();
      Object.keys(grouped).forEach((key) => {
        const items = grouped[key];
        if (items) {
          grouped[key] = items.filter(
            (f) =>
              f.question.toLowerCase().includes(search) ||
              f.answer.toLowerCase().includes(search)
          );
        }
      });
    }

    return grouped;
  }, [faqs, categories, searchValue]);

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

  const handleDeleteSourceClick = (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId);
    if (source) {
      setDeleteSourceModal({
        isOpen: true,
        sourceId: source.id,
        sourceName: source.name,
        chunkCount: source.chunkCount,
      });
    }
  };

  const handleConfirmDeleteSource = async () => {
    if (!deleteSourceModal.sourceId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/company/knowledge/${deleteSourceModal.sourceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        addToast({ title: "Knowledge source deleted", color: "success" });
        mutate();
        setDeleteSourceModal({ isOpen: false, sourceId: "", sourceName: "", chunkCount: 0 });
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      addToast({ title: "Failed to delete knowledge source", color: "danger" });
    } finally {
      setIsDeleting(false);
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

  const handleAddCategory = async (name: string) => {
    const result = await createCategory({ name });
    if (result?.category) {
      addToast({ title: "Category created", color: "success" });
      mutateCategories();
      // Expand the new category
      setExpandedCategories((prev) => new Set([...prev, result.category.name]));
    }
  };

  const handleDeleteCategoryClick = (categoryName: string) => {
    const category = categories.find((c) => c.name === categoryName);
    const categorySources = sourcesByCategory[categoryName] || [];
    const categoryFaqs = faqsByCategory[categoryName] || [];

    // Calculate total chunks from all sources in this category
    const totalChunks = categorySources.reduce((sum, s) => sum + s.chunkCount, 0);

    setDeleteCategoryModal({
      isOpen: true,
      categoryName,
      sourceCount: category?.sourceCount ?? categorySources.length,
      faqCount: category?.faqCount ?? categoryFaqs.length,
      chunkCount: totalChunks,
    });
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryModal.categoryName) return;

    setIsDeleting(true);
    try {
      await deleteCategory({ name: deleteCategoryModal.categoryName });
      addToast({ title: "Category deleted", color: "success" });
      mutateCategories();
      mutate(); // Refresh sources as they become uncategorized
      mutateFaqs(); // Refresh FAQs as they become uncategorized
      setDeleteCategoryModal({ isOpen: false, categoryName: "", sourceCount: 0, faqCount: 0, chunkCount: 0 });
    } catch {
      addToast({ title: "Failed to delete category", color: "danger" });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const handleAddSource = (categoryName?: string) => {
    const url = categoryName
      ? `/knowledge/new?category=${encodeURIComponent(categoryName)}`
      : "/knowledge/new";
    router.push(url);
  };

  const handleAddFaq = (categoryName?: string) => {
    const url = categoryName
      ? `/knowledge/new?type=faq&category=${encodeURIComponent(categoryName)}`
      : "/knowledge/new?type=faq";
    router.push(url);
  };

  const handleEditFaq = (faqId: string) => {
    router.push(`/knowledge/new?type=faq&edit=${faqId}`);
  };

  const handleReindex = async () => {
    try {
      await reindex();
      mutate();
      mutateFaqs();
    } catch {
      addToast({ title: "Failed to reindex", color: "danger" });
    }
  };

  // Count totals for reindex modal
  const indexedSourceCount = sources.filter(
    (s) => s.status === "indexed" || s.status === "failed"
  ).length;

  // Check if there's any content
  const hasContent = sources.length > 0 || faqs.length > 0 || categories.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Manage documents, URLs, and FAQs that power your AI agents
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onPress={() => setIsReindexModalOpen(true)}
          >
            Reindex All
          </Button>
          <Button
            color="primary"
            leftIcon={FolderPlus}
            onPress={() => setIsCategoryModalOpen(true)}
          >
            Add Category
          </Button>
        </div>
      </div>

      {/* Filters */}
      {hasContent && (
        <Card>
          <CardBody>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search sources and FAQs..."
                  value={searchValue}
                  onValueChange={setSearchValue}
                  startContent={
                    <Search className="h-4 w-4 text-muted-foreground" />
                  }
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
      )}

      {/* Category Sections */}
      {isLoading || isLoadingFaqs ? (
        <Card>
          <CardBody>
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          </CardBody>
        </Card>
      ) : !hasContent ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">
                No knowledge sources
              </p>
              <p className="text-muted-foreground text-sm mb-4">
                Create a category and add documents, URLs, or FAQs to train
                your AI agents
              </p>
              <Button
                color="primary"
                leftIcon={FolderPlus}
                onPress={() => setIsCategoryModalOpen(true)}
              >
                Create Your First Category
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Render categories */}
          {categories.map((category) => (
            <CategorySection
              key={category.name}
              category={category}
              sources={sourcesByCategory[category.name] || []}
              faqs={faqsByCategory[category.name] || []}
              isExpanded={expandedCategories.has(category.name)}
              onToggle={() => toggleCategory(category.name)}
              onAddSource={handleAddSource}
              onAddFaq={handleAddFaq}
              onViewSource={handleSourceClick}
              onEditFaq={handleEditFaq}
              onDeleteSource={handleDeleteSourceClick}
              onDeleteFaq={handleDeleteFaq}
              onDeleteCategory={() => handleDeleteCategoryClick(category.name)}
            />
          ))}

          {/* Uncategorized section */}
          {((sourcesByCategory["uncategorized"]?.length ?? 0) > 0 ||
            (faqsByCategory["uncategorized"]?.length ?? 0) > 0 ||
            categories.length === 0) && (
            <CategorySection
              category={null}
              sources={sourcesByCategory["uncategorized"] || []}
              faqs={faqsByCategory["uncategorized"] || []}
              isExpanded={expandedCategories.has("uncategorized")}
              onToggle={() => toggleCategory("uncategorized")}
              onAddSource={() => handleAddSource()}
              onAddFaq={() => handleAddFaq()}
              onViewSource={handleSourceClick}
              onEditFaq={handleEditFaq}
              onDeleteSource={handleDeleteSourceClick}
              onDeleteFaq={handleDeleteFaq}
            />
          )}
        </div>
      )}

      {/* Category Creation Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSubmit={handleAddCategory}
        isSubmitting={isCreating}
      />

      {/* Reindex Modal */}
      <ReindexModal
        isOpen={isReindexModalOpen}
        onClose={() => setIsReindexModalOpen(false)}
        onConfirm={handleReindex}
        isReindexing={isReindexing}
        result={reindexResult}
        sourceCount={indexedSourceCount}
        faqCount={faqs.length}
      />

      {/* Delete Source Confirmation Modal */}
      <Modal
        isOpen={deleteSourceModal.isOpen}
        onClose={() => setDeleteSourceModal({ isOpen: false, sourceId: "", sourceName: "", chunkCount: 0 })}
      >
        <ModalContent>
          <ModalHeader>Delete Knowledge Source</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete &quot;{deleteSourceModal.sourceName}&quot;? This action cannot be undone.
            </p>
            {deleteSourceModal.chunkCount > 0 && (
              <p className="text-muted-foreground text-sm mt-2">
                All {deleteSourceModal.chunkCount} chunks and vector embeddings will be removed from the database.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              onPress={() => setDeleteSourceModal({ isOpen: false, sourceId: "", sourceName: "", chunkCount: 0 })}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleConfirmDeleteSource}
              isLoading={isDeleting}
            >
              Delete Source
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Category Confirmation Modal */}
      <Modal
        isOpen={deleteCategoryModal.isOpen}
        onClose={() => setDeleteCategoryModal({ isOpen: false, categoryName: "", sourceCount: 0, faqCount: 0, chunkCount: 0 })}
      >
        <ModalContent>
          <ModalHeader>Delete Category</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete the category &quot;{deleteCategoryModal.categoryName}&quot;?
            </p>
            {(deleteCategoryModal.sourceCount > 0 || deleteCategoryModal.faqCount > 0 || deleteCategoryModal.chunkCount > 0) && (
              <div className="mt-4 p-3 rounded-lg bg-danger-50 border border-danger-200">
                <p className="text-sm font-medium text-danger-700 mb-2">
                  The following data will be permanently deleted:
                </p>
                <ul className="text-sm text-danger-600 space-y-1">
                  {deleteCategoryModal.sourceCount > 0 && (
                    <li>• {deleteCategoryModal.sourceCount} knowledge source{deleteCategoryModal.sourceCount !== 1 ? "s" : ""}</li>
                  )}
                  {deleteCategoryModal.faqCount > 0 && (
                    <li>• {deleteCategoryModal.faqCount} FAQ item{deleteCategoryModal.faqCount !== 1 ? "s" : ""}</li>
                  )}
                  {deleteCategoryModal.chunkCount > 0 && (
                    <li>• {deleteCategoryModal.chunkCount} chunk{deleteCategoryModal.chunkCount !== 1 ? "s" : ""} from vector store</li>
                  )}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground text-sm mt-3">
              This action cannot be undone. All sources, FAQs, and their vector embeddings will be permanently removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              onPress={() => setDeleteCategoryModal({ isOpen: false, categoryName: "", sourceCount: 0, faqCount: 0, chunkCount: 0 })}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleConfirmDeleteCategory}
              isLoading={isDeleting}
            >
              Delete Category
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
