/**
 * OpenAI Realtime API Provider
 *
 * Implements CallExecutor for OpenAI Realtime API (GPT-4 Realtime)
 * Handles real-time audio streaming with:
 * - WebSocket connection to OpenAI
 * - Server-side VAD (Voice Activity Detection)
 * - Interruption handling
 * - Audio transcription
 * - Tool/function calling
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/services/openai.js
 */

import WebSocket from "ws";
import { CallExecutor } from "../call-executor";
import type { ExecutorConfig, TranscriptData, VoiceConfig, RegisteredToolRef } from "../../types";
import { getBuiltInTool } from "@/lib/ai/tools/built-in";
import type { AgentContext } from "@/lib/ai/types";

// ============================================================================
// OpenAI Realtime API Events
// ============================================================================

const OPENAI_EVENTS = {
  // Session events
  SESSION_UPDATE: "session.update",
  SESSION_CREATED: "session.created",
  SESSION_UPDATED: "session.updated",

  // Response events
  RESPONSE_CREATE: "response.create",
  RESPONSE_CREATED: "response.created",
  RESPONSE_DONE: "response.done",
  RESPONSE_CANCEL: "response.cancel",

  // Audio events
  RESPONSE_AUDIO_DELTA: "response.audio.delta",
  RESPONSE_AUDIO_DONE: "response.audio.done",

  // Transcript events
  RESPONSE_AUDIO_TRANSCRIPT_DELTA: "response.audio_transcript.delta",
  RESPONSE_AUDIO_TRANSCRIPT_DONE: "response.audio_transcript.done",

  // Input audio events
  INPUT_AUDIO_BUFFER_APPEND: "input_audio_buffer.append",
  INPUT_AUDIO_BUFFER_COMMIT: "input_audio_buffer.commit",
  INPUT_AUDIO_BUFFER_CLEAR: "input_audio_buffer.clear",
  INPUT_AUDIO_BUFFER_SPEECH_STARTED: "input_audio_buffer.speech_started",
  INPUT_AUDIO_BUFFER_SPEECH_STOPPED: "input_audio_buffer.speech_stopped",

  // Function call events
  RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE: "response.function_call_arguments.done",
  CONVERSATION_ITEM_CREATE: "conversation.item.create",

  // Error events
  ERROR: "error",
} as const;

// ============================================================================
// OpenAI Realtime Executor
// ============================================================================

export class OpenAIRealtimeExecutor extends CallExecutor {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private currentResponseId: string | null = null;
  private lastInterruptionTime: number | null = null;
  private interruptionCount: number = 0;
  private isCancelling: boolean = false;
  private lastCancellationTime: number | null = null;
  private registeredToolsMap: Map<string, RegisteredToolRef> = new Map();

  constructor(config: ExecutorConfig) {
    super(config);
    // Build a lookup map for registered tools (includes built-in + custom package tools)
    if (config.registeredTools) {
      for (const tool of config.registeredTools) {
        this.registeredToolsMap.set(tool.name, tool);
      }
      console.log(`[OpenAIRealtime] Loaded ${this.registeredToolsMap.size} tools: ${Array.from(this.registeredToolsMap.keys()).join(", ")}`);
    }
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Get OpenAI API key from environment
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error("OPENAI_API_KEY environment variable not set");
        }

        // Get model from voice config or use default
        // Note: Using latest available realtime model
        const model = this.voiceConfig.openai_model || "gpt-4o-realtime-preview-2024-12-17";
        const url = `wss://api.openai.com/v1/realtime?model=${model}`;

        console.log(`[OpenAIRealtime] Connecting to model: ${model} (chatbot: ${this.chatbotId})`);
        console.log(`[OpenAIRealtime] VoiceConfig:`, JSON.stringify(this.voiceConfig, null, 2));

        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "OpenAI-Beta": "realtime=v1",
          },
        });

        this.ws.on("open", () => {
          console.log(`[OpenAIRealtime] Connected to OpenAI Realtime API (chatbot: ${this.chatbotId})`);
          this.isConnected = true;

          // Send session configuration
          this.sendSessionUpdate();

          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on("error", (error) => {
          console.error(`[OpenAIRealtime] WebSocket error (chatbot: ${this.chatbotId}):`, error);
          this.isConnected = false;
          this.emitError(new Error(`WebSocket error: ${error.message}`));
        });

        this.ws.on("close", () => {
          console.log(`[OpenAIRealtime] Disconnected from OpenAI Realtime API (chatbot: ${this.chatbotId})`);
          this.isConnected = false;
          this.emitConnectionClosed();
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("Connection timeout"));
          }
        }, 10000);
      } catch (error) {
        console.error(`[OpenAIRealtime] Failed to connect:`, error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from OpenAI Realtime API
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
      console.log(`[OpenAIRealtime] Connection closed (chatbot: ${this.chatbotId})`);
    }
  }

  /**
   * Send audio data to OpenAI
   * @param audioBuffer PCM16 audio buffer
   */
  async sendAudio(audioBuffer: Buffer): Promise<void> {
    if (!this.isConnected) {
      console.warn(`[OpenAIRealtime] Cannot send audio: not connected (chatbot: ${this.chatbotId})`);
      return;
    }

    // Convert buffer to base64
    const base64Audio = audioBuffer.toString("base64");

    this.send({
      type: OPENAI_EVENTS.INPUT_AUDIO_BUFFER_APPEND,
      audio: base64Audio,
    });
  }

  /**
   * Cancel current response (for interruption handling)
   */
  async cancelResponse(): Promise<void> {
    if (!this.isConnected || !this.currentResponseId) {
      return;
    }

    try {
      // Set cancellation flag to suppress related errors
      this.isCancelling = true;
      this.lastCancellationTime = Date.now();

      // Send cancel command to OpenAI
      this.send({
        type: OPENAI_EVENTS.RESPONSE_CANCEL,
      });

      console.log(`[OpenAIRealtime] Response cancellation sent (chatbot: ${this.chatbotId})`);

      // Reset speaking state
      this.isSpeaking = false;
      this.currentResponseId = null;

      // Clear cancellation flag after 1 second (to catch any delayed errors)
      setTimeout(() => {
        this.isCancelling = false;
      }, 1000);
    } catch (error) {
      console.error(`[OpenAIRealtime] Error cancelling response:`, error);
      this.isCancelling = false;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Send session configuration to OpenAI
   */
  private sendSessionUpdate(): void {
    const voiceConfig = this.voiceConfig as VoiceConfig;

    const sessionConfig = {
      type: OPENAI_EVENTS.SESSION_UPDATE,
      session: {
        modalities: ["text", "audio"],
        instructions: this.systemPrompt,
        voice: voiceConfig.openai_voice || "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: voiceConfig.vad_threshold || 0.5,
          prefix_padding_ms: voiceConfig.prefix_padding_ms || 300,
          silence_duration_ms: voiceConfig.silence_duration_ms || 700,
        },
        tools: this.tools, // Tools configured from chatbot
        tool_choice: "auto",
        temperature: 0.8,
        max_response_output_tokens: 4096,
      },
    };

    console.log(`[OpenAIRealtime] Session configuration (chatbot: ${this.chatbotId}):`, {
      voice: sessionConfig.session.voice,
      modalities: sessionConfig.session.modalities,
      inputFormat: sessionConfig.session.input_audio_format,
      outputFormat: sessionConfig.session.output_audio_format,
      vadThreshold: sessionConfig.session.turn_detection.threshold,
      instructionsLength: this.systemPrompt?.length || 0,
    });

    this.send(sessionConfig);
    console.log(`[OpenAIRealtime] Session configuration sent (chatbot: ${this.chatbotId})`);
  }

  /**
   * Handle incoming messages from OpenAI
   */
  private handleMessage(data: WebSocket.Data): void {
    let message: Record<string, unknown>;
    let eventType: string;

    try {
      message = JSON.parse(data.toString()) as Record<string, unknown>;
      eventType = message.type as string;

      // Log all events except delta events (too frequent)
      if (
        eventType !== OPENAI_EVENTS.RESPONSE_AUDIO_DELTA &&
        eventType !== OPENAI_EVENTS.RESPONSE_AUDIO_TRANSCRIPT_DELTA
      ) {
        console.debug(`[OpenAIRealtime] Event: ${eventType} (chatbot: ${this.chatbotId})`);
      }

      switch (eventType) {
        case OPENAI_EVENTS.SESSION_CREATED:
          this.sessionId = (message.session as { id?: string } | undefined)?.id || null;
          console.log(`[OpenAIRealtime] Session created: ${this.sessionId}`);

          // Send greeting if configured
          this.sendGreetingIfConfigured();
          break;

        case OPENAI_EVENTS.SESSION_UPDATED: {
          const session = message.session as {
            modalities?: string[];
            voice?: string;
            output_audio_format?: string;
            turn_detection?: { type?: string };
          } | undefined;

          console.log(`[OpenAIRealtime] Session updated (chatbot: ${this.chatbotId}):`, {
            modalities: session?.modalities,
            voice: session?.voice,
            outputFormat: session?.output_audio_format,
            turnDetectionType: session?.turn_detection?.type,
          });
          break;
        }

        case OPENAI_EVENTS.RESPONSE_CREATED: {
          const response = message.response as {
            id?: string;
            status?: string;
            output?: Array<{ type?: string }>;
          } | undefined;

          console.log(`[OpenAIRealtime] Response created (chatbot: ${this.chatbotId}):`, {
            id: response?.id,
            status: response?.status,
            outputTypes: response?.output?.map(o => o.type),
          });

          this.currentResponseId = response?.id || null;
          this.emitAgentSpeaking();
          break;
        }

        case OPENAI_EVENTS.RESPONSE_AUDIO_DELTA:
          if (message.delta) {
            // Decode base64 audio
            const audioBuffer = Buffer.from(message.delta as string, "base64");
            this.emitAudioDelta(audioBuffer);
          }
          break;

        case OPENAI_EVENTS.RESPONSE_DONE: {
          const response = message.response as {
            id?: string;
            status?: string;
            status_details?: { type?: string; error?: { message?: string } };
            output?: Array<{ type?: string; content?: unknown[] }>;
          } | undefined;

          console.log(`[OpenAIRealtime] Response done (chatbot: ${this.chatbotId}):`, {
            id: response?.id,
            status: response?.status,
            statusDetails: response?.status_details,
            outputCount: response?.output?.length || 0,
            outputTypes: response?.output?.map(o => o.type),
          });

          // Check for errors in response
          if (response?.status === "failed") {
            console.error(`[OpenAIRealtime] Response failed:`, response.status_details);
          }

          this.currentResponseId = null;
          this.emitAgentListening();
          this.emitTurnComplete();
          break;
        }

        case OPENAI_EVENTS.RESPONSE_AUDIO_TRANSCRIPT_DELTA:
          if (message.delta) {
            const transcriptData: TranscriptData = {
              role: "assistant",
              content: message.delta as string,
              timestamp: Date.now(),
              isFinal: false,
            };
            this.emitTranscriptDelta(transcriptData);
          }
          break;

        case OPENAI_EVENTS.RESPONSE_AUDIO_TRANSCRIPT_DONE:
          if (message.transcript) {
            const transcriptData: TranscriptData = {
              role: "assistant",
              content: message.transcript as string,
              timestamp: Date.now(),
              isFinal: true,
            };
            this.emitTranscriptDelta(transcriptData);
          }
          break;

        case OPENAI_EVENTS.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE: {
          const functionName = message.name as string;
          const functionArgs = message.arguments as string;
          const callId = message.call_id as string;

          console.log(`[OpenAIRealtime] Function call (chatbot: ${this.chatbotId}):`, {
            name: functionName,
            callId,
            arguments: functionArgs,
          });

          // Execute the function call
          void this.handleFunctionCall(functionName, functionArgs, callId);
          break;
        }

        case OPENAI_EVENTS.ERROR: {
          // Filter out cancellation-related errors
          if (this.isCancelling) {
            console.debug(`[OpenAIRealtime] Error during cancellation (suppressed)`);
            return;
          }

          // Check if error occurred shortly after cancellation
          if (this.lastCancellationTime && Date.now() - this.lastCancellationTime < 1000) {
            console.debug(`[OpenAIRealtime] Error shortly after cancellation (suppressed)`);
            return;
          }

          const error = message.error as { message?: string } | undefined;
          console.error(`[OpenAIRealtime] API error:`, error);
          this.emitError(new Error(error?.message || "OpenAI API error"));
          break;
        }

        case OPENAI_EVENTS.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
          // Detect interruption: user started speaking while agent is still speaking
          if (this.isSpeaking) {
            // Check debounce: prevent rapid successive interruptions
            const now = Date.now();
            const debounceMs = 100;

            if (!this.lastInterruptionTime || now - this.lastInterruptionTime > debounceMs) {
              this.lastInterruptionTime = now;
              this.interruptionCount++;

              console.log(
                `[OpenAIRealtime] User interruption detected (count: ${this.interruptionCount}, chatbot: ${this.chatbotId})`
              );

              // Cancel current agent response
              void this.cancelResponse();

              // Emit interruption event
              this.emitUserInterrupted();
            }
          }
          break;

        case OPENAI_EVENTS.INPUT_AUDIO_BUFFER_SPEECH_STOPPED:
          console.debug(`[OpenAIRealtime] User stopped speaking`);
          break;

        default:
          console.debug(`[OpenAIRealtime] Unhandled event: ${eventType}`);
      }
    } catch (error) {
      console.error(`[OpenAIRealtime] Error handling message:`, error);
      this.emitError(
        error instanceof Error ? error : new Error("Failed to handle OpenAI message")
      );
    }
  }

  /**
   * Send greeting message if configured
   * This triggers the AI to speak the greeting as the first message
   */
  private sendGreetingIfConfigured(): void {
    const voiceConfig = this.voiceConfig as VoiceConfig;
    const greeting = voiceConfig.call_greeting;

    if (!greeting || greeting.trim().length === 0) {
      console.log(`[OpenAIRealtime] No greeting configured, waiting for user to speak first`);
      return;
    }

    console.log(`[OpenAIRealtime] Sending configured greeting (chatbot: ${this.chatbotId})`);

    // Create a conversation item with the greeting as the assistant's response
    this.send({
      type: OPENAI_EVENTS.CONVERSATION_ITEM_CREATE,
      item: {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: greeting,
          },
        ],
      },
    });

    // Trigger response to generate audio for the greeting
    this.send({
      type: OPENAI_EVENTS.RESPONSE_CREATE,
      response: {
        modalities: ["text", "audio"],
      },
    });
  }

  /**
   * Handle function call from OpenAI
   * Executes the tool and sends the result back
   */
  private async handleFunctionCall(functionName: string, functionArgs: string, callId: string): Promise<void> {
    console.log(`[OpenAIRealtime] Executing function: ${functionName} (chatbot: ${this.chatbotId})`);

    try {
      // Parse arguments
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(functionArgs);
      } catch {
        console.error(`[OpenAIRealtime] Failed to parse function arguments: ${functionArgs}`);
        args = {};
      }

      // Emit function call event for external handling
      this.emitFunctionCall({
        name: functionName,
        arguments: args,
      });

      // Get the tool from registered tools map (includes built-in + custom package tools)
      // Fall back to built-in tools if not in map (for backwards compatibility)
      const registeredTool = this.registeredToolsMap.get(functionName);
      const tool = registeredTool || getBuiltInTool(functionName);
      if (!tool) {
        console.error(`[OpenAIRealtime] Unknown function: ${functionName} (available: ${Array.from(this.registeredToolsMap.keys()).join(", ")})`);
        this.sendFunctionResult(callId, { error: `Unknown function: ${functionName}` });
        return;
      }

      // Create a context for tool execution
      // Note: Voice calls have a simplified context since they don't have all chat features
      const context: AgentContext = {
        conversationId: `voice-${this.chatbotId}-${Date.now()}`,
        companyId: this.companyId,
        agentId: this.chatbotId,
        requestId: `voice-req-${Date.now()}`,
        message: "", // Voice calls don't have text messages in the same way
        channel: "web",
        variables: {
          get: () => undefined,
          has: () => false,
          keys: () => [],
        },
        securedVariables: {
          get: () => undefined,
          has: () => false,
          keys: () => [],
        },
        timestamp: new Date(),
        // Knowledge base configuration for voice calls
        knowledgeCategories: this.knowledgeCategories,
        knowledgeThreshold: this.knowledgeThreshold,
      };

      // Execute the tool
      const result = await tool.execute(args, context);

      console.log(`[OpenAIRealtime] Function ${functionName} completed:`, {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
      });

      // Log details for search_knowledge results
      if (functionName === "search_knowledge" && result.data) {
        const data = result.data as Record<string, unknown>;
        console.log(`[OpenAIRealtime] search_knowledge result details:`, {
          resultCount: data.resultCount,
          searchTimeMs: data.searchTimeMs,
          contextLength: typeof data.context === "string" ? data.context.length : 0,
          chunksCount: Array.isArray(data.chunks) ? data.chunks.length : 0,
          faqsCount: Array.isArray(data.faqs) ? data.faqs.length : 0,
        });
      }

      // Check if this is an escalation request
      const resultData = result.data as Record<string, unknown> | undefined;
      if (result.success && resultData?.action === "escalate") {
        console.log(`[OpenAIRealtime] Escalation detected (chatbot: ${this.chatbotId}):`, resultData);

        // Emit escalate event for CallRunner to handle
        this.emitEscalate({
          reason: (resultData.reason as string) || "User requested human assistance",
          urgency: (resultData.urgency as string) || "medium",
          summary: resultData.summary as string | undefined,
          conversationId: resultData.conversationId as string | undefined,
        });
      }

      // Send the result back to OpenAI
      this.sendFunctionResult(callId, result);
    } catch (error) {
      console.error(`[OpenAIRealtime] Error executing function ${functionName}:`, error);
      this.sendFunctionResult(callId, {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Send function result back to OpenAI and trigger response
   */
  private sendFunctionResult(callId: string, result: { success?: boolean; data?: unknown; error?: string }): void {
    // Send function call output
    this.send({
      type: OPENAI_EVENTS.CONVERSATION_ITEM_CREATE,
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    });

    // Trigger a response to continue the conversation with the function result
    this.send({
      type: OPENAI_EVENTS.RESPONSE_CREATE,
      response: {
        modalities: ["text", "audio"],
      },
    });
  }

  /**
   * Send message to OpenAI
   */
  private send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

/**
 * Factory function to create OpenAI Realtime executor
 */
export function createOpenAIRealtimeExecutor(config: ExecutorConfig): OpenAIRealtimeExecutor {
  return new OpenAIRealtimeExecutor(config);
}
