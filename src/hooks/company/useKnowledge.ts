import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { useState, useCallback } from "react";

import type { KnowledgeSourceListItem } from "@/app/api/company/knowledge/route";
import type { KnowledgeSourceDetail } from "@/app/api/company/knowledge/[sourceId]/route";
import type { FaqListItem } from "@/app/api/company/knowledge/faq/route";
import type { CategoryWithCounts } from "@/app/api/company/knowledge/categories/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Filter types
export interface KnowledgeFilters {
  type?: string;
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface KnowledgeSourcesResponse {
  sources: KnowledgeSourceListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<string, number>;
}

// Build URL with filters
function buildKnowledgeUrl(filters: KnowledgeFilters): string {
  const params = new URLSearchParams();

  if (filters.type && filters.type !== "all") {
    params.append("type", filters.type);
  }
  if (filters.status && filters.status !== "all") {
    params.append("status", filters.status);
  }
  if (filters.category) {
    params.append("category", filters.category);
  }
  if (filters.page) {
    params.append("page", filters.page.toString());
  }
  if (filters.limit) {
    params.append("limit", filters.limit.toString());
  }

  const queryString = params.toString();
  return queryString ? `/api/company/knowledge?${queryString}` : "/api/company/knowledge";
}

// Knowledge Sources List Hook
export function useKnowledgeSources(filters: KnowledgeFilters = {}) {
  const url = buildKnowledgeUrl(filters);

  const { data, error, isLoading, mutate } = useSWR<KnowledgeSourcesResponse>(
    url,
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    sources: data?.sources ?? [],
    pagination: data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    statusCounts: data?.statusCounts ?? {},
    isLoading,
    isError: error,
    mutate,
  };
}

// Single Knowledge Source Hook
export function useKnowledgeSource(sourceId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ source: KnowledgeSourceDetail }>(
    sourceId ? `/api/company/knowledge/${sourceId}` : null,
    fetcher
  );

  return {
    source: data?.source ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// Create Knowledge Source Mutation
interface CreateKnowledgeSourceArgs {
  name: string;
  description?: string;
  type: "file" | "url" | "text";
  category?: string;
  sourceConfig: {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    storagePath?: string;
    url?: string;
    crawlDepth?: number;
    content?: string;
  };
}

async function createKnowledgeSource(
  url: string,
  { arg }: { arg: CreateKnowledgeSourceArgs }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create knowledge source");
  }

  return response.json();
}

export function useCreateKnowledgeSource() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/knowledge",
    createKnowledgeSource
  );

  return {
    createSource: trigger,
    isCreating: isMutating,
    error,
  };
}

// Update Knowledge Source Mutation
async function updateKnowledgeSource(
  url: string,
  { arg }: { arg: { name?: string; description?: string } }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update knowledge source");
  }

  return response.json();
}

export function useUpdateKnowledgeSource(sourceId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/knowledge/${sourceId}`,
    updateKnowledgeSource
  );

  return {
    updateSource: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Delete Knowledge Source Mutation
async function deleteKnowledgeSource(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete knowledge source");
  }

  return response.json();
}

export function useDeleteKnowledgeSource(sourceId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/knowledge/${sourceId}`,
    deleteKnowledgeSource
  );

  return {
    deleteSource: trigger,
    isDeleting: isMutating,
    error,
  };
}

// Single FAQ Hook
export function useFaq(faqId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ faq: FaqListItem }>(
    faqId ? `/api/company/knowledge/faq/${faqId}` : null,
    fetcher
  );

  return {
    faq: data?.faq ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// FAQ Hooks
export interface FaqFilters {
  category?: string;
  page?: number;
  limit?: number;
}

interface FaqResponse {
  faqs: FaqListItem[];
  categories: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function buildFaqUrl(filters: FaqFilters): string {
  const params = new URLSearchParams();

  if (filters.category && filters.category !== "all") {
    params.append("category", filters.category);
  }
  if (filters.page) {
    params.append("page", filters.page.toString());
  }
  if (filters.limit) {
    params.append("limit", filters.limit.toString());
  }

  const queryString = params.toString();
  return queryString ? `/api/company/knowledge/faq?${queryString}` : "/api/company/knowledge/faq";
}

export function useFaqs(filters: FaqFilters = {}) {
  const url = buildFaqUrl(filters);

  const { data, error, isLoading, mutate } = useSWR<FaqResponse>(
    url,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    faqs: data?.faqs ?? [],
    categories: data?.categories ?? [],
    pagination: data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
    isLoading,
    isError: error,
    mutate,
  };
}

// Create FAQ Mutation
interface CreateFaqArgs {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  priority?: number;
}

async function createFaq(
  url: string,
  { arg }: { arg: CreateFaqArgs }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create FAQ");
  }

  return response.json();
}

export function useCreateFaq() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/knowledge/faq",
    createFaq
  );

  return {
    createFaq: trigger,
    isCreating: isMutating,
    error,
  };
}

// Update FAQ Mutation
async function updateFaq(
  url: string,
  { arg }: { arg: Partial<CreateFaqArgs> }
) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update FAQ");
  }

  return response.json();
}

export function useUpdateFaq(faqId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/knowledge/faq/${faqId}`,
    updateFaq
  );

  return {
    updateFaq: trigger,
    isUpdating: isMutating,
    error,
  };
}

// Delete FAQ Mutation
async function deleteFaq(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete FAQ");
  }

  return response.json();
}

export function useDeleteFaq(faqId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/company/knowledge/faq/${faqId}`,
    deleteFaq
  );

  return {
    deleteFaq: trigger,
    isDeleting: isMutating,
    error,
  };
}

// ==========================================
// Knowledge Categories Hooks
// ==========================================

interface CategoriesResponse {
  categories: CategoryWithCounts[];
}

export function useKnowledgeCategories() {
  const { data, error, isLoading, mutate } = useSWR<CategoriesResponse>(
    "/api/company/knowledge/categories",
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    categories: data?.categories ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Create Category Mutation
interface CreateCategoryArgs {
  name: string;
}

async function createCategory(
  url: string,
  { arg }: { arg: CreateCategoryArgs }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create category");
  }

  return response.json();
}

export function useCreateKnowledgeCategory() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/knowledge/categories",
    createCategory
  );

  return {
    createCategory: trigger,
    isCreating: isMutating,
    error,
  };
}

// Delete Category Mutation (by name)
async function deleteCategory(
  url: string,
  { arg }: { arg: { name: string } }
) {
  const response = await fetch(`${url}?name=${encodeURIComponent(arg.name)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete category");
  }

  return response.json();
}

export function useDeleteKnowledgeCategory() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/company/knowledge/categories",
    deleteCategory
  );

  return {
    deleteCategory: trigger,
    isDeleting: isMutating,
    error,
  };
}

// ==========================================
// File Upload Hook
// ==========================================

interface UploadResult {
  storagePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<UploadResult> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/company/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      setUploadProgress(100);
      return await response.json();
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error("Upload failed");
      setError(uploadError);
      throw uploadError;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadFile,
    isUploading,
    uploadProgress,
    error,
  };
}

// ==========================================
// Reindex All Hook
// ==========================================

interface ReindexResult {
  message: string;
  results: {
    sources?: {
      total: number;
      success: number;
      failed: number;
      errors?: { sourceId: string; name: string; error: string }[];
    };
    faqs?: {
      processed: number;
      failed: number;
    };
  };
}

async function reindexAll(url: string) {
  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reindex knowledge base");
  }

  return response.json();
}

export function useReindexAll() {
  const { trigger, isMutating, error, data } = useSWRMutation<ReindexResult>(
    "/api/company/knowledge/reindex",
    reindexAll
  );

  return {
    reindex: trigger,
    isReindexing: isMutating,
    result: data,
    error,
  };
}

// Re-export types
export type { CategoryWithCounts };
