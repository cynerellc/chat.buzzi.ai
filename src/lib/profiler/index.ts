/**
 * Performance Profiler
 *
 * A lightweight profiling system for tracking execution timing in the chat widget.
 * Enable with ENABLE_PROFILER=true environment variable.
 *
 * Usage:
 * ```typescript
 * import { profiler } from '@/lib/profiler';
 *
 * // Start a request context
 * await profiler.runAsync(requestId, async () => {
 *   // Start timing a span
 *   const span = profiler.startSpan('my_operation', 'db');
 *   await doSomething();
 *   span.end({ recordCount: 10 });
 *
 *   // Nested spans
 *   const parent = profiler.startSpan('parent_op');
 *   const child = parent.addChild('child_op');
 *   await doChildThing();
 *   child.end();
 *   parent.end();
 * });
 * // Report is automatically printed when request completes
 * ```
 */

import type { ProfilerConfig, ProfileReport, SpanCategory, SpanHandle } from "./types";
import { DEFAULT_PROFILER_CONFIG } from "./types";
import {
  runWithProfilerContextAsync,
  startSpan as contextStartSpan,
  endRequest as contextEndRequest,
  getSpanByName,
  getProfilerContext,
} from "./context";
import { generateReport, formatReport, formatReportCompact } from "./report";

// Check environment variable once at module load
const PROFILER_ENABLED = process.env.ENABLE_PROFILER === "true";

/**
 * Real profiler implementation
 */
class ProfilerService {
  private config: ProfilerConfig;

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config, enabled: true };
  }

  /**
   * Run an async function within a profiled request context
   */
  async runAsync<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
    return runWithProfilerContextAsync(requestId, async () => {
      try {
        return await fn();
      } finally {
        this.finishRequest(requestId);
      }
    });
  }

  /**
   * Start a new profiling span
   */
  startSpan(
    name: string,
    category?: SpanCategory,
    metadata?: Record<string, unknown>
  ): SpanHandle {
    return contextStartSpan(name, category, metadata);
  }

  /**
   * Get an active span by name (useful for ending tool spans)
   */
  getActiveSpan(name: string): SpanHandle | undefined {
    return getSpanByName(name);
  }

  /**
   * Check if we're currently in a profiled context
   */
  isActive(): boolean {
    return getProfilerContext() !== undefined;
  }

  /**
   * Get the current request ID (if in a profiled context)
   */
  getRequestId(): string | undefined {
    return getProfilerContext()?.requestId;
  }

  /**
   * Finish request and generate report
   */
  private finishRequest(requestId: string): void {
    const rootSpan = contextEndRequest();
    if (!rootSpan) {
      return;
    }

    const report = generateReport(rootSpan, requestId, this.config);
    this.outputReport(report);
  }

  /**
   * Output report based on config
   */
  private outputReport(report: ProfileReport): void {
    if (this.config.logToConsole) {
      // Use compact format for fast requests, full format for slow ones
      if (report.totalDurationMs < 100) {
        console.log(formatReportCompact(report));
      } else {
        console.log(formatReport(report));
      }
    }
  }
}

/**
 * No-op profiler for when profiling is disabled
 * All methods are no-ops with zero overhead
 */
const noOpSpanHandle: SpanHandle = {
  id: "noop",
  end: () => {},
  addChild: () => noOpSpanHandle,
};

const noOpProfiler = {
  async runAsync<T>(_requestId: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  },
  startSpan(): SpanHandle {
    return noOpSpanHandle;
  },
  getActiveSpan(): SpanHandle | undefined {
    return undefined;
  },
  isActive(): boolean {
    return false;
  },
  getRequestId(): string | undefined {
    return undefined;
  },
};

/**
 * The profiler instance - either real or no-op based on ENABLE_PROFILER env var
 */
export const profiler = PROFILER_ENABLED ? new ProfilerService() : noOpProfiler;

/**
 * Type for the profiler (works with both real and no-op implementations)
 */
export type Profiler = typeof profiler;

// Re-export types
export type { ProfileReport, ProfileSpan, SpanHandle, SpanCategory } from "./types";

// Export utility for checking if profiling is enabled
export function isProfilingEnabled(): boolean {
  return PROFILER_ENABLED;
}

/**
 * Decorator-style helper for profiling async functions
 */
export function withProfiling<T extends unknown[], R>(
  name: string,
  category: SpanCategory,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  if (!PROFILER_ENABLED) {
    return fn;
  }

  return async (...args: T): Promise<R> => {
    const span = profiler.startSpan(name, category);
    try {
      return await fn(...args);
    } finally {
      span.end();
    }
  };
}

/**
 * Helper to time a specific operation inline
 */
export async function timeOperation<T>(
  name: string,
  category: SpanCategory,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  if (!PROFILER_ENABLED) {
    return operation();
  }

  const span = profiler.startSpan(name, category, metadata);
  try {
    const result = await operation();
    return result;
  } finally {
    span.end();
  }
}

/**
 * Helper to time a sync operation inline
 */
export function timeOperationSync<T>(
  name: string,
  category: SpanCategory,
  operation: () => T,
  metadata?: Record<string, unknown>
): T {
  if (!PROFILER_ENABLED) {
    return operation();
  }

  const span = profiler.startSpan(name, category, metadata);
  try {
    const result = operation();
    return result;
  } finally {
    span.end();
  }
}
