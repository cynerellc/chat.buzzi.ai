import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { KnowledgeSourceListItem } from "@/app/api/company/knowledge/route";
import type { KnowledgeSourceDetail } from "@/app/api/company/knowledge/[sourceId]/route";
import type { ChunkItem } from "@/app/api/company/knowledge/[sourceId]/chunks/route";
import type { FaqListItem } from "@/app/api/company/knowledge/faq/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Filter types
export interface KnowledgeFilters {
  type?: string;
  status?: string;
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

// Knowledge Chunks Hook
interface ChunksResponse {
  chunks: ChunkItem[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export function useKnowledgeChunks(sourceId: string | null, page: number = 1) {
  const { data, error, isLoading, mutate } = useSWR<ChunksResponse>(
    sourceId ? `/api/company/knowledge/${sourceId}/chunks?page=${page}` : null,
    fetcher
  );

  return {
    chunks: data?.chunks ?? [],
    pagination: data?.pagination ?? { page: 1, limit: 20, hasMore: false },
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
