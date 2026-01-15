/**
 * Call Executor (Abstract Base Class)
 *
 * Abstract base class for AI provider call executors (OpenAI Realtime, Gemini Live).
 * Handles real-time audio streaming with AI models for voice conversations.
 *
 * Providers implement this interface to standardize:
 * - Audio streaming (send/receive)
 * - Turn detection and interruption handling
 * - Transcription
 * - Tool calling (function execution)
 * - Connection lifecycle
 */

import { EventEmitter } from "events";
import type {
  ExecutorConfig,
  VoiceConfig,
  TranscriptData,
  CallAiProvider,
  ExecutorEvents,
} from "../types";

export abstract class CallExecutor extends EventEmitter {
  protected chatbotId: string;
  protected companyId: string;
  protected aiProvider: CallAiProvider;
  protected voiceConfig: VoiceConfig;
  protected systemPrompt: string;
  protected knowledgeCategories: string[];
  protected knowledgeThreshold: number;
  protected tools: unknown[];
  protected isConnected: boolean = false;
  protected isSpeaking: boolean = false;

  constructor(config: ExecutorConfig) {
    super();
    this.chatbotId = config.chatbotId;
    this.companyId = config.companyId;
    this.aiProvider = config.aiProvider;
    this.voiceConfig = config.voiceConfig;
    this.systemPrompt = config.systemPrompt || "You are a helpful AI assistant.";
    this.knowledgeCategories = config.knowledgeCategories || [];
    this.knowledgeThreshold = config.knowledgeThreshold ?? 0.3;
    this.tools = config.tools || [];
  }

  // ============================================================================
  // Abstract Methods (Provider-Specific Implementation)
  // ============================================================================

  /**
   * Establish connection to AI provider
   * Set up WebSocket, configure session, etc.
   */
  abstract connect(): Promise<void>;

  /**
   * Close connection to AI provider
   * Clean up resources, close WebSocket, etc.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Send audio data to AI provider
   * Audio should be in the format expected by the provider (PCM16, Opus, etc.)
   */
  abstract sendAudio(audioBuffer: Buffer): Promise<void>;

  /**
   * Cancel the current AI response
   * Called when user interrupts the agent
   */
  abstract cancelResponse(): Promise<void>;

  // ============================================================================
  // Common Methods
  // ============================================================================

  /**
   * Get connection status
   */
  isExecutorConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get speaking status
   */
  isExecutorSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get chatbot ID
   */
  getChatbotId(): string {
    return this.chatbotId;
  }

  /**
   * Get company ID
   */
  getCompanyId(): string {
    return this.companyId;
  }

  /**
   * Get AI provider
   */
  getAiProvider(): CallAiProvider {
    return this.aiProvider;
  }

  // ============================================================================
  // Event Emitters (Standard Across Providers)
  // ============================================================================

  /**
   * Emit audio delta event
   * Called when AI generates audio chunks
   */
  protected emitAudioDelta(audioData: Buffer): void {
    this.emit("audioDelta", audioData);
  }

  /**
   * Emit transcript delta event
   * Called when transcription is received (partial or final)
   */
  protected emitTranscriptDelta(data: TranscriptData): void {
    this.emit("transcriptDelta", data);
  }

  /**
   * Emit agent speaking event
   * Called when agent starts generating audio response
   */
  protected emitAgentSpeaking(): void {
    this.isSpeaking = true;
    this.emit("agentSpeaking");
  }

  /**
   * Emit agent listening event
   * Called when agent finishes speaking and is ready for user input
   */
  protected emitAgentListening(): void {
    this.isSpeaking = false;
    this.emit("agentListening");
  }

  /**
   * Emit user interrupted event
   * Called when user starts speaking while agent is talking
   */
  protected emitUserInterrupted(): void {
    this.emit("userInterrupted");
  }

  /**
   * Emit turn complete event
   * Called when a conversation turn is finished
   */
  protected emitTurnComplete(): void {
    this.emit("turnComplete");
  }

  /**
   * Emit error event
   */
  protected emitError(error: Error): void {
    this.emit("error", error);
  }

  /**
   * Emit connection closed event
   */
  protected emitConnectionClosed(): void {
    this.isConnected = false;
    this.emit("connectionClosed");
  }

  /**
   * Emit function call event
   * Called when AI requests a function/tool execution
   */
  protected emitFunctionCall(data: { name: string; arguments: Record<string, unknown> }): void {
    this.emit("functionCall", data);
  }

  /**
   * Emit escalate event
   * Called when AI decides to transfer the conversation to a human agent
   */
  protected emitEscalate(data: {
    reason: string;
    urgency: string;
    summary?: string;
    conversationId?: string;
  }): void {
    this.emit("escalate", data);
  }

  // ============================================================================
  // Typed Event Listeners
  // ============================================================================

  on(event: "audioDelta", handler: (data: Buffer) => void): this;
  on(event: "transcriptDelta", handler: (data: TranscriptData) => void): this;
  on(event: "agentSpeaking", handler: () => void): this;
  on(event: "agentListening", handler: () => void): this;
  on(event: "userInterrupted", handler: () => void): this;
  on(event: "turnComplete", handler: () => void): this;
  on(event: "error", handler: (error: Error) => void): this;
  on(event: "connectionClosed", handler: () => void): this;
  on(event: "functionCall", handler: (data: { name: string; arguments: Record<string, unknown> }) => void): this;
  on(event: "escalate", handler: (data: { reason: string; urgency: string; summary?: string; conversationId?: string }) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler);
  }

  once(event: "audioDelta", handler: (data: Buffer) => void): this;
  once(event: "transcriptDelta", handler: (data: TranscriptData) => void): this;
  once(event: "agentSpeaking", handler: () => void): this;
  once(event: "agentListening", handler: () => void): this;
  once(event: "userInterrupted", handler: () => void): this;
  once(event: "turnComplete", handler: () => void): this;
  once(event: "error", handler: (error: Error) => void): this;
  once(event: "connectionClosed", handler: () => void): this;
  once(event: "functionCall", handler: (data: { name: string; arguments: Record<string, unknown> }) => void): this;
  once(event: "escalate", handler: (data: { reason: string; urgency: string; summary?: string; conversationId?: string }) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, handler: (...args: any[]) => void): this {
    return super.once(event, handler);
  }

  emit(event: "audioDelta", data: Buffer): boolean;
  emit(event: "transcriptDelta", data: TranscriptData): boolean;
  emit(event: "agentSpeaking"): boolean;
  emit(event: "agentListening"): boolean;
  emit(event: "userInterrupted"): boolean;
  emit(event: "turnComplete"): boolean;
  emit(event: "error", error: Error): boolean;
  emit(event: "connectionClosed"): boolean;
  emit(event: "functionCall", data: { name: string; arguments: Record<string, unknown> }): boolean;
  emit(event: "escalate", data: { reason: string; urgency: string; summary?: string; conversationId?: string }): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * Type guard to check if an object is a CallExecutor
 */
export function isCallExecutor(obj: unknown): obj is CallExecutor {
  return obj instanceof CallExecutor;
}
