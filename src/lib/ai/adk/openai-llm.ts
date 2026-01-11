/**
 * OpenAI LLM Provider for Google ADK
 *
 * This module provides an OpenAI implementation of the BaseLlm interface,
 * allowing the use of OpenAI models (gpt-5 series) with ADK.
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionSystemMessageParam,
} from "openai/resources/chat/completions";

import {
  BaseLlm,
  type LlmRequest,
  type LlmResponse,
  LLMRegistry,
  type BaseLlmConnection,
} from "@google/adk";

// ============================================================================
// Local Type Definitions (to avoid version mismatch between @google/genai versions)
// ============================================================================

interface LocalFunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

interface LocalFunctionResponse {
  id?: string;
  name: string;
  response?: unknown;
}

interface LocalPart {
  text?: string;
  functionCall?: LocalFunctionCall;
  functionResponse?: LocalFunctionResponse;
}

interface LocalContent {
  role?: string;
  parts?: LocalPart[];
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ============================================================================
// Content Conversion Utilities
// ============================================================================

/**
 * Extract text from Content parts
 */
function extractTextFromParts(parts: LocalPart[]): string {
  return parts
    .filter((part): part is LocalPart & { text: string } => "text" in part && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

/**
 * Extract function calls from Content parts
 */
function extractFunctionCalls(parts: LocalPart[]): LocalFunctionCall[] {
  return parts
    .filter((part): part is LocalPart & { functionCall: LocalFunctionCall } =>
      "functionCall" in part && part.functionCall !== undefined)
    .map((part) => part.functionCall);
}

/**
 * Extract function responses from Content parts
 */
function extractFunctionResponses(parts: LocalPart[]): LocalFunctionResponse[] {
  return parts
    .filter((part): part is LocalPart & { functionResponse: LocalFunctionResponse } =>
      "functionResponse" in part && part.functionResponse !== undefined)
    .map((part) => part.functionResponse);
}

/**
 * Convert Gemini Content array to OpenAI messages
 */
function convertContentsToOpenAIMessages(
  contents: LocalContent[],
  systemInstruction?: string
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  // Add system message if present
  if (systemInstruction) {
    messages.push({
      role: "system",
      content: systemInstruction,
    } as ChatCompletionSystemMessageParam);
  }

  for (const content of contents) {
    if (!content.parts || content.parts.length === 0) continue;

    const role = content.role;
    const text = extractTextFromParts(content.parts);
    const functionCalls = extractFunctionCalls(content.parts);
    const functionResponses = extractFunctionResponses(content.parts);

    if (role === "user") {
      // Check if this is a function response (tool result)
      if (functionResponses.length > 0) {
        // This is a tool result from the previous assistant message
        for (const funcResp of functionResponses) {
          messages.push({
            role: "tool",
            tool_call_id: funcResp.id || funcResp.name,
            content: JSON.stringify(funcResp.response),
          } as ChatCompletionToolMessageParam);
        }
      } else {
        messages.push({
          role: "user",
          content: text,
        } as ChatCompletionUserMessageParam);
      }
    } else if (role === "model") {
      // Model/assistant message
      if (functionCalls.length > 0) {
        // Assistant message with tool calls
        messages.push({
          role: "assistant",
          content: text || null,
          tool_calls: functionCalls.map((fc) => ({
            id: fc.id || fc.name,
            type: "function" as const,
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args || {}),
            },
          })),
        } as ChatCompletionAssistantMessageParam);
      } else {
        messages.push({
          role: "assistant",
          content: text,
        } as ChatCompletionAssistantMessageParam);
      }
    }
  }

  return messages;
}

/**
 * Convert Google Schema type to JSON Schema type
 * Google uses uppercase (STRING, NUMBER, etc.)
 * OpenAI/JSON Schema uses lowercase ("string", "number", etc.)
 */
function convertGoogleTypeToJsonSchemaType(googleType: string): string {
  const typeMap: Record<string, string> = {
    "STRING": "string",
    "NUMBER": "number",
    "INTEGER": "integer",
    "BOOLEAN": "boolean",
    "ARRAY": "array",
    "OBJECT": "object",
  };
  return typeMap[googleType] || googleType.toLowerCase();
}

/**
 * Recursively convert Google Schema to JSON Schema
 */
function convertGoogleSchemaToJsonSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object") return undefined;

  const googleSchema = schema as Record<string, unknown>;
  const jsonSchema: Record<string, unknown> = {};

  // Convert type
  if (googleSchema.type) {
    jsonSchema.type = convertGoogleTypeToJsonSchemaType(googleSchema.type as string);
  }

  // Copy description
  if (googleSchema.description) {
    jsonSchema.description = googleSchema.description;
  }

  // Copy enum
  if (googleSchema.enum) {
    jsonSchema.enum = googleSchema.enum;
  }

  // Copy required
  if (googleSchema.required) {
    jsonSchema.required = googleSchema.required;
  }

  // Recursively convert properties
  if (googleSchema.properties && typeof googleSchema.properties === "object") {
    const convertedProperties: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(googleSchema.properties as Record<string, unknown>)) {
      convertedProperties[key] = convertGoogleSchemaToJsonSchema(propSchema);
    }
    jsonSchema.properties = convertedProperties;
  }

  // Handle items for arrays
  if (googleSchema.items) {
    jsonSchema.items = convertGoogleSchemaToJsonSchema(googleSchema.items);
  }

  return jsonSchema;
}

/**
 * Convert ADK BaseTool definitions to OpenAI tool format
 */
function convertToolsToOpenAI(toolsDict: Record<string, unknown>): ChatCompletionTool[] {
  const tools: ChatCompletionTool[] = [];

  for (const [, tool] of Object.entries(toolsDict)) {
    // Get the tool declaration from ADK tool
    const adkTool = tool as { _getDeclaration?: () => { name: string; description?: string; parameters?: unknown } };
    if (adkTool._getDeclaration) {
      const declaration = adkTool._getDeclaration();

      // Convert Google Schema to JSON Schema
      const jsonSchemaParams = convertGoogleSchemaToJsonSchema(declaration.parameters);

      tools.push({
        type: "function",
        function: {
          name: declaration.name,
          description: declaration.description,
          parameters: jsonSchemaParams,
        },
      });
    }
  }

  return tools;
}

/**
 * Build LlmResponse from parts
 */
function buildLlmResponse(
  parts: LocalPart[],
  partial: boolean,
  turnComplete: boolean,
  finishReason?: string,
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
): LlmResponse {
  return {
    content: {
      role: "model",
      parts: parts as unknown[],
    } as LlmResponse["content"],
    partial,
    turnComplete,
    usageMetadata: usage
      ? {
          promptTokenCount: usage.prompt_tokens,
          candidatesTokenCount: usage.completion_tokens,
          totalTokenCount: usage.total_tokens,
        }
      : undefined,
    finishReason: finishReason as LlmResponse["finishReason"],
  };
}

/**
 * Convert OpenAI response to LlmResponse
 */
function convertOpenAIResponseToLlmResponse(
  response: OpenAI.Chat.Completions.ChatCompletion,
  partial: boolean = false
): LlmResponse {
  const choice = response.choices[0];
  if (!choice) {
    return {
      errorCode: "NO_CHOICE",
      errorMessage: "No response choice from OpenAI",
    };
  }

  const message = choice.message;
  const parts: LocalPart[] = [];

  // Add text content if present
  if (message.content) {
    parts.push({ text: message.content });
  }

  // Add function calls if present
  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const toolCall of message.tool_calls) {
      if (toolCall.type === "function") {
        parts.push({
          functionCall: {
            id: toolCall.id,
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || "{}"),
          },
        });
      }
    }
  }

  // Map OpenAI finish reason to Gemini
  let finishReason: string | undefined;
  switch (choice.finish_reason) {
    case "stop":
      finishReason = "STOP";
      break;
    case "length":
      finishReason = "MAX_TOKENS";
      break;
    case "content_filter":
      finishReason = "SAFETY";
      break;
    case "tool_calls":
      // For tool calls, we don't set finish reason - the agent continues
      finishReason = undefined;
      break;
    default:
      finishReason = "OTHER";
  }

  return buildLlmResponse(
    parts,
    partial,
    !partial && choice.finish_reason === "stop",
    finishReason,
    response.usage || undefined
  );
}

// ============================================================================
// OpenAI LLM Class
// ============================================================================

/**
 * OpenAI LLM implementation for ADK
 */
export class OpenAILlm extends BaseLlm {
  private client: OpenAI;

  /**
   * Supported OpenAI models
   */
  static readonly supportedModels: Array<string | RegExp> = [
    // GPT-5 series
    /^gpt-5.*/,
  ];

  constructor({ model }: { model: string }) {
    super({ model });

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate content using OpenAI
   */
  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream: boolean = false
  ): AsyncGenerator<LlmResponse, void> {
    try {
      // Extract system instruction from config
      const systemInstruction = llmRequest.config?.systemInstruction;
      let systemText: string | undefined;

      if (typeof systemInstruction === "string") {
        systemText = systemInstruction;
      } else if (
        systemInstruction &&
        typeof systemInstruction === "object" &&
        "parts" in systemInstruction
      ) {
        const contentInstruction = systemInstruction as LocalContent;
        systemText = extractTextFromParts(contentInstruction.parts || []);
      }

      // Convert messages - cast to local types
      const messages = convertContentsToOpenAIMessages(
        llmRequest.contents as unknown as LocalContent[],
        systemText
      );

      // Convert tools
      const tools =
        Object.keys(llmRequest.toolsDict).length > 0
          ? convertToolsToOpenAI(llmRequest.toolsDict)
          : undefined;

      // Get temperature from config
      const temperature = llmRequest.config?.temperature ?? 0.7;

      // Determine model capabilities
      // GPT-5 models use max_completion_tokens instead of max_tokens
      const usesMaxCompletionTokens = /^gpt-5/.test(this.model);
      // GPT-5-mini and GPT-5-nano don't support custom temperature
      const noCustomTemperature = /^gpt-5-(mini|nano)/.test(this.model);
      const maxTokens = llmRequest.config?.maxOutputTokens ?? 4096;

      if (stream) {
        // Debug: Log what we're sending to OpenAI
        if (process.env.ENABLE_PROFILER === "true") {
          const systemMessages = messages.filter(m => m.role === "system");
          const userMessages = messages.filter(m => m.role === "user");
          const assistantMessages = messages.filter(m => m.role === "assistant");
          const toolMessages = messages.filter(m => m.role === "tool");

          // Estimate token count (rough: 4 chars per token)
          const totalChars = messages.reduce((sum, m) => {
            if (typeof m.content === "string") return sum + m.content.length;
            if (Array.isArray(m.content)) {
              return sum + (m.content as unknown[]).reduce((s: number, p) => s + (typeof p === "string" ? p.length : JSON.stringify(p).length), 0);
            }
            return sum;
          }, 0);
          const estimatedTokens = Math.ceil(totalChars / 4);

          console.log(`\n[OpenAILlm] Request to ${this.model}:`);
          console.log(`  Messages: ${messages.length} total (${systemMessages.length} system, ${userMessages.length} user, ${assistantMessages.length} assistant, ${toolMessages.length} tool)`);
          console.log(`  Estimated input tokens: ~${estimatedTokens}`);
          console.log(`  Tools defined: ${tools?.length ?? 0}`);
          const firstSystemMsg = systemMessages[0];
          if (firstSystemMsg && typeof firstSystemMsg.content === "string") {
            console.log(`  System prompt length: ${firstSystemMsg.content.length} chars`);
          }
        }

        // Streaming mode
        const apiCallStart = performance.now();
        const streamResponse = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          temperature: noCustomTemperature ? undefined : temperature,
          max_completion_tokens: usesMaxCompletionTokens ? maxTokens : undefined,
          max_tokens: usesMaxCompletionTokens ? undefined : maxTokens,
          stream: true,
        });

        if (process.env.ENABLE_PROFILER === "true") {
          console.log(`[OpenAILlm] Stream started after ${(performance.now() - apiCallStart).toFixed(0)}ms`);
        }

        // Track accumulated tool calls for streaming
        const accumulatedToolCalls: Map<number, OpenAIToolCall> = new Map();
        // Accumulated content is tracked for potential future debugging use
        let _accumulatedContent = "";
        let firstTokenReceived = false;

        for await (const chunk of streamResponse) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          const delta = choice.delta;

          // Accumulate content
          if (delta.content) {
            if (!firstTokenReceived && process.env.ENABLE_PROFILER === "true") {
              console.log(`[OpenAILlm] First token received after ${(performance.now() - apiCallStart).toFixed(0)}ms`);
              firstTokenReceived = true;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _accumulatedContent += delta.content;
            yield buildLlmResponse(
              [{ text: delta.content }],
              true,
              false
            );
          }

          // Accumulate tool calls
          if (delta.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;
              let existing = accumulatedToolCalls.get(index);

              if (!existing) {
                existing = {
                  id: toolCallDelta.id || "",
                  type: "function",
                  function: {
                    name: "",
                    arguments: "",
                  },
                };
                accumulatedToolCalls.set(index, existing);
              }

              if (toolCallDelta.id) {
                existing.id = toolCallDelta.id;
              }
              if (toolCallDelta.function?.name) {
                existing.function.name += toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                existing.function.arguments += toolCallDelta.function.arguments;
              }
            }
          }

          // Check for completion
          if (choice.finish_reason) {
            const parts: LocalPart[] = [];

            // Only include accumulated tool calls in final response
            // Don't include text - it was already streamed as deltas
            for (const toolCall of accumulatedToolCalls.values()) {
              try {
                parts.push({
                  functionCall: {
                    id: toolCall.id,
                    name: toolCall.function.name,
                    args: JSON.parse(toolCall.function.arguments || "{}"),
                  },
                });
              } catch {
                // Skip malformed tool calls
              }
            }

            // Only emit final response if there are tool calls or to signal completion
            yield buildLlmResponse(
              parts,
              false,
              choice.finish_reason === "stop",
              choice.finish_reason === "stop" ? "STOP" : undefined
            );
          }
        }
      } else {
        // Non-streaming mode
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          temperature: noCustomTemperature ? undefined : temperature,
          max_completion_tokens: usesMaxCompletionTokens ? maxTokens : undefined,
          max_tokens: usesMaxCompletionTokens ? undefined : maxTokens,
          stream: false,
        });

        yield convertOpenAIResponseToLlmResponse(response, false);
      }
    } catch (error) {
      yield {
        errorCode: "OPENAI_ERROR",
        errorMessage: error instanceof Error ? error.message : "OpenAI API error",
      };
    }
  }

  /**
   * Create a live connection (not supported for OpenAI)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error("Live/streaming connections not supported for OpenAI in this implementation");
  }
}

// ============================================================================
// Register OpenAI LLM with ADK
// ============================================================================

/**
 * Register OpenAI LLM with the ADK LLM Registry
 */
export function registerOpenAILlm(): void {
  LLMRegistry.register(OpenAILlm);
}
