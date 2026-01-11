/**
 * Built-in Tools - Default Tools Available to All Agents
 *
 * These tools provide core functionality that most AI agents will need:
 * - Knowledge base search (RAG)
 * - Human handover requests
 * - Utility functions
 */

import type { AgentContext, ToolResult } from "../types";
import type { RegisteredTool } from "./types";
import { BUILT_IN_TOOLS } from "./types";

// ============================================================================
// Knowledge Search Tool
// ============================================================================

/**
 * Search the knowledge base for relevant information.
 * This tool integrates with the RAG service to find relevant documents.
 */
export const searchKnowledgeTool: RegisteredTool = {
  name: BUILT_IN_TOOLS.SEARCH_KNOWLEDGE,
  description:
    "Search the knowledge base for information relevant to the user's question. Use this when you need to find specific information about products, policies, procedures, or other documented topics.",
  category: "knowledge",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant information",
      },
      category: {
        type: "string",
        description: "Optional category to narrow down the search",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
        default: 5,
      },
    },
    required: ["query"],
  },
  execute: async (
    params: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: AgentContext
  ): Promise<ToolResult> => {
    // This will be implemented by the RAG service
    // For now, return a placeholder that will be replaced at runtime
    const query = params.query as string;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _maxResults = (params.maxResults as number) || 5;

    // The actual implementation will be injected by the agent runner
    // This is just the interface definition
    return {
      success: true,
      data: {
        message: `Knowledge search executed for: "${query}"`,
        results: [],
        note: "RAG service integration pending",
      },
    };
  },
};

// ============================================================================
// Human Handover Tool
// ============================================================================

/**
 * Request to transfer the conversation to a human agent.
 * This tool triggers the HITL escalation system.
 */
export const requestHumanHandoverTool: RegisteredTool = {
  name: BUILT_IN_TOOLS.REQUEST_HUMAN_HANDOVER,
  description:
    "Transfer the conversation to a human support agent. Use this when the user explicitly requests human assistance, when you cannot adequately answer their question, or when the situation requires human judgment.",
  category: "escalation",
  requiresApproval: false,
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "The reason for requesting human assistance",
      },
      urgency: {
        type: "string",
        description: "The urgency level of the handover request",
        enum: ["low", "medium", "high", "urgent"],
        default: "medium",
      },
      summary: {
        type: "string",
        description:
          "A brief summary of the conversation and issue for the human agent",
      },
    },
    required: ["reason"],
  },
  execute: async (
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> => {
    const reason = params.reason as string;
    const urgency = (params.urgency as string) || "medium";
    const summary = params.summary as string | undefined;

    // The actual escalation will be handled by the escalation service
    // This returns the intent to escalate
    return {
      success: true,
      data: {
        action: "escalate",
        reason,
        urgency,
        summary,
        conversationId: context.conversationId,
        timestamp: new Date().toISOString(),
      },
    };
  },
};

// ============================================================================
// Current Time Tool
// ============================================================================

/**
 * Get the current date and time.
 * Useful for time-sensitive queries.
 */
export const getCurrentTimeTool: RegisteredTool = {
  name: BUILT_IN_TOOLS.GET_CURRENT_TIME,
  description:
    "Get the current date and time. Use this when the user asks about the current time or when time-sensitive information is needed.",
  category: "utility",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "The timezone to get the time for (e.g., 'America/New_York', 'Europe/London'). Defaults to UTC.",
        default: "UTC",
      },
      format: {
        type: "string",
        description: "The format of the output",
        enum: ["full", "date", "time"],
        default: "full",
      },
    },
    required: [],
  },
  execute: async (
    params: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: AgentContext
  ): Promise<ToolResult> => {
    try {
      const timezone = (params.timezone as string) || "UTC";
      const format = (params.format as string) || "full";

      const now = new Date();

      let formattedTime: string;
      const options: Intl.DateTimeFormatOptions = { timeZone: timezone };

      switch (format) {
        case "date":
          options.dateStyle = "full";
          formattedTime = now.toLocaleDateString("en-US", options);
          break;
        case "time":
          options.timeStyle = "long";
          formattedTime = now.toLocaleTimeString("en-US", options);
          break;
        default:
          options.dateStyle = "full";
          options.timeStyle = "long";
          formattedTime = now.toLocaleString("en-US", options);
      }

      return {
        success: true,
        data: {
          formatted: formattedTime,
          iso: now.toISOString(),
          timezone,
          timestamp: now.getTime(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get time: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};

// ============================================================================
// Calculator Tool
// ============================================================================

/**
 * Perform basic mathematical calculations.
 */
export const calculateTool: RegisteredTool = {
  name: BUILT_IN_TOOLS.CALCULATE,
  description:
    "Perform mathematical calculations. Use this for arithmetic, percentages, or other numeric computations the user needs.",
  category: "utility",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "The mathematical expression to evaluate (e.g., '2 + 2', '15 * 0.8', '100 / 4')",
      },
    },
    required: ["expression"],
  },
  execute: async (
    params: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: AgentContext
  ): Promise<ToolResult> => {
    try {
      const expression = params.expression as string;

      // Sanitize the expression to only allow safe characters
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");

      if (sanitized !== expression.replace(/\s/g, "").replace(/\s/g, "")) {
        return {
          success: false,
          error: "Expression contains invalid characters",
        };
      }

      // Use Function constructor for safe evaluation of math expressions
      // This is safer than eval() as it only has access to Math object
      const calculate = new Function(
        "return " + sanitized.replace(/%/g, "/100*")
      );
      const result = calculate();

      if (typeof result !== "number" || !isFinite(result)) {
        return {
          success: false,
          error: "Invalid calculation result",
        };
      }

      return {
        success: true,
        data: {
          expression,
          result,
          formatted:
            result % 1 === 0 ? result.toString() : result.toFixed(4),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Calculation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All built-in tools available to agents
 */
export const builtInTools: RegisteredTool[] = [
  searchKnowledgeTool,
  requestHumanHandoverTool,
  getCurrentTimeTool,
  calculateTool,
];

/**
 * Get a built-in tool by name
 */
export function getBuiltInTool(name: string): RegisteredTool | undefined {
  return builtInTools.find((tool) => tool.name === name);
}

/**
 * Get all built-in tools
 */
export function getAllBuiltInTools(): RegisteredTool[] {
  return [...builtInTools];
}

/**
 * Get built-in tools by category
 */
export function getBuiltInToolsByCategory(category: string): RegisteredTool[] {
  return builtInTools.filter((tool) => tool.category === category);
}
