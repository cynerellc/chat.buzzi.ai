// API Response Types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
  timestamp?: string;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchParams extends PaginationParams {
  q?: string;
  filters?: Record<string, string | string[]>;
}

// Common entity types for API responses
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoftDeletableEntity extends BaseEntity {
  deletedAt?: string | null;
}

// Action result types
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Form state for server actions
export interface FormState<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// SSE Event types
export interface SSEEvent<T = unknown> {
  event: string;
  data: T;
  id?: string;
  retry?: number;
}

export interface ChatSSEEvent {
  event:
    | "thinking"
    | "delta"
    | "tool_call"
    | "complete"
    | "error"
    | "notification";
  data: {
    content?: string;
    step?: string;
    progress?: number;
    tool?: string;
    toolResult?: unknown;
    metadata?: Record<string, unknown>;
    error?: string;
  };
}
