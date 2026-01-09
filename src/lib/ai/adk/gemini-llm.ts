/**
 * Google Gemini LLM Provider for Google ADK
 *
 * This module provides a Gemini implementation of the BaseLlm interface,
 * allowing the use of Gemini models (gemini-2.5-flash, gemini-3-pro, etc.) with ADK.
 */

import { GoogleGenAI, type Content, type Part, type Tool, type FunctionDeclaration, type GenerateContentConfig } from "@google/genai";

import {
  BaseLlm,
  type LlmRequest,
  type LlmResponse,
  LLMRegistry,
  type BaseLlmConnection,
} from "@google/adk";

// ============================================================================
// Type Definitions
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

// ============================================================================
// Content Conversion Utilities
// ============================================================================

/**
 * Convert ADK Content to Gemini Content format
 */
function convertToGeminiContents(contents: unknown[]): Content[] {
  return contents.map((content) => {
    const c = content as { role?: string; parts?: unknown[] };
    return {
      role: c.role === "model" ? "model" : "user",
      parts: (c.parts || []).map((part) => {
        const p = part as LocalPart;
        if (p.text) {
          return { text: p.text };
        }
        if (p.functionCall) {
          return {
            functionCall: {
              name: p.functionCall.name,
              args: p.functionCall.args || {},
            },
          };
        }
        if (p.functionResponse) {
          return {
            functionResponse: {
              name: p.functionResponse.name,
              response: p.functionResponse.response || {},
            },
          };
        }
        return { text: "" };
      }) as Part[],
    };
  });
}

/**
 * Convert ADK tools dict to Gemini tools format
 */
function convertToolsToGemini(toolsDict: Record<string, unknown>): Tool[] {
  const functionDeclarations: FunctionDeclaration[] = [];

  for (const [, tool] of Object.entries(toolsDict)) {
    const adkTool = tool as { _getDeclaration?: () => { name: string; description?: string; parameters?: unknown } };
    if (adkTool._getDeclaration) {
      const declaration = adkTool._getDeclaration();
      functionDeclarations.push({
        name: declaration.name,
        description: declaration.description,
        parameters: declaration.parameters as FunctionDeclaration["parameters"],
      });
    }
  }

  if (functionDeclarations.length === 0) {
    return [];
  }

  return [{ functionDeclarations }];
}

/**
 * Extract system instruction from config
 */
function extractSystemInstruction(config?: LlmRequest["config"]): string | undefined {
  if (!config?.systemInstruction) return undefined;

  if (typeof config.systemInstruction === "string") {
    return config.systemInstruction;
  }

  if (typeof config.systemInstruction === "object" && "parts" in config.systemInstruction) {
    const content = config.systemInstruction as { parts?: Array<{ text?: string }> };
    return content.parts
      ?.filter((p): p is { text: string } => typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  }

  return undefined;
}

/**
 * Build LlmResponse from Gemini response parts
 */
function buildLlmResponse(
  parts: LocalPart[],
  partial: boolean,
  turnComplete: boolean,
  finishReason?: string,
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
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
          promptTokenCount: usage.promptTokenCount || 0,
          candidatesTokenCount: usage.candidatesTokenCount || 0,
          totalTokenCount: usage.totalTokenCount || 0,
        }
      : undefined,
    finishReason: finishReason as LlmResponse["finishReason"],
  };
}

// ============================================================================
// Gemini LLM Class
// ============================================================================

/**
 * Gemini LLM implementation for ADK
 */
export class GeminiLlm extends BaseLlm {
  private client: GoogleGenAI;

  /**
   * Supported Gemini models
   */
  static readonly supportedModels: Array<string | RegExp> = [
    /^gemini-.*/,
  ];

  constructor({ model }: { model: string }) {
    super({ model });

    // Initialize Gemini client
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required for Gemini models");
    }

    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate content using Gemini
   */
  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream: boolean = false
  ): AsyncGenerator<LlmResponse, void> {
    try {
      // Extract configuration
      const systemInstruction = extractSystemInstruction(llmRequest.config);
      const temperature = llmRequest.config?.temperature ?? 0.7;
      const maxTokens = llmRequest.config?.maxOutputTokens ?? 4096;
      const topP = llmRequest.config?.topP ?? 1;
      const topK = llmRequest.config?.topK;

      // Convert contents and tools
      const contents = convertToGeminiContents(llmRequest.contents as unknown[]);
      const tools = convertToolsToGemini(llmRequest.toolsDict);

      // Build generation config (systemInstruction and tools go inside config)
      const generationConfig: GenerateContentConfig = {
        temperature,
        maxOutputTokens: maxTokens,
        topP,
        systemInstruction: systemInstruction || undefined,
        tools: tools.length > 0 ? tools : undefined,
      };

      // Add topK if specified (Gemini-specific)
      if (topK !== undefined) {
        generationConfig.topK = topK;
      }

      if (stream) {
        // Streaming mode
        const streamResult = await this.client.models.generateContentStream({
          model: this.model,
          contents,
          config: generationConfig,
        });

        let accumulatedText = "";
        const accumulatedFunctionCalls: LocalFunctionCall[] = [];

        for await (const chunk of streamResult) {
          const candidate = chunk.candidates?.[0];
          if (!candidate?.content?.parts) continue;

          for (const part of candidate.content.parts) {
            if (part.text) {
              accumulatedText += part.text;
              yield buildLlmResponse(
                [{ text: part.text }],
                true,
                false
              );
            }

            if (part.functionCall) {
              accumulatedFunctionCalls.push({
                id: `call_${Date.now()}_${accumulatedFunctionCalls.length}`,
                name: part.functionCall.name || "",
                args: (part.functionCall.args as Record<string, unknown>) || {},
              });
            }
          }

          // Check for finish reason
          if (candidate.finishReason) {
            const parts: LocalPart[] = [];

            if (accumulatedText) {
              parts.push({ text: accumulatedText });
            }

            for (const fc of accumulatedFunctionCalls) {
              parts.push({ functionCall: fc });
            }

            const geminiFinishReason = mapGeminiFinishReason(candidate.finishReason);

            yield buildLlmResponse(
              parts,
              false,
              candidate.finishReason === "STOP",
              geminiFinishReason,
              chunk.usageMetadata
            );
          }
        }
      } else {
        // Non-streaming mode
        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config: generationConfig,
        });

        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) {
          yield {
            errorCode: "NO_RESPONSE",
            errorMessage: "No response from Gemini",
          };
          return;
        }

        const parts: LocalPart[] = [];

        for (const part of candidate.content.parts) {
          if (part.text) {
            parts.push({ text: part.text });
          }

          if (part.functionCall) {
            parts.push({
              functionCall: {
                id: `call_${Date.now()}`,
                name: part.functionCall.name || "",
                args: (part.functionCall.args as Record<string, unknown>) || {},
              },
            });
          }
        }

        const geminiFinishReason = mapGeminiFinishReason(candidate.finishReason);

        yield buildLlmResponse(
          parts,
          false,
          candidate.finishReason === "STOP",
          geminiFinishReason,
          response.usageMetadata
        );
      }
    } catch (error) {
      yield {
        errorCode: "GEMINI_ERROR",
        errorMessage: error instanceof Error ? error.message : "Gemini API error",
      };
    }
  }

  /**
   * Create a live connection (not supported for Gemini in this implementation)
   */
  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error("Live/streaming connections not supported for Gemini in this implementation");
  }
}

/**
 * Map Gemini finish reason to ADK format
 */
function mapGeminiFinishReason(finishReason?: string): string | undefined {
  if (!finishReason) return undefined;

  switch (finishReason) {
    case "STOP":
      return "STOP";
    case "MAX_TOKENS":
      return "MAX_TOKENS";
    case "SAFETY":
      return "SAFETY";
    case "RECITATION":
      return "RECITATION";
    case "OTHER":
    default:
      return "OTHER";
  }
}

// ============================================================================
// Register Gemini LLM with ADK
// ============================================================================

/**
 * Register Gemini LLM with the ADK LLM Registry
 */
export function registerGeminiLlm(): void {
  LLMRegistry.register(GeminiLlm);
}
