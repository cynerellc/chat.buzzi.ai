/**
 * AI Agent Framework
 *
 * This module provides a complete AI agent framework for the chat platform:
 *
 * - LLM Client: Multi-provider support for OpenAI and Anthropic
 * - Tool System: Extensible tool framework with built-in tools
 * - RAG Service: Knowledge retrieval and context injection
 * - History Service: Conversation history management
 * - Base Agent: Core agent implementation
 * - Agent Runner: Agent lifecycle and execution management
 *
 * Usage:
 *
 * ```typescript
 * import { getAgentRunner } from "@/lib/ai";
 *
 * // Create a new chat session
 * const runner = getAgentRunner();
 * const session = await runner.createSession({
 *   agentId: "agent-uuid",
 *   companyId: "company-uuid",
 *   channel: "web",
 * });
 *
 * // Send a message
 * const response = await runner.sendMessage({
 *   conversationId: session.conversationId,
 *   message: "Hello!",
 * });
 *
 * // Stream a response
 * for await (const event of runner.sendMessageStream({
 *   conversationId: session.conversationId,
 *   message: "Tell me about your products",
 * })) {
 *   if (event.type === "delta") {
 *     process.stdout.write(event.data.content);
 *   }
 * }
 * ```
 */

// Types
export * from "./types";

// LLM
export { LLMClient, createLLMClient } from "./llm";

// Tools
export {
  ToolExecutor,
  createToolExecutor,
  builtInTools,
  getBuiltInTool,
  getAllBuiltInTools,
  BUILT_IN_TOOLS,
} from "./tools";
export type { RegisteredTool, ToolExecutionResult } from "./tools";

// RAG
export { RAGService, createRAGService, defaultRAGConfig } from "./rag";
export type { RAGSearchOptions, RAGResult, RAGContext } from "./rag";

// Execution
export {
  BaseAgent,
  createAgent,
  HistoryService,
  createHistoryService,
  defaultHistoryConfig,
  AgentRunnerService,
  getAgentRunner,
  createAgentRunner,
} from "./execution";
export type {
  CreateSessionOptions,
  SessionInfo,
  SendMessageOptions,
  HistoryMessage,
  ConversationHistory,
} from "./execution";
