/**
 * Performance Profiler Types
 *
 * Type definitions for the profiling system that tracks execution timing
 * across the chat widget message flow.
 */

export interface ProfileSpan {
  id: string;
  name: string;
  category: SpanCategory;
  startTime: number; // performance.now() or Date.now()
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  children: ProfileSpan[];
  parentId?: string;
}

export type SpanCategory =
  | "request"
  | "executor"
  | "rag"
  | "llm"
  | "tool"
  | "db"
  | "streaming"
  | "context"
  | "other";

export interface SpanHandle {
  id: string;
  end: (metadata?: Record<string, unknown>) => void;
  addChild: (name: string, category?: SpanCategory) => SpanHandle;
}

export interface ProfileReport {
  requestId: string;
  timestamp: Date;
  totalDurationMs: number;
  spans: ProfileSpan[];
  summary: ProfileSummary;
  breakdown: Record<string, number>; // Percentage of total time
  topOperations: Array<{ name: string; durationMs: number; category: SpanCategory }>;
}

export interface ProfileSummary {
  executorInit: number;
  contextBuilding: number;
  ragSearch: number;
  llmInference: number;
  toolExecution: number;
  dbOperations: number;
  streaming: number;
  other: number;
}

export interface ProfilerConfig {
  enabled: boolean;
  logToConsole: boolean;
  minDurationMs: number; // Skip spans under this threshold in reports
  topOperationsCount: number; // Number of top operations to show
}

export const DEFAULT_PROFILER_CONFIG: ProfilerConfig = {
  enabled: false,
  logToConsole: true,
  minDurationMs: 1,
  topOperationsCount: 10,
};

// Category mapping for span names
export const SPAN_CATEGORY_PREFIXES: Record<string, SpanCategory> = {
  request: "request",
  total: "request",
  executor: "executor",
  agent: "executor",
  tool_conversion: "executor",
  session: "executor",
  rag: "rag",
  knowledge: "rag",
  embedding: "rag",
  vector: "rag",
  rerank: "rag",
  llm: "llm",
  model: "llm",
  inference: "llm",
  "tool:": "tool",
  db: "db",
  database: "db",
  query: "db",
  stream: "streaming",
  delta: "streaming",
  context: "context",
  variable: "context",
  history: "context",
};

export function inferCategory(spanName: string): SpanCategory {
  const lowerName = spanName.toLowerCase();
  for (const [prefix, category] of Object.entries(SPAN_CATEGORY_PREFIXES)) {
    if (lowerName.startsWith(prefix) || lowerName.includes(prefix)) {
      return category;
    }
  }
  return "other";
}
