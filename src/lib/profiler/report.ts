/**
 * Profiler Report Generation
 *
 * Generates structured reports from profiling spans and formats
 * them for console output.
 */

import type {
  ProfileSpan,
  ProfileReport,
  ProfileSummary,
  ProfilerConfig,
  SpanCategory,
} from "./types";

/**
 * Generate a report from the root span
 */
export function generateReport(
  rootSpan: ProfileSpan,
  requestId: string,
  config: ProfilerConfig
): ProfileReport {
  const allSpans = flattenSpans(rootSpan);
  const totalDurationMs = rootSpan.durationMs ?? 0;

  const summary = calculateSummary(allSpans);
  const breakdown = calculateBreakdown(summary, totalDurationMs);
  const topOperations = getTopOperations(allSpans, config.topOperationsCount, config.minDurationMs);

  return {
    requestId,
    timestamp: new Date(),
    totalDurationMs,
    spans: [rootSpan],
    summary,
    breakdown,
    topOperations,
  };
}

/**
 * Flatten all spans into a single array (for analysis)
 */
function flattenSpans(span: ProfileSpan, result: ProfileSpan[] = []): ProfileSpan[] {
  result.push(span);
  for (const child of span.children) {
    flattenSpans(child, result);
  }
  return result;
}

/**
 * Calculate summary by category
 */
function calculateSummary(spans: ProfileSpan[]): ProfileSummary {
  const summary: ProfileSummary = {
    executorInit: 0,
    contextBuilding: 0,
    ragSearch: 0,
    llmInference: 0,
    toolExecution: 0,
    dbOperations: 0,
    streaming: 0,
    other: 0,
  };

  // Only count leaf spans to avoid double-counting
  const leafSpans = spans.filter((s) => s.children.length === 0);

  for (const span of leafSpans) {
    const duration = span.durationMs ?? 0;

    switch (span.category) {
      case "executor":
        summary.executorInit += duration;
        break;
      case "context":
        summary.contextBuilding += duration;
        break;
      case "rag":
        summary.ragSearch += duration;
        break;
      case "llm":
        summary.llmInference += duration;
        break;
      case "tool":
        summary.toolExecution += duration;
        break;
      case "db":
        summary.dbOperations += duration;
        break;
      case "streaming":
        summary.streaming += duration;
        break;
      default:
        summary.other += duration;
    }
  }

  return summary;
}

/**
 * Calculate percentage breakdown
 */
function calculateBreakdown(
  summary: ProfileSummary,
  totalDurationMs: number
): Record<string, number> {
  if (totalDurationMs === 0) {
    return {};
  }

  const breakdown: Record<string, number> = {};
  for (const [key, value] of Object.entries(summary)) {
    breakdown[key] = (value / totalDurationMs) * 100;
  }
  return breakdown;
}

/**
 * Get top N slowest operations
 */
function getTopOperations(
  spans: ProfileSpan[],
  count: number,
  minDurationMs: number
): Array<{ name: string; durationMs: number; category: SpanCategory }> {
  return spans
    .filter((s) => (s.durationMs ?? 0) >= minDurationMs && s.name !== "request")
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, count)
    .map((s) => ({
      name: s.name,
      durationMs: s.durationMs ?? 0,
      category: s.category,
    }));
}

/**
 * Format report for console output
 */
export function formatReport(report: ProfileReport): string {
  const lines: string[] = [];
  const width = 66;

  const divider = "═".repeat(width);
  const thinDivider = "─".repeat(width);

  lines.push("");
  lines.push(divider);
  lines.push(centerText("PERFORMANCE PROFILE REPORT", width));
  lines.push(divider);
  lines.push(`Request ID: ${report.requestId}`);
  lines.push(`Timestamp: ${report.timestamp.toISOString()}`);
  lines.push(`Total Duration: ${report.totalDurationMs.toFixed(2)}ms`);
  lines.push(thinDivider);

  // Summary by category
  lines.push(centerText("BREAKDOWN BY CATEGORY", width));
  lines.push(thinDivider);

  const sortedSummary = Object.entries(report.summary)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [name, ms] of sortedSummary) {
    const percentage = report.breakdown[name] ?? 0;
    const bar = createProgressBar(percentage, 20);
    const formattedName = formatCategoryName(name).padEnd(16);
    const formattedMs = ms.toFixed(2).padStart(10);
    const formattedPercent = `(${percentage.toFixed(1)}%)`.padStart(8);
    lines.push(`${formattedName} ${formattedMs}ms ${formattedPercent} ${bar}`);
  }

  // Top operations
  if (report.topOperations.length > 0) {
    lines.push(thinDivider);
    lines.push(centerText("TOP SLOWEST OPERATIONS", width));
    lines.push(thinDivider);

    for (let i = 0; i < report.topOperations.length; i++) {
      const op = report.topOperations[i];
      if (!op) continue;
      const num = `${i + 1}.`.padEnd(3);
      const name = truncateText(op.name, 35).padEnd(35);
      const ms = op.durationMs.toFixed(2).padStart(10);
      const cat = `[${op.category}]`.padStart(12);
      lines.push(`${num} ${name} ${ms}ms ${cat}`);
    }
  }

  lines.push(divider);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format report as JSON (for programmatic use)
 */
export function formatReportJson(report: ProfileReport): string {
  return JSON.stringify(
    {
      requestId: report.requestId,
      timestamp: report.timestamp.toISOString(),
      totalDurationMs: report.totalDurationMs,
      summary: report.summary,
      breakdown: report.breakdown,
      topOperations: report.topOperations,
    },
    null,
    2
  );
}

/**
 * Format a compact one-line summary
 */
export function formatReportCompact(report: ProfileReport): string {
  const parts = [
    `[PROFILE]`,
    `total=${report.totalDurationMs.toFixed(0)}ms`,
  ];

  const sortedSummary = Object.entries(report.summary)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  for (const [name, ms] of sortedSummary) {
    parts.push(`${formatCategoryNameShort(name)}=${ms.toFixed(0)}ms`);
  }

  return parts.join(" | ");
}

// Helper functions

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

function createProgressBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

function formatCategoryName(name: string): string {
  const nameMap: Record<string, string> = {
    executorInit: "Executor Init",
    contextBuilding: "Context",
    ragSearch: "RAG Search",
    llmInference: "LLM Inference",
    toolExecution: "Tool Execution",
    dbOperations: "Database",
    streaming: "Streaming",
    other: "Other",
  };
  return nameMap[name] ?? name;
}

function formatCategoryNameShort(name: string): string {
  const nameMap: Record<string, string> = {
    executorInit: "exec",
    contextBuilding: "ctx",
    ragSearch: "rag",
    llmInference: "llm",
    toolExecution: "tool",
    dbOperations: "db",
    streaming: "stream",
    other: "other",
  };
  return nameMap[name] ?? name;
}

/**
 * Print span tree for debugging
 */
export function formatSpanTree(span: ProfileSpan, indent: number = 0): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);
  const duration = span.durationMs?.toFixed(2) ?? "?";
  lines.push(`${prefix}├─ ${span.name} (${duration}ms) [${span.category}]`);

  for (const child of span.children) {
    lines.push(formatSpanTree(child, indent + 1));
  }

  return lines.join("\n");
}
