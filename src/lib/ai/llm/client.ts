/**
 * LLM Client - Multi-Provider Language Model Integration
 *
 * This module provides a unified interface for interacting with
 * OpenAI and Anthropic language models, with support for:
 * - Streaming responses
 * - Tool/function calling
 * - Token counting
 * - Automatic retries with exponential backoff
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMToolCall,
  LLMUsage,
  ToolDefinition,
} from "../types";

import { LLMError } from "../types";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 60000;

// Model context window limits (for token estimation)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI models
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  // Anthropic models
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-5-haiku-20241022": 200000,
  "claude-3-opus-20240229": 200000,
  "claude-3-sonnet-20240229": 200000,
  "claude-3-haiku-20240307": 200000,
};

// ============================================================================
// LLM Client Class
// ============================================================================

export class LLMClient {
  private config: LLMConfig;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeClient();
  }

  private initializeClient(): void {
    if (this.config.provider === "openai") {
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      });
    } else if (this.config.provider === "anthropic") {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Send a chat completion request to the LLM
   */
  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: {
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response =
          this.config.provider === "openai"
            ? await this.chatOpenAI(messages, tools)
            : await this.chatAnthropic(messages, tools);

        response.latencyMs = performance.now() - startTime;
        return response;
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const retryAfter = this.getRetryAfter(error);
          if (retryAfter > 0) {
            await this.sleep(retryAfter);
            continue;
          }
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Exponential backoff
        const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Stream a chat completion response
   */
  async *chatStream(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<{ type: "delta" | "tool_call" | "done"; data: unknown }> {
    if (this.config.provider === "openai") {
      yield* this.streamOpenAI(messages, tools);
    } else {
      yield* this.streamAnthropic(messages, tools);
    }
  }

  // ============================================================================
  // OpenAI Implementation
  // ============================================================================

  private async chatOpenAI(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized");
    }

    const openaiMessages = this.convertToOpenAIMessages(messages);
    const openaiTools = tools ? this.convertToOpenAITools(tools) : undefined;

    const response = await this.openaiClient.chat.completions.create({
      model: this.config.model,
      messages: openaiMessages,
      tools: openaiTools,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new LLMError("No response from OpenAI", true);
    }

    const toolCalls = choice.message.tool_calls?.map((tc) => {
      // Handle different tool call types
      if ("function" in tc && tc.function) {
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        };
      }
      return null;
    }).filter((tc): tc is NonNullable<typeof tc> => tc !== null);

    return {
      content: choice.message.content || "",
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      latencyMs: 0,
      finishReason: this.mapOpenAIFinishReason(choice.finish_reason),
    };
  }

  private async *streamOpenAI(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<{ type: "delta" | "tool_call" | "done"; data: unknown }> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized");
    }

    const openaiMessages = this.convertToOpenAIMessages(messages);
    const openaiTools = tools ? this.convertToOpenAITools(tools) : undefined;

    const stream = await this.openaiClient.chat.completions.create({
      model: this.config.model,
      messages: openaiMessages,
      tools: openaiTools,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    let fullContent = "";
    const toolCallsInProgress: Map<number, { id: string; name: string; arguments: string }> =
      new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullContent += delta.content;
        yield { type: "delta", data: { content: delta.content } };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallsInProgress.has(tc.index)) {
            toolCallsInProgress.set(tc.index, {
              id: tc.id || "",
              name: tc.function?.name || "",
              arguments: "",
            });
          }

          const current = toolCallsInProgress.get(tc.index)!;
          if (tc.id) current.id = tc.id;
          if (tc.function?.name) current.name = tc.function.name;
          if (tc.function?.arguments) current.arguments += tc.function.arguments;
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        // Emit completed tool calls
        for (const tc of toolCallsInProgress.values()) {
          yield {
            type: "tool_call",
            data: {
              id: tc.id,
              name: tc.name,
              arguments: JSON.parse(tc.arguments || "{}"),
            },
          };
        }

        yield {
          type: "done",
          data: {
            content: fullContent,
            usage: chunk.usage
              ? {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              : undefined,
          },
        };
      }
    }
  }

  private convertToOpenAIMessages(
    messages: LLMMessage[]
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.toolCallId || "",
        };
      }

      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      };
    });
  }

  private convertToOpenAITools(
    tools: ToolDefinition[]
  ): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, unknown>,
      },
    }));
  }

  private mapOpenAIFinishReason(
    reason: string | null
  ): LLMResponse["finishReason"] {
    switch (reason) {
      case "stop":
        return "stop";
      case "tool_calls":
        return "tool_calls";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }

  // ============================================================================
  // Anthropic Implementation
  // ============================================================================

  private async chatAnthropic(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) {
      throw new Error("Anthropic client not initialized");
    }

    const { systemPrompt, anthropicMessages } = this.convertToAnthropicMessages(messages);
    const anthropicTools = tools ? this.convertToAnthropicTools(tools) : undefined;

    const response = await this.anthropicClient.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    let content = "";
    const toolCalls: LLMToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      latencyMs: 0,
      finishReason: this.mapAnthropicStopReason(response.stop_reason),
    };
  }

  private async *streamAnthropic(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<{ type: "delta" | "tool_call" | "done"; data: unknown }> {
    if (!this.anthropicClient) {
      throw new Error("Anthropic client not initialized");
    }

    const { systemPrompt, anthropicMessages } = this.convertToAnthropicMessages(messages);
    const anthropicTools = tools ? this.convertToAnthropicTools(tools) : undefined;

    const stream = this.anthropicClient.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    let fullContent = "";
    let currentToolUse: { id: string; name: string; input: string } | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: "",
          };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          fullContent += event.delta.text;
          yield { type: "delta", data: { content: event.delta.text } };
        } else if (event.delta.type === "input_json_delta" && currentToolUse) {
          currentToolUse.input += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolUse) {
          yield {
            type: "tool_call",
            data: {
              id: currentToolUse.id,
              name: currentToolUse.name,
              arguments: JSON.parse(currentToolUse.input || "{}"),
            },
          };
          currentToolUse = null;
        }
      } else if (event.type === "message_stop") {
        const finalMessage = await stream.finalMessage();
        yield {
          type: "done",
          data: {
            content: fullContent,
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
              totalTokens:
                finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
            },
          },
        };
      }
    }
  }

  private convertToAnthropicMessages(messages: LLMMessage[]): {
    systemPrompt: string;
    anthropicMessages: Anthropic.MessageParam[];
  } {
    let systemPrompt = "";
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt += (systemPrompt ? "\n\n" : "") + msg.content;
      } else if (msg.role === "user") {
        anthropicMessages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant") {
        anthropicMessages.push({
          role: "assistant",
          content: msg.content,
        });
      } else if (msg.role === "tool") {
        // Tool results in Anthropic are sent as user messages with tool_result blocks
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId || "",
              content: msg.content,
            },
          ],
        });
      }
    }

    return { systemPrompt, anthropicMessages };
  }

  private convertToAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  private mapAnthropicStopReason(
    reason: string | null
  ): LLMResponse["finishReason"] {
    switch (reason) {
      case "end_turn":
        return "stop";
      case "tool_use":
        return "tool_calls";
      case "max_tokens":
        return "length";
      default:
        return "stop";
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof OpenAI.RateLimitError) return true;
    if (error instanceof Anthropic.RateLimitError) return true;
    return false;
  }

  private isRetryableError(error: unknown): boolean {
    // Rate limit errors
    if (this.isRateLimitError(error)) return true;

    // OpenAI retryable errors
    if (error instanceof OpenAI.APIConnectionError) return true;
    if (error instanceof OpenAI.InternalServerError) return true;

    // Anthropic retryable errors
    if (error instanceof Anthropic.APIConnectionError) return true;
    if (error instanceof Anthropic.InternalServerError) return true;

    return false;
  }

  private getRetryAfter(error: unknown): number {
    // Try to extract retry-after from error headers
    const headers = (error as { headers?: Record<string, string> })?.headers;
    if (headers?.["retry-after"]) {
      const retryAfter = parseInt(headers["retry-after"], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000; // Convert to milliseconds
      }
    }
    return DEFAULT_RETRY_DELAY_MS;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Estimate token count for a string (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get the context window limit for the current model
   */
  getContextLimit(): number {
    return MODEL_CONTEXT_LIMITS[this.config.model] || 8192;
  }

  /**
   * Check if messages fit within context window
   */
  checkContextFit(messages: LLMMessage[]): {
    fits: boolean;
    estimatedTokens: number;
    limit: number;
  } {
    const totalText = messages.map((m) => m.content).join("\n");
    const estimatedTokens = this.estimateTokens(totalText);
    const limit = this.getContextLimit();

    return {
      fits: estimatedTokens < limit * 0.9, // Leave 10% buffer
      estimatedTokens,
      limit,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}
