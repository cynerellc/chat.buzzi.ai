/**
 * Profiler Context
 *
 * Uses AsyncLocalStorage to maintain request-scoped profiling context.
 * This allows profiler spans to be automatically associated with the
 * correct request without explicitly passing context through the call stack.
 */

import { AsyncLocalStorage } from "async_hooks";
import type { ProfileSpan, SpanCategory, SpanHandle } from "./types";
import { inferCategory } from "./types";

export interface ProfilerContext {
  requestId: string;
  startTime: number;
  rootSpan: ProfileSpan;
  activeSpans: Map<string, ProfileSpan>;
  spanStack: string[]; // Stack of active span IDs for nesting
}

// AsyncLocalStorage instance for request-scoped context
const profilerStorage = new AsyncLocalStorage<ProfilerContext>();

let spanCounter = 0;

function generateSpanId(): string {
  return `span_${++spanCounter}_${Date.now()}`;
}

/**
 * Run a function within a profiler context
 */
export function runWithProfilerContext<T>(
  requestId: string,
  fn: () => T
): T {
  const rootSpan: ProfileSpan = {
    id: "root",
    name: "request",
    category: "request",
    startTime: performance.now(),
    children: [],
  };

  const context: ProfilerContext = {
    requestId,
    startTime: performance.now(),
    rootSpan,
    activeSpans: new Map([["root", rootSpan]]),
    spanStack: ["root"],
  };

  return profilerStorage.run(context, fn);
}

/**
 * Run an async function within a profiler context
 */
export async function runWithProfilerContextAsync<T>(
  requestId: string,
  fn: () => Promise<T>
): Promise<T> {
  const rootSpan: ProfileSpan = {
    id: "root",
    name: "request",
    category: "request",
    startTime: performance.now(),
    children: [],
  };

  const context: ProfilerContext = {
    requestId,
    startTime: performance.now(),
    rootSpan,
    activeSpans: new Map([["root", rootSpan]]),
    spanStack: ["root"],
  };

  return profilerStorage.run(context, fn);
}

/**
 * Get the current profiler context (if any)
 */
export function getProfilerContext(): ProfilerContext | undefined {
  return profilerStorage.getStore();
}

/**
 * Start a new profiling span
 */
export function startSpan(
  name: string,
  category?: SpanCategory,
  metadata?: Record<string, unknown>
): SpanHandle {
  const context = getProfilerContext();

  if (!context) {
    // Return no-op handle if no context
    return createNoOpHandle();
  }

  const spanId = generateSpanId();
  const resolvedCategory = category ?? inferCategory(name);

  const span: ProfileSpan = {
    id: spanId,
    name,
    category: resolvedCategory,
    startTime: performance.now(),
    metadata,
    children: [],
  };

  // Find parent span (top of stack)
  const parentId = context.spanStack[context.spanStack.length - 1];
  if (parentId) {
    span.parentId = parentId;
    const parentSpan = context.activeSpans.get(parentId);
    if (parentSpan) {
      parentSpan.children.push(span);
    }
  }

  // Register span
  context.activeSpans.set(spanId, span);
  context.spanStack.push(spanId);

  return createSpanHandle(spanId, context);
}

/**
 * End the current request and return all spans
 */
export function endRequest(): ProfileSpan | undefined {
  const context = getProfilerContext();
  if (!context) {
    return undefined;
  }

  // End root span
  const rootSpan = context.rootSpan;
  rootSpan.endTime = performance.now();
  rootSpan.durationMs = rootSpan.endTime - rootSpan.startTime;

  // End any unclosed spans
  for (const span of Array.from(context.activeSpans.values())) {
    if (!span.endTime) {
      span.endTime = rootSpan.endTime;
      span.durationMs = span.endTime - span.startTime;
    }
  }

  return rootSpan;
}

/**
 * Get a span by name (for ending tool spans by name)
 */
export function getSpanByName(name: string): SpanHandle | undefined {
  const context = getProfilerContext();
  if (!context) {
    return undefined;
  }

  for (const [id, span] of Array.from(context.activeSpans.entries())) {
    if (span.name === name && !span.endTime) {
      return createSpanHandle(id, context);
    }
  }

  return undefined;
}

function createSpanHandle(spanId: string, context: ProfilerContext): SpanHandle {
  return {
    id: spanId,
    end: (metadata?: Record<string, unknown>) => {
      const span = context.activeSpans.get(spanId);
      if (span && !span.endTime) {
        span.endTime = performance.now();
        span.durationMs = span.endTime - span.startTime;
        if (metadata) {
          span.metadata = { ...span.metadata, ...metadata };
        }

        // Remove from stack
        const stackIndex = context.spanStack.indexOf(spanId);
        if (stackIndex !== -1) {
          context.spanStack.splice(stackIndex, 1);
        }
      }
    },
    addChild: (name: string, category?: SpanCategory) => {
      // Temporarily make this span the active parent
      const currentStack = [...context.spanStack];
      const spanIndex = context.spanStack.indexOf(spanId);
      if (spanIndex !== -1) {
        context.spanStack = context.spanStack.slice(0, spanIndex + 1);
      }
      const childHandle = startSpan(name, category);
      context.spanStack = currentStack;
      context.spanStack.push(childHandle.id);
      return childHandle;
    },
  };
}

function createNoOpHandle(): SpanHandle {
  return {
    id: "noop",
    end: () => {},
    addChild: () => createNoOpHandle(),
  };
}

/**
 * Create a no-op context runner for when profiling is disabled
 */
export function createNoOpContextRunner() {
  return {
    run: <T>(_requestId: string, fn: () => T): T => fn(),
    runAsync: <T>(_requestId: string, fn: () => Promise<T>): Promise<T> => fn(),
  };
}
