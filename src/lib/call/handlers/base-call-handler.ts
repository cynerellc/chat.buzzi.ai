/**
 * Base Call Handler (Abstract)
 *
 * Abstract base class for all call integration handlers.
 * Handlers manage the connection between external call systems (WebSocket, WhatsApp, Twilio)
 * and the CallRunnerService.
 *
 * Each handler is responsible for:
 * - Receiving audio from the external source
 * - Sending audio responses back to the external source
 * - Managing the call lifecycle (start, end)
 * - Emitting events for the CallRunnerService
 */

import { EventEmitter } from "events";
import type { CallHandlerEvents } from "../types";

export abstract class BaseCallHandler extends EventEmitter {
  protected sessionId: string;
  protected callId: string;
  protected isActive: boolean = false;

  constructor(sessionId: string, callId: string) {
    super();
    this.sessionId = sessionId;
    this.callId = callId;
  }

  /**
   * Start the call handler
   * Sets up connections, prepares audio pipelines, etc.
   */
  abstract start(): Promise<void>;

  /**
   * Handle incoming audio data
   * Called when audio is received from the external source
   */
  abstract handleAudio(audioData: Buffer): Promise<void>;

  /**
   * Send audio data to the external destination
   * Called when the AI generates audio response
   */
  abstract sendAudio(audioData: Buffer): Promise<void>;

  /**
   * End the call
   * Clean up connections, resources, etc.
   */
  abstract end(reason?: string): Promise<void>;

  /**
   * Check if handler is active
   */
  isHandlerActive(): boolean {
    return this.isActive;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get call ID
   */
  getCallId(): string {
    return this.callId;
  }

  // ============================================================================
  // Event Emitters (Type-Safe)
  // ============================================================================

  /**
   * Emit audio received event
   */
  protected emitAudioReceived(audioData: Buffer): void {
    this.emit("audioReceived", audioData);
  }

  /**
   * Emit call started event
   */
  protected emitCallStarted(): void {
    this.emit("callStarted");
  }

  /**
   * Emit call ended event
   */
  protected emitCallEnded(reason?: string): void {
    this.emit("callEnded", reason);
  }

  /**
   * Emit error event
   */
  protected emitError(error: Error): void {
    this.emit("error", error);
  }

  // ============================================================================
  // Typed Event Listeners
  // ============================================================================

  on(event: "audioReceived", handler: (data: Buffer) => void): this;
  on(event: "callStarted", handler: () => void): this;
  on(event: "callEnded", handler: (reason?: string) => void): this;
  on(event: "error", handler: (error: Error) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler);
  }

  once(event: "audioReceived", handler: (data: Buffer) => void): this;
  once(event: "callStarted", handler: () => void): this;
  once(event: "callEnded", handler: (reason?: string) => void): this;
  once(event: "error", handler: (error: Error) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, handler: (...args: any[]) => void): this {
    return super.once(event, handler);
  }

  emit(event: "audioReceived", data: Buffer): boolean;
  emit(event: "callStarted"): boolean;
  emit(event: "callEnded", reason?: string): boolean;
  emit(event: "error", error: Error): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * Type guard to check if an object is a BaseCallHandler
 */
export function isCallHandler(obj: unknown): obj is BaseCallHandler {
  return obj instanceof BaseCallHandler;
}
