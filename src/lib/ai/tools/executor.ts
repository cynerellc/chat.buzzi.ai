/**
 * Tool Executor - Manages Tool Execution for AI Agents
 *
 * This module handles:
 * - Tool registration and lookup
 * - Safe tool execution with timeouts
 * - Tool result formatting
 * - Execution metrics
 */

import type { AgentContext, LLMToolCall, ToolDefinition } from "../types";
import type { RegisteredTool, ToolExecutionResult } from "./types";
import { builtInTools } from "./built-in";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_TOOL_TIMEOUT_MS = 30000; // 30 seconds

// ============================================================================
// Tool Executor Class
// ============================================================================

export class ToolExecutor {
  private tools: Map<string, RegisteredTool> = new Map();
  private toolOverrides: Map<string, RegisteredTool["execute"]> = new Map();

  constructor(options?: {
    customTools?: RegisteredTool[];
    enabledBuiltInTools?: string[];
    toolOverrides?: Map<string, RegisteredTool["execute"]>;
  }) {
    // Register enabled built-in tools
    const enabledBuiltIn = options?.enabledBuiltInTools;
    for (const tool of builtInTools) {
      if (!enabledBuiltIn || enabledBuiltIn.includes(tool.name)) {
        this.tools.set(tool.name, tool);
      }
    }

    // Register custom tools
    if (options?.customTools) {
      for (const tool of options.customTools) {
        this.tools.set(tool.name, tool);
      }
    }

    // Store tool overrides (for injecting RAG service, etc.)
    if (options?.toolOverrides) {
      this.toolOverrides = options.toolOverrides;
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: RegisteredTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Override a tool's execute function
   * Useful for injecting services like RAG
   */
  overrideToolExecutor(name: string, executor: RegisteredTool["execute"]): void {
    this.toolOverrides.set(name, executor);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM (without execute function)
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a single tool call
   */
  async executeTool(
    toolCall: LLMToolCall,
    context: AgentContext,
    options?: { timeout?: number }
  ): Promise<ToolExecutionResult> {
    const startTime = performance.now();
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        toolName: toolCall.name,
        success: false,
        error: `Unknown tool: ${toolCall.name}`,
        executionTimeMs: performance.now() - startTime,
      };
    }

    try {
      // Use override if available, otherwise use tool's execute function
      const executor = this.toolOverrides.get(toolCall.name) || tool.execute;

      // Execute with timeout
      const timeout = options?.timeout || DEFAULT_TOOL_TIMEOUT_MS;
      const result = await this.executeWithTimeout(
        executor(toolCall.arguments, context),
        timeout
      );

      return {
        toolName: toolCall.name,
        success: result.success,
        result: result.data,
        error: result.error,
        executionTimeMs: performance.now() - startTime,
      };
    } catch (error) {
      return {
        toolName: toolCall.name,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeTools(
    toolCalls: LLMToolCall[],
    context: AgentContext,
    options?: { timeout?: number; parallel?: boolean }
  ): Promise<ToolExecutionResult[]> {
    if (options?.parallel === false) {
      // Execute sequentially
      const results: ToolExecutionResult[] = [];
      for (const toolCall of toolCalls) {
        results.push(await this.executeTool(toolCall, context, options));
      }
      return results;
    }

    // Execute in parallel (default)
    return Promise.all(
      toolCalls.map((toolCall) => this.executeTool(toolCall, context, options))
    );
  }

  /**
   * Format tool results for inclusion in LLM messages
   */
  formatToolResults(results: ToolExecutionResult[]): string {
    return results
      .map((result) => {
        if (result.success) {
          return `Tool "${result.toolName}" result:\n${JSON.stringify(result.result, null, 2)}`;
        } else {
          return `Tool "${result.toolName}" failed: ${result.error}`;
        }
      })
      .join("\n\n");
  }

  /**
   * Convert tool execution result to LLM message format
   */
  resultToMessage(
    toolCallId: string,
    result: ToolExecutionResult
  ): { role: "tool"; content: string; toolCallId: string } {
    return {
      role: "tool",
      content: result.success
        ? JSON.stringify(result.result)
        : JSON.stringify({ error: result.error }),
      toolCallId,
    };
  }

  /**
   * Execute a promise with a timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Check if a tool requires approval before execution
   */
  requiresApproval(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    return tool?.requiresApproval || false;
  }

  /**
   * Validate tool call parameters against schema
   */
  validateToolCall(toolCall: LLMToolCall): { valid: boolean; errors: string[] } {
    const tool = this.tools.get(toolCall.name);
    const errors: string[] = [];

    if (!tool) {
      return { valid: false, errors: [`Unknown tool: ${toolCall.name}`] };
    }

    // Check required parameters
    const required = tool.parameters.required || [];
    for (const param of required) {
      if (!(param in toolCall.arguments)) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    // Basic type validation
    for (const [key, value] of Object.entries(toolCall.arguments)) {
      const schema = tool.parameters.properties[key];
      if (!schema) {
        // Unknown parameter - could be strict or lenient here
        continue;
      }

      const expectedType = schema.type;
      const actualType = Array.isArray(value) ? "array" : typeof value;

      if (expectedType !== actualType && value !== null && value !== undefined) {
        errors.push(
          `Parameter "${key}" has wrong type: expected ${expectedType}, got ${actualType}`
        );
      }

      // Enum validation
      if (schema.enum && !schema.enum.includes(value as string)) {
        errors.push(
          `Parameter "${key}" must be one of: ${schema.enum.join(", ")}`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createToolExecutor(options?: {
  customTools?: RegisteredTool[];
  enabledBuiltInTools?: string[];
}): ToolExecutor {
  return new ToolExecutor(options);
}
