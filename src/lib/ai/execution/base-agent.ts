/**
 * BaseAgent - Core Agent Implementation
 *
 * This is the foundational agent class that handles:
 * - Message processing
 * - LLM interaction
 * - Tool execution
 * - RAG integration
 * - History management
 * - Escalation detection
 *
 * Custom agents can extend this class to add specialized behavior.
 */

import { LLMClient } from "../llm/client";
import { RAGService } from "../rag/service";
import { ToolExecutor } from "../tools/executor";
import { HistoryService } from "./history-service";
import { BUILT_IN_TOOLS } from "../tools/types";

import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  AgentResponseMetadata,
  LLMMessage,
  LLMToolCall,
  EscalationRequest,
  AgentStreamEvent,
  RAGSource,
} from "../types";

// ============================================================================
// Configuration
// ============================================================================

const MAX_TOOL_ITERATIONS = 5;
const DEFAULT_MAX_TOKENS = 4096;

// ============================================================================
// BaseAgent Class
// ============================================================================

export class BaseAgent {
  protected config: AgentConfig;
  protected llm: LLMClient;
  protected rag: RAGService;
  protected history: HistoryService;
  protected toolExecutor: ToolExecutor;

  constructor(config: AgentConfig) {
    this.config = config;

    // Initialize LLM client
    this.llm = new LLMClient({
      ...config.llmConfig,
      maxTokens: config.llmConfig.maxTokens || DEFAULT_MAX_TOKENS,
    });

    // Initialize RAG service
    this.rag = new RAGService(config.ragConfig);

    // Initialize history service
    this.history = new HistoryService(config.historyConfig);

    // Initialize tool executor with enabled tools
    this.toolExecutor = new ToolExecutor({
      enabledBuiltInTools: config.enabledTools,
      customTools: config.customTools,
    });

    // Override the search_knowledge tool with RAG service
    if (config.ragConfig.enabled) {
      this.toolExecutor.overrideToolExecutor(
        BUILT_IN_TOOLS.SEARCH_KNOWLEDGE,
        this.rag.createSearchToolExecutor()
      );
    }
  }

  /**
   * Process an incoming message and generate a response
   */
  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const startTime = performance.now();
    let sources: RAGSource[] = [];
    const toolsUsed: string[] = [];

    try {
      // 1. Load conversation history
      const historyMessages = await this.history.getForLLM(context.conversationId);

      // 2. Retrieve relevant knowledge (RAG)
      let ragContext = "";
      if (this.rag.isEnabled()) {
        const ragResults = await this.rag.searchWithContext({
          query: context.message,
          companyId: context.companyId,
          sourceIds: this.config.knowledgeSourceIds,
        });
        ragContext = ragResults.formattedContext;
        sources = ragResults.sources;
      }

      // 3. Build messages array
      const messages = this.buildMessages({
        systemPrompt: this.config.systemPrompt,
        systemPromptAddition: context.systemPromptAddition,
        ragContext,
        history: historyMessages,
        userMessage: context.message,
      });

      // 4. Get available tools
      const tools = this.toolExecutor.getToolDefinitions();

      // 5. Call LLM with potential tool use
      let response = await this.llm.chat(messages, tools.length > 0 ? tools : undefined);

      // 6. Process tool calls iteratively
      let iterations = 0;
      while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        // Execute tools
        const toolResults = await this.toolExecutor.executeTools(
          response.toolCalls,
          context
        );

        // Track used tools
        toolsUsed.push(...toolResults.map((r) => r.toolName));

        // Check for escalation
        const escalation = this.checkForEscalation(toolResults, context);
        if (escalation) {
          return this.createEscalationResponse(escalation, toolsUsed, startTime);
        }

        // Add tool results to messages
        const assistantMessage: LLMMessage = {
          role: "assistant",
          content: response.content || "",
        };
        messages.push(assistantMessage);

        for (let i = 0; i < response.toolCalls.length; i++) {
          const toolCall = response.toolCalls[i];
          const toolResult = toolResults[i];
          if (toolCall && toolResult) {
            messages.push(
              this.toolExecutor.resultToMessage(toolCall.id, toolResult)
            );
          }
        }

        // Call LLM again with tool results
        response = await this.llm.chat(messages, tools.length > 0 ? tools : undefined);
      }

      // 7. Save to history
      await this.history.append(context.conversationId, [
        { role: "user", content: context.message },
        { role: "assistant", content: response.content },
      ]);

      // 8. Check for automatic escalation
      const autoEscalation = await this.checkAutoEscalation(
        context,
        response.content
      );
      if (autoEscalation) {
        return this.createEscalationResponse(autoEscalation, toolsUsed, startTime);
      }

      // 9. Build response metadata
      const metadata: AgentResponseMetadata = {
        sources: sources.length > 0 ? sources : undefined,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        tokensUsed: response.usage,
        processingTimeMs: performance.now() - startTime,
        modelId: this.config.llmConfig.model,
      };

      return {
        content: response.content,
        metadata,
      };
    } catch (error) {
      console.error("Agent processing error:", error);

      // Return a friendly error message
      const errorMessage = this.config.behavior.fallbackMessage ||
        "I apologize, but I'm having trouble processing your request. Please try again.";

      return {
        content: errorMessage,
        metadata: {
          processingTimeMs: performance.now() - startTime,
        },
      };
    }
  }

  /**
   * Process a message with streaming response
   */
  async *processMessageStream(
    context: AgentContext
  ): AsyncGenerator<AgentStreamEvent> {
    const startTime = performance.now();
    let sources: RAGSource[] = [];
    const toolsUsed: string[] = [];

    try {
      // Emit thinking status
      yield {
        type: "thinking",
        data: { step: "Loading conversation history...", progress: 0.1 },
        timestamp: Date.now(),
      };

      // 1. Load conversation history
      const historyMessages = await this.history.getForLLM(context.conversationId);

      // 2. Retrieve relevant knowledge (RAG)
      let ragContext = "";
      if (this.rag.isEnabled()) {
        yield {
          type: "thinking",
          data: { step: "Searching knowledge base...", progress: 0.3 },
          timestamp: Date.now(),
        };

        const ragResults = await this.rag.searchWithContext({
          query: context.message,
          companyId: context.companyId,
          sourceIds: this.config.knowledgeSourceIds,
        });
        ragContext = ragResults.formattedContext;
        sources = ragResults.sources;
      }

      // 3. Build messages
      const messages = this.buildMessages({
        systemPrompt: this.config.systemPrompt,
        systemPromptAddition: context.systemPromptAddition,
        ragContext,
        history: historyMessages,
        userMessage: context.message,
      });

      // 4. Get available tools
      const tools = this.toolExecutor.getToolDefinitions();

      yield {
        type: "thinking",
        data: { step: "Generating response...", progress: 0.5 },
        timestamp: Date.now(),
      };

      // 5. Stream LLM response
      let fullContent = "";
      const currentToolCalls: LLMToolCall[] = [];

      const stream = this.llm.chatStream(messages, tools.length > 0 ? tools : undefined);

      for await (const event of stream) {
        if (event.type === "delta") {
          const delta = event.data as { content: string };
          fullContent += delta.content;
          yield {
            type: "delta",
            data: { content: delta.content },
            timestamp: Date.now(),
          };
        } else if (event.type === "tool_call") {
          const toolCall = event.data as LLMToolCall;
          currentToolCalls.push(toolCall);

          yield {
            type: "tool_call",
            data: {
              toolName: toolCall.name,
              status: "executing",
              arguments: toolCall.arguments,
            },
            timestamp: Date.now(),
          };

          // Execute the tool
          const result = await this.toolExecutor.executeTool(toolCall, context);
          toolsUsed.push(result.toolName);

          yield {
            type: "tool_call",
            data: {
              toolName: toolCall.name,
              status: result.success ? "completed" : "failed",
              result,
            },
            timestamp: Date.now(),
          };
        }
      }

      // If there were tool calls, we need to continue the conversation
      if (currentToolCalls.length > 0) {
        // Add assistant message and tool results
        messages.push({ role: "assistant", content: fullContent || "" });

        for (const toolCall of currentToolCalls) {
          const result = await this.toolExecutor.executeTool(toolCall, context);
          messages.push(this.toolExecutor.resultToMessage(toolCall.id, result));
        }

        // Stream the final response
        fullContent = "";
        const continueStream = this.llm.chatStream(messages, tools);

        for await (const event of continueStream) {
          if (event.type === "delta") {
            const delta = event.data as { content: string };
            fullContent += delta.content;
            yield {
              type: "delta",
              data: { content: delta.content },
              timestamp: Date.now(),
            };
          }
        }
      }

      // Save to history
      await this.history.append(context.conversationId, [
        { role: "user", content: context.message },
        { role: "assistant", content: fullContent },
      ]);

      // Emit complete event
      yield {
        type: "complete",
        data: {
          content: fullContent,
          metadata: {
            sources: sources.length > 0 ? sources : undefined,
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            processingTimeMs: performance.now() - startTime,
            modelId: this.config.llmConfig.model,
          },
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Agent streaming error:", error);

      yield {
        type: "error",
        data: {
          code: "PROCESSING_ERROR",
          message: "An error occurred while processing your message.",
          retryable: true,
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build the messages array for LLM
   */
  protected buildMessages(params: {
    systemPrompt: string;
    systemPromptAddition?: string;
    ragContext?: string;
    history: LLMMessage[];
    userMessage: string;
  }): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // Build system prompt
    let systemContent = params.systemPrompt;

    if (params.systemPromptAddition) {
      systemContent += "\n\n" + params.systemPromptAddition;
    }

    if (params.ragContext) {
      systemContent += "\n\n" + params.ragContext;
    }

    messages.push({
      role: "system",
      content: systemContent,
    });

    // Add history
    messages.push(...params.history);

    // Add current user message
    messages.push({
      role: "user",
      content: params.userMessage,
    });

    return messages;
  }

  /**
   * Check tool results for escalation requests
   */
  protected checkForEscalation(
    toolResults: Array<{ toolName: string; success: boolean; result?: unknown }>,
    context: AgentContext
  ): EscalationRequest | null {
    for (const result of toolResults) {
      if (
        result.toolName === BUILT_IN_TOOLS.REQUEST_HUMAN_HANDOVER &&
        result.success
      ) {
        const data = result.result as {
          action: string;
          reason: string;
          urgency: string;
          summary?: string;
        };

        if (data.action === "escalate") {
          return {
            conversationId: context.conversationId,
            reason: data.reason,
            triggerType: "tool_request",
            priority: data.urgency as "low" | "medium" | "high" | "urgent",
          };
        }
      }
    }

    return null;
  }

  /**
   * Check for automatic escalation triggers
   */
  protected async checkAutoEscalation(
    context: AgentContext,
    response: string
  ): Promise<EscalationRequest | null> {
    if (!this.config.escalationEnabled) {
      return null;
    }

    // Check for keyword triggers
    for (const trigger of this.config.escalationTriggers) {
      if (trigger.type === "keyword") {
        const keywords = (trigger.config.keywords as string[]) || [];
        const messageToCheck = (context.message + " " + response).toLowerCase();

        for (const keyword of keywords) {
          if (messageToCheck.includes(keyword.toLowerCase())) {
            return {
              conversationId: context.conversationId,
              reason: `Keyword trigger: "${keyword}"`,
              triggerType: "keyword",
              priority: trigger.priority,
            };
          }
        }
      }
    }

    // TODO: Add sentiment analysis trigger
    // TODO: Add turn count trigger

    return null;
  }

  /**
   * Create an escalation response
   */
  protected createEscalationResponse(
    escalation: EscalationRequest,
    toolsUsed: string[],
    startTime: number
  ): AgentResponse {
    return {
      content:
        "I'm connecting you with a human support agent who can better assist you. Please hold on a moment.",
      metadata: {
        shouldEscalate: true,
        escalationReason: escalation.reason,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        processingTimeMs: performance.now() - startTime,
      },
    };
  }

  /**
   * Get the agent's greeting message
   */
  getGreeting(): string {
    return this.config.behavior.greeting;
  }

  /**
   * Get the agent's fallback message
   */
  getFallbackMessage(): string {
    return this.config.behavior.fallbackMessage;
  }

  /**
   * Check if agent is within working hours
   */
  isWithinWorkingHours(): boolean {
    const workingHours = this.config.behavior.workingHours;
    if (!workingHours) {
      return true; // No working hours configured = always available
    }

    try {
      const now = new Date();
      const timezone = workingHours.timezone || "UTC";

      // Get current day and time in the specified timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const weekday = parts.find((p) => p.type === "weekday")?.value || "";
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
      const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");

      const schedule = workingHours.schedule[weekday.toLowerCase()];
      if (!schedule) {
        return false; // Day not in schedule
      }

      const startParts = schedule.start.split(":").map(Number);
      const endParts = schedule.end.split(":").map(Number);
      const startHour = startParts[0] ?? 0;
      const startMin = startParts[1] ?? 0;
      const endHour = endParts[0] ?? 23;
      const endMin = endParts[1] ?? 59;

      const currentMinutes = hour * 60 + minute;
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } catch {
      return true; // On error, assume available
    }
  }

  /**
   * Get the agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAgent(config: AgentConfig): BaseAgent {
  return new BaseAgent(config);
}
