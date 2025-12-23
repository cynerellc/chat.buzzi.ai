/**
 * Tool System - Type Definitions
 *
 * Defines the structure for AI agent tools that can be used
 * during conversation processing.
 */

import type { AgentContext, ToolResult } from "../types";

// ============================================================================
// Tool Registry Types
// ============================================================================

export interface ToolExecutor {
  (params: Record<string, unknown>, context: AgentContext): Promise<ToolResult>;
}

export interface RegisteredTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
  execute: ToolExecutor;
  requiresApproval?: boolean;
  category?: string;
}

export interface ToolParameterSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  default?: unknown;
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
}

// ============================================================================
// Tool Execution Types
// ============================================================================

export interface ToolExecutionContext {
  tool: RegisteredTool;
  params: Record<string, unknown>;
  agentContext: AgentContext;
  startTime: number;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}

// ============================================================================
// Built-in Tool Names
// ============================================================================

export const BUILT_IN_TOOLS = {
  SEARCH_KNOWLEDGE: "search_knowledge",
  REQUEST_HUMAN_HANDOVER: "request_human_handover",
  GET_CURRENT_TIME: "get_current_time",
  CALCULATE: "calculate",
} as const;

export type BuiltInToolName = (typeof BUILT_IN_TOOLS)[keyof typeof BUILT_IN_TOOLS];
