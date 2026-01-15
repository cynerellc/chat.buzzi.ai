/**
 * Google Gemini Live API Provider
 *
 * Implements CallExecutor for Google Gemini Live API
 * Handles real-time audio streaming with:
 * - SDK-based connection to Gemini Live API
 * - Automatic VAD (Voice Activity Detection)
 * - Interruption handling
 * - Audio transcription (input and output)
 * - Tool/function calling
 *
 * Key Differences from OpenAI:
 * - Audio Input: 16kHz PCM16 (vs 24kHz for OpenAI)
 * - Audio Output: 24kHz PCM16 (same as OpenAI)
 * - SDK: Uses @google/genai with ai.live.connect() vs raw WebSocket
 * - VAD: Sensitivity levels (LOW/MEDIUM/HIGH) vs threshold (0.0-1.0)
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/services/gemini.js
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { CallExecutor } from "../call-executor";
import type { ExecutorConfig, TranscriptData, VoiceConfig } from "../../types";

// ============================================================================
// Type Definitions for Gemini Live API
// ============================================================================

/**
 * Gemini Live Session type (SDK types may be incomplete)
 */
interface GeminiLiveSession {
  sendRealtimeInput(input: { audio?: { data: string }; media?: { chunks?: Array<{ data: string; mimeType: string }> } }): void;
  sendToolResponse(response: { functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }> }): Promise<void>;
  sendClientContent(content: { turns: Array<{ role: string; parts: Array<{ text: string }> }> }): Promise<void>;
  close(): void;
}

/**
 * Gemini Live Config type
 */
interface GeminiLiveConfig {
  responseModalities: Modality[];
  systemInstruction: string;
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: string;
      };
    };
  };
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  tools: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: boolean;
      startOfSpeechSensitivity: string;
      endOfSpeechSensitivity: string;
      prefixPaddingMs: number;
      silenceDurationMs: number;
    };
  };
}

// ============================================================================
// Gemini VAD Sensitivity Mapping
// ============================================================================

type GeminiVadSensitivity = "START_SENSITIVITY_LOW" | "START_SENSITIVITY_MEDIUM" | "START_SENSITIVITY_HIGH";
type GeminiEndSensitivity = "END_SENSITIVITY_LOW" | "END_SENSITIVITY_MEDIUM" | "END_SENSITIVITY_HIGH";

/**
 * Map VAD threshold (0.0-1.0) to Gemini sensitivity levels
 */
function mapVadThresholdToSensitivity(threshold: number): GeminiVadSensitivity {
  if (threshold <= 0.3) return "START_SENSITIVITY_HIGH";
  if (threshold <= 0.6) return "START_SENSITIVITY_MEDIUM";
  return "START_SENSITIVITY_LOW";
}

/**
 * Map VAD sensitivity string to Gemini format
 */
function mapVadSensitivity(sensitivity: string | undefined): GeminiVadSensitivity {
  switch (sensitivity?.toUpperCase()) {
    case "LOW":
      return "START_SENSITIVITY_LOW";
    case "HIGH":
      return "START_SENSITIVITY_HIGH";
    case "MEDIUM":
    default:
      return "START_SENSITIVITY_MEDIUM";
  }
}

function mapEndSensitivity(sensitivity: string | undefined): GeminiEndSensitivity {
  switch (sensitivity?.toUpperCase()) {
    case "LOW":
      return "END_SENSITIVITY_LOW";
    case "HIGH":
      return "END_SENSITIVITY_HIGH";
    case "MEDIUM":
    default:
      return "END_SENSITIVITY_MEDIUM";
  }
}

// ============================================================================
// Gemini Live Executor
// ============================================================================

export class GeminiLiveExecutor extends CallExecutor {
  private client: GoogleGenAI | null = null;
  private session: GeminiLiveSession | null = null;
  private sessionId: string | null = null;
  private lastInterruptionTime: number | null = null;
  private interruptionCount: number = 0;

  constructor(config: ExecutorConfig) {
    super(config);
  }

  /**
   * Connect to Gemini Live API
   */
  async connect(): Promise<void> {
    try {
      // Get Gemini API key from environment
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY environment variable not set");
      }

      // Initialize Gemini client
      this.client = new GoogleGenAI({ apiKey });

      // Generate session ID
      this.sessionId = `gemini-${this.chatbotId}-${Date.now()}`;

      // Get voice configuration
      const voiceConfig = this.voiceConfig as VoiceConfig;

      // Determine VAD sensitivity
      let startSensitivity: GeminiVadSensitivity;
      if (voiceConfig.vad_sensitivity) {
        startSensitivity = mapVadSensitivity(voiceConfig.vad_sensitivity);
      } else if (voiceConfig.vad_threshold !== undefined) {
        startSensitivity = mapVadThresholdToSensitivity(voiceConfig.vad_threshold);
      } else {
        startSensitivity = "START_SENSITIVITY_MEDIUM";
      }

      const endSensitivity = mapEndSensitivity(voiceConfig.vad_sensitivity);

      // Get model from voice config or use default
      const model = voiceConfig.gemini_model || "gemini-2.0-flash-live-001";

      console.log(`[GeminiLive] Connecting to Gemini Live API (chatbot: ${this.chatbotId}, model: ${model})`);

      // Configure session
      const sessionConfig = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.systemPrompt,
        // Voice configuration
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceConfig.gemini_voice || "Kore",
            },
          },
        },
        // Enable input and output transcription
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Tools/Functions (if any)
        tools: this.buildGeminiTools(),
        // Automatic VAD configuration
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: startSensitivity,
            endOfSpeechSensitivity: endSensitivity,
            prefixPaddingMs: voiceConfig.prefix_padding_ms || 300,
            silenceDurationMs: voiceConfig.silence_duration_ms || 700,
          },
        },
      };

      // Connect to Gemini Live API
      // Cast to handle SDK type incompatibilities
      this.session = await this.client.live.connect({
        model,
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            console.log(`[GeminiLive] Connected to Gemini Live API (chatbot: ${this.chatbotId}, session: ${this.sessionId})`);

            // Send greeting if configured (after a small delay to ensure session is ready)
            setTimeout(() => this.sendGreetingIfConfigured(), 500);
          },
          onmessage: (message: unknown) => {
            this.handleMessage(message as Record<string, unknown>);
          },
          onerror: (error: unknown) => {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error(`[GeminiLive] Connection error (chatbot: ${this.chatbotId}):`, err);
            this.isConnected = false;
            this.emitError(err);
          },
          onclose: (event: unknown) => {
            const closeEvent = event as { reason?: string; code?: number; wasClean?: boolean };
            console.log(`[GeminiLive] Connection closed (chatbot: ${this.chatbotId}, reason: ${closeEvent.reason || "unknown"})`);
            this.isConnected = false;
            this.emitConnectionClosed();
          },
        },
        config: sessionConfig,
      } as Parameters<typeof this.client.live.connect>[0]) as unknown as GeminiLiveSession;

      console.log(`[GeminiLive] Session created successfully (chatbot: ${this.chatbotId})`);
    } catch (error) {
      console.error(`[GeminiLive] Failed to connect:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from Gemini Live API
   */
  async disconnect(): Promise<void> {
    if (this.session) {
      this.isConnected = false;
      this.session.close();
      this.session = null;
      console.log(`[GeminiLive] Connection closed (chatbot: ${this.chatbotId})`);
    }
  }

  /**
   * Send audio data to Gemini
   * IMPORTANT: Gemini expects 16kHz audio (not 24kHz like OpenAI)
   * @param audioBuffer PCM16 audio buffer at 16kHz
   */
  async sendAudio(audioBuffer: Buffer): Promise<void> {
    if (!this.isConnected || !this.session) {
      console.warn(`[GeminiLive] Cannot send audio: not connected (chatbot: ${this.chatbotId})`);
      return;
    }

    // Validate audio data
    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn(`[GeminiLive] Skipping empty audio data (chatbot: ${this.chatbotId})`);
      return;
    }

    try {
      // Convert buffer to base64
      const base64Audio = audioBuffer.toString("base64");

      // Gemini expects 16kHz PCM16 audio
      this.session.sendRealtimeInput({
        media: {
          chunks: [{
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000",
          }],
        },
      });
    } catch (error) {
      console.error(`[GeminiLive] Failed to send audio:`, error);
    }
  }

  /**
   * Cancel current response (for interruption handling)
   * Gemini handles interruption automatically via VAD, but we track state
   */
  async cancelResponse(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    // Reset speaking state
    this.isSpeaking = false;

    console.log(`[GeminiLive] Response cancelled (chatbot: ${this.chatbotId})`);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build tools/functions in Gemini format
   */
  private buildGeminiTools(): Array<{ functionDeclarations: Array<Record<string, unknown>> }> {
    if (!this.tools || this.tools.length === 0) {
      return [];
    }

    // Convert OpenAI-style tools to Gemini format
    const functionDeclarations: Record<string, unknown>[] = this.tools.map((tool) => {
      const typedTool = tool as { type?: string; function?: { name?: string; description?: string; parameters?: unknown } };
      if (typedTool.type === "function" && typedTool.function) {
        return {
          name: typedTool.function.name,
          description: typedTool.function.description,
          parameters: typedTool.function.parameters,
        };
      }
      return tool as Record<string, unknown>;
    });

    return [{ functionDeclarations }];
  }

  /**
   * Handle incoming messages from Gemini
   */
  private handleMessage(message: Record<string, unknown>): void {
    try {
      // Gemini messages have different structure than OpenAI
      // Audio is in: serverContent.modelTurn.parts[].inlineData.data

      const serverContent = message.serverContent as {
        modelTurn?: {
          parts?: Array<{
            inlineData?: {
              data?: string;
              mimeType?: string;
            };
          }>;
        };
        turnComplete?: boolean;
        interrupted?: boolean;
        inputTranscription?: {
          text?: string;
        };
        outputTranscription?: {
          text?: string;
        };
        toolCall?: {
          name?: string;
          args?: Record<string, unknown>;
        };
      } | undefined;

      if (serverContent?.modelTurn?.parts) {
        for (const part of serverContent.modelTurn.parts) {
          if (part.inlineData?.data && part.inlineData?.mimeType?.includes("audio")) {
            // Decode base64 audio
            const audioBuffer = Buffer.from(part.inlineData.data, "base64");
            this.emitAudioDelta(audioBuffer);

            // Track that agent is speaking
            if (!this.isSpeaking) {
              this.isSpeaking = true;
              this.emitAgentSpeaking();
            }
          }
        }
      }

      if (serverContent) {
        const { turnComplete, interrupted, inputTranscription, outputTranscription, toolCall } = serverContent;

        // Handle input transcription (user speech)
        if (inputTranscription?.text) {
          const transcriptData: TranscriptData = {
            role: "user",
            content: inputTranscription.text,
            timestamp: Date.now(),
            isFinal: true,
          };
          this.emitTranscriptDelta(transcriptData);
        }

        // Handle output transcription (agent speech)
        if (outputTranscription?.text) {
          const transcriptData: TranscriptData = {
            role: "assistant",
            content: outputTranscription.text,
            timestamp: Date.now(),
            isFinal: !!turnComplete,
          };
          this.emitTranscriptDelta(transcriptData);
        }

        // Handle turn completion
        if (turnComplete) {
          this.isSpeaking = false;
          this.emitAgentListening();
          this.emitTurnComplete();
        }

        // Handle interruption
        if (interrupted) {
          const now = Date.now();
          const debounceMs = 100;

          if (!this.lastInterruptionTime || now - this.lastInterruptionTime > debounceMs) {
            this.lastInterruptionTime = now;
            this.interruptionCount++;

            console.log(
              `[GeminiLive] User interruption detected (count: ${this.interruptionCount}, chatbot: ${this.chatbotId})`
            );

            this.isSpeaking = false;
            this.emitAgentListening();
            this.emitUserInterrupted();
          }
        }

        // Handle tool/function calls
        if (toolCall) {
          this.handleFunctionCall(toolCall);
        }
      }
    } catch (error) {
      console.error(`[GeminiLive] Error handling message:`, error);
      this.emitError(error instanceof Error ? error : new Error("Failed to handle Gemini message"));
    }
  }

  /**
   * Handle function calls from Gemini
   */
  private async handleFunctionCall(toolCall: { name?: string; args?: Record<string, unknown> }): Promise<void> {
    const functionName = toolCall.name;
    const args = toolCall.args || {};

    console.log(`[GeminiLive] Function call received (chatbot: ${this.chatbotId}):`, {
      name: functionName,
      args,
    });

    // Emit function call event for external handling
    this.emitFunctionCall({
      name: functionName || "unknown",
      arguments: args,
    });

    // Note: Function results should be sent back via sendFunctionResult()
  }

  /**
   * Send greeting message if configured
   * This triggers the AI to speak the greeting as the first message
   */
  private async sendGreetingIfConfigured(): Promise<void> {
    const voiceConfig = this.voiceConfig as VoiceConfig;
    const greeting = voiceConfig.call_greeting;

    if (!greeting || greeting.trim().length === 0) {
      console.log(`[GeminiLive] No greeting configured, waiting for user to speak first`);
      return;
    }

    if (!this.isConnected || !this.session) {
      console.warn(`[GeminiLive] Cannot send greeting: not connected`);
      return;
    }

    console.log(`[GeminiLive] Sending configured greeting (chatbot: ${this.chatbotId})`);

    try {
      // Send a prompt that will make the AI speak the greeting
      // We use a system-like prompt that instructs the AI to say the greeting exactly
      await this.session.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [
              {
                text: `[SYSTEM: The call has just started. Greet the caller by saying exactly: "${greeting}"]`,
              },
            ],
          },
        ],
        turnComplete: true,
      } as Parameters<typeof this.session.sendClientContent>[0]);

      console.log(`[GeminiLive] Greeting prompt sent (chatbot: ${this.chatbotId})`);
    } catch (error) {
      console.error(`[GeminiLive] Failed to send greeting:`, error);
    }
  }

  /**
   * Send function result back to Gemini
   */
  async sendFunctionResult(functionName: string, result: Record<string, unknown>): Promise<void> {
    if (!this.isConnected || !this.session) {
      console.warn(`[GeminiLive] Cannot send function result: not connected`);
      return;
    }

    try {
      // Gemini handles function responses as client content
      await this.session.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [
              {
                text: `Function ${functionName} result: ${JSON.stringify(result)}`,
              },
            ],
          },
        ],
        turnComplete: true,
      } as Parameters<typeof this.session.sendClientContent>[0]);

      console.log(`[GeminiLive] Function result sent (chatbot: ${this.chatbotId}, function: ${functionName})`);
    } catch (error) {
      console.error(`[GeminiLive] Failed to send function result:`, error);
    }
  }

  /**
   * Send text message to Gemini (for testing or initial greeting)
   */
  async sendText(text: string): Promise<void> {
    if (!this.isConnected || !this.session) {
      console.warn(`[GeminiLive] Cannot send text: not connected`);
      return;
    }

    try {
      await this.session.sendClientContent({
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      } as Parameters<typeof this.session.sendClientContent>[0]);

      console.log(`[GeminiLive] Text sent (chatbot: ${this.chatbotId})`);
    } catch (error) {
      console.error(`[GeminiLive] Failed to send text:`, error);
    }
  }
}

/**
 * Factory function to create Gemini Live executor
 */
export function createGeminiLiveExecutor(config: ExecutorConfig): GeminiLiveExecutor {
  return new GeminiLiveExecutor(config);
}
