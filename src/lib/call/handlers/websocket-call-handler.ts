/**
 * WebSocket Call Handler
 *
 * Handles web-based voice calls through WebSocket connection.
 * Manages bi-directional audio streaming between browser client and AI provider.
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/handlers/websocket.js
 */

import type WebSocket from "ws";
import { BaseCallHandler } from "./base-call-handler";

// ============================================================================
// WebSocket Events
// ============================================================================

export const WEBSOCKET_EVENTS = {
  // Client → Server
  START_CALL: "start_call",
  AUDIO_DATA: "audio_data",
  END_CALL: "end_call",

  // Server → Client
  STATUS: "status",
  CALL_STARTED: "call_started",
  CALL_ENDED: "call_ended",
  AUDIO_RESPONSE: "audio_response",
  TRANSCRIPT: "transcript",
  AGENT_SPEAKING: "agent_speaking",
  AGENT_LISTENING: "agent_listening",
  STOP_AUDIO: "stop_audio",
  ERROR: "error",
  ESCALATION_STARTED: "escalation_started",
} as const;

// ============================================================================
// WebSocket Message Types
// ============================================================================

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
}

interface StartCallData {
  name?: string;
  email?: string;
}

interface AudioData {
  audio: string; // Base64 encoded PCM16
}

// ============================================================================
// WebSocket Call Handler
// ============================================================================

export class WebSocketCallHandler extends BaseCallHandler {
  private ws: WebSocket;
  private isWsConnected: boolean = false;

  constructor(ws: WebSocket, sessionId: string, callId: string) {
    super(sessionId, callId);
    this.ws = ws;
    this.isWsConnected = true;
  }

  /**
   * Start the handler
   */
  async start(): Promise<void> {
    this.setupWebSocketHandlers();
    this.isActive = true;

    console.log(`[WebSocketCallHandler] Handler ready (session: ${this.sessionId})`);

    // Send status to client
    console.log(`[WebSocketCallHandler] Sending STATUS:ready to client (session: ${this.sessionId})`);
    this.sendMessage(WEBSOCKET_EVENTS.STATUS, {
      status: "ready",
      message: "Waiting for call to start",
    });
  }

  /**
   * Handle incoming audio data
   */
  async handleAudio(audioData: Buffer): Promise<void> {
    // Emit audio received event for CallRunnerService
    this.emitAudioReceived(audioData);
  }

  /**
   * Send audio to WebSocket client
   */
  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.isWsConnected) {
      return;
    }

    try {
      // Convert buffer to base64
      const base64Audio = audioData.toString("base64");

      this.sendMessage(WEBSOCKET_EVENTS.AUDIO_RESPONSE, {
        audio: base64Audio,
      });
    } catch (error) {
      console.error(`[WebSocketCallHandler] Error sending audio:`, error);
    }
  }

  /**
   * End the call
   */
  async end(reason?: string): Promise<void> {
    if (this.isWsConnected) {
      // Send call ended event to client
      this.sendMessage(WEBSOCKET_EVENTS.CALL_ENDED, {
        reason: reason || "Call ended",
        callId: this.callId,
        timestamp: new Date().toISOString(),
      });

      // Close WebSocket connection
      this.ws.close();
      this.isWsConnected = false;
    }

    this.isActive = false;
    this.emitCallEnded(reason);
    console.log(`[WebSocketCallHandler] Call ended (session: ${this.sessionId}, reason: ${reason || "normal"})`);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    this.ws.on("message", async (data: WebSocket.Data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await this.handleWebSocketMessage(message);
      } catch (error) {
        console.error(`[WebSocketCallHandler] Error handling message:`, error);
        this.sendError("Invalid message format");
      }
    });

    this.ws.on("close", async () => {
      console.log(`[WebSocketCallHandler] Client disconnected (session: ${this.sessionId})`);
      this.isWsConnected = false;
      await this.end("Client disconnected");
    });

    this.ws.on("error", (error: Error) => {
      console.error(`[WebSocketCallHandler] WebSocket error:`, error);
      this.isWsConnected = false;
      this.emitError(error);
    });
  }

  /**
   * Handle WebSocket messages from client
   */
  private async handleWebSocketMessage(message: WebSocketMessage): Promise<void> {
    const { type, data } = message;

    // Skip logging audio_data to reduce noise (it's sent continuously during calls)
    if (type !== WEBSOCKET_EVENTS.AUDIO_DATA) {
      console.log(`[WebSocketCallHandler] Message received: ${type} (session: ${this.sessionId})`);
    }

    switch (type) {
      case WEBSOCKET_EVENTS.START_CALL:
        await this.handleStartCall(data as StartCallData);
        break;

      case WEBSOCKET_EVENTS.AUDIO_DATA:
        await this.handleAudioData(data as unknown as AudioData);
        break;

      case WEBSOCKET_EVENTS.END_CALL:
        await this.end("User ended call");
        break;

      default:
        console.warn(`[WebSocketCallHandler] Unknown event type: ${type}`);
    }
  }

  /**
   * Handle start call event
   */
  private async handleStartCall(data?: StartCallData): Promise<void> {
    try {
      console.log(`[WebSocketCallHandler] Starting call (session: ${this.sessionId})`);

      // TODO: Update call metadata if name/email provided
      if (data?.name || data?.email) {
        console.log(`[WebSocketCallHandler] Caller info:`, {
          name: data.name,
          email: data.email,
        });
      }

      // Emit call started event
      this.emitCallStarted();

      // Send call started confirmation
      this.sendMessage(WEBSOCKET_EVENTS.CALL_STARTED, {
        sessionId: this.sessionId,
        callId: this.callId,
        message: "Call started successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[WebSocketCallHandler] Error starting call:`, error);
      this.sendError("Failed to start call");
      this.emitError(error instanceof Error ? error : new Error("Failed to start call"));
    }
  }

  /**
   * Handle audio data from client
   */
  private async handleAudioData(data: AudioData): Promise<void> {
    try {
      const { audio } = data;

      if (!audio) {
        return;
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audio, "base64");

      // Validate audio has content
      if (audioBuffer.length === 0) {
        console.warn(`[WebSocketCallHandler] Empty audio buffer received`);
        return;
      }

      // Pass to handleAudio which will emit audioReceived event
      await this.handleAudio(audioBuffer);
    } catch (error) {
      console.error(`[WebSocketCallHandler] Error handling audio data:`, error);
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(type: string, data: Record<string, unknown>): void {
    if (!this.isWsConnected || this.ws.readyState !== 1) {
      // 1 = WebSocket.OPEN
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type, data }));
    } catch (error) {
      console.error(`[WebSocketCallHandler] Error sending message:`, error);
    }
  }

  /**
   * Send error message to client
   */
  private sendError(message: string): void {
    this.sendMessage(WEBSOCKET_EVENTS.ERROR, {
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // Public Event Handlers (Called by CallRunnerService)
  // ============================================================================

  /**
   * Handle transcript from executor
   */
  handleTranscript(text: string, role: "user" | "assistant" | "system"): void {
    if (!this.isWsConnected) {
      return;
    }

    // Send transcript to client
    this.sendMessage(WEBSOCKET_EVENTS.TRANSCRIPT, {
      text,
      role,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle agent started speaking
   */
  handleAgentSpeaking(): void {
    if (!this.isWsConnected) {
      return;
    }

    this.sendMessage(WEBSOCKET_EVENTS.AGENT_SPEAKING, {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle agent listening
   */
  handleAgentListening(): void {
    if (!this.isWsConnected) {
      return;
    }

    this.sendMessage(WEBSOCKET_EVENTS.AGENT_LISTENING, {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle user interruption
   */
  handleUserInterrupted(): void {
    if (!this.isWsConnected) {
      return;
    }

    console.log(`[WebSocketCallHandler] User interrupted - stopping audio playback`);

    // Send stop audio command to client
    this.sendMessage(WEBSOCKET_EVENTS.STOP_AUDIO, {
      reason: "user_interrupted",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle escalation/transfer to human agent
   */
  handleEscalation(data: {
    reason: string;
    urgency: string;
    summary?: string;
  }): void {
    if (!this.isWsConnected) {
      return;
    }

    console.log(`[WebSocketCallHandler] Escalation initiated (session: ${this.sessionId}):`, data);

    // Send escalation notification to client
    this.sendMessage(WEBSOCKET_EVENTS.ESCALATION_STARTED, {
      reason: data.reason,
      urgency: data.urgency,
      summary: data.summary,
      message: "Transferring to a human agent...",
      timestamp: new Date().toISOString(),
    });
  }
}
