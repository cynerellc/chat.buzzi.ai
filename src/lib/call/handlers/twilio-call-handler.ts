/**
 * Twilio Call Handler
 *
 * Handles phone calls via Twilio Media Streams.
 * Manages bi-directional audio streaming between Twilio and AI provider.
 *
 * Audio flow:
 * - Twilio → Handler: μ-law 8kHz → PCM16 24kHz → AI Provider
 * - AI Provider → Handler: PCM16 24kHz → μ-law 8kHz → Twilio
 *
 * Reference: https://www.twilio.com/docs/voice/twiml/stream
 */

import type WebSocket from "ws";
import { BaseCallHandler } from "./base-call-handler";
import { mulawToPCM16, pcm16ToMulaw, resamplePCM16 } from "../utils/audio-converter";

// ============================================================================
// Twilio Media Stream Events
// ============================================================================

export const TWILIO_EVENTS = {
  CONNECTED: "connected",
  START: "start",
  MEDIA: "media",
  STOP: "stop",
  MARK: "mark",
} as const;

// ============================================================================
// Types
// ============================================================================

interface TwilioConnectedMessage {
  event: "connected";
  protocol: string;
  version: string;
}

interface TwilioStartMessage {
  event: "start";
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters?: Record<string, string>;
  };
}

interface TwilioMediaMessage {
  event: "media";
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // Base64 encoded μ-law audio
  };
}

interface TwilioStopMessage {
  event: "stop";
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
}

interface TwilioMarkMessage {
  event: "mark";
  sequenceNumber: string;
  mark: {
    name: string;
  };
}

type TwilioMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioStopMessage
  | TwilioMarkMessage;

// ============================================================================
// Twilio Call Handler
// ============================================================================

export class TwilioCallHandler extends BaseCallHandler {
  private ws: WebSocket;
  private isWsConnected: boolean = false;
  private streamSid: string | null = null;
  private markCounter: number = 0;
  private aiProviderSampleRate: number;

  constructor(
    ws: WebSocket,
    sessionId: string,
    callId: string,
    aiProviderSampleRate: number = 24000 // OpenAI uses 24kHz, Gemini uses 16kHz
  ) {
    super(sessionId, callId);
    this.ws = ws;
    this.aiProviderSampleRate = aiProviderSampleRate;
    this.isWsConnected = true;
  }

  /**
   * Start the handler
   */
  async start(): Promise<void> {
    this.setupWebSocketHandlers();
    this.isActive = true;

    console.log(`[TwilioCallHandler] Handler ready (session: ${this.sessionId})`);
  }

  /**
   * Handle incoming audio data from Twilio
   * Converts μ-law 8kHz to PCM16 at AI provider sample rate
   */
  async handleAudio(audioData: Buffer): Promise<void> {
    try {
      // Convert μ-law to PCM16
      const pcm16Data = mulawToPCM16(audioData);

      // Resample from 8kHz to AI provider rate (24kHz for OpenAI, 16kHz for Gemini)
      const resampledData = resamplePCM16(pcm16Data, 8000, this.aiProviderSampleRate);

      // Emit audio received event for CallRunnerService
      this.emitAudioReceived(resampledData);
    } catch (error) {
      console.error(`[TwilioCallHandler] Error processing audio:`, error);
    }
  }

  /**
   * Send audio to Twilio
   * Converts PCM16 at AI provider sample rate to μ-law 8kHz
   */
  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.isWsConnected || !this.streamSid) {
      return;
    }

    try {
      // Resample from AI provider rate to 8kHz
      const resampledData = resamplePCM16(audioData, this.aiProviderSampleRate, 8000);

      // Convert PCM16 to μ-law
      const mulawData = pcm16ToMulaw(resampledData);

      // Send to Twilio as base64
      const base64Audio = mulawData.toString("base64");

      this.sendMessage({
        event: "media",
        streamSid: this.streamSid,
        media: {
          payload: base64Audio,
        },
      });
    } catch (error) {
      console.error(`[TwilioCallHandler] Error sending audio:`, error);
    }
  }

  /**
   * Send a mark to track audio playback position
   */
  sendMark(name?: string): void {
    if (!this.isWsConnected || !this.streamSid) {
      return;
    }

    const markName = name || `mark_${this.markCounter++}`;

    this.sendMessage({
      event: "mark",
      streamSid: this.streamSid,
      mark: {
        name: markName,
      },
    });
  }

  /**
   * Clear the Twilio audio buffer (for interruption handling)
   */
  clearBuffer(): void {
    if (!this.isWsConnected || !this.streamSid) {
      return;
    }

    this.sendMessage({
      event: "clear",
      streamSid: this.streamSid,
    });

    console.log(`[TwilioCallHandler] Cleared audio buffer (session: ${this.sessionId})`);
  }

  /**
   * End the call
   */
  async end(reason?: string): Promise<void> {
    if (this.isWsConnected) {
      // Close WebSocket connection
      this.ws.close();
      this.isWsConnected = false;
    }

    this.isActive = false;
    this.emitCallEnded(reason);
    console.log(`[TwilioCallHandler] Call ended (session: ${this.sessionId}, reason: ${reason || "normal"})`);
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
        const message: TwilioMessage = JSON.parse(data.toString());
        await this.handleTwilioMessage(message);
      } catch (error) {
        console.error(`[TwilioCallHandler] Error handling message:`, error);
      }
    });

    this.ws.on("close", async () => {
      console.log(`[TwilioCallHandler] WebSocket closed (session: ${this.sessionId})`);
      this.isWsConnected = false;
      await this.end("Connection closed");
    });

    this.ws.on("error", (error: Error) => {
      console.error(`[TwilioCallHandler] WebSocket error:`, error);
      this.isWsConnected = false;
      this.emitError(error);
    });
  }

  /**
   * Handle Twilio Media Stream messages
   */
  private async handleTwilioMessage(message: TwilioMessage): Promise<void> {
    switch (message.event) {
      case TWILIO_EVENTS.CONNECTED:
        await this.handleConnected(message);
        break;

      case TWILIO_EVENTS.START:
        await this.handleStart(message);
        break;

      case TWILIO_EVENTS.MEDIA:
        await this.handleMedia(message);
        break;

      case TWILIO_EVENTS.STOP:
        await this.handleStop(message);
        break;

      case TWILIO_EVENTS.MARK:
        this.handleMark(message);
        break;

      default:
        console.warn(`[TwilioCallHandler] Unknown event: ${(message as { event: string }).event}`);
    }
  }

  /**
   * Handle connected event
   */
  private async handleConnected(message: TwilioConnectedMessage): Promise<void> {
    console.log(`[TwilioCallHandler] Connected (protocol: ${message.protocol}, version: ${message.version})`);
  }

  /**
   * Handle start event
   */
  private async handleStart(message: TwilioStartMessage): Promise<void> {
    const { start } = message;
    this.streamSid = start.streamSid;

    console.log(`[TwilioCallHandler] Stream started:`, {
      streamSid: start.streamSid,
      callSid: start.callSid,
      tracks: start.tracks,
      mediaFormat: start.mediaFormat,
    });

    // Emit call started event
    this.emitCallStarted();
  }

  /**
   * Handle media event (incoming audio)
   */
  private async handleMedia(message: TwilioMediaMessage): Promise<void> {
    const { media } = message;

    // Decode base64 μ-law audio
    const audioBuffer = Buffer.from(media.payload, "base64");

    // Process the audio
    await this.handleAudio(audioBuffer);
  }

  /**
   * Handle stop event
   */
  private async handleStop(message: TwilioStopMessage): Promise<void> {
    console.log(`[TwilioCallHandler] Stream stopped (callSid: ${message.stop.callSid})`);
    await this.end("Stream stopped");
  }

  /**
   * Handle mark event (audio playback position tracking)
   */
  private handleMark(message: TwilioMarkMessage): void {
    console.log(`[TwilioCallHandler] Mark received: ${message.mark.name}`);
    // Marks can be used to track when audio has finished playing
    // Useful for implementing proper turn-taking
  }

  /**
   * Send message to Twilio
   */
  private sendMessage(message: Record<string, unknown>): void {
    if (!this.isWsConnected || this.ws.readyState !== 1) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[TwilioCallHandler] Error sending message:`, error);
    }
  }

  // ============================================================================
  // Public Event Handlers (Called by CallRunnerService)
  // ============================================================================

  /**
   * Handle transcript from executor
   */
  handleTranscript(text: string, role: "user" | "assistant" | "system"): void {
    // Twilio doesn't have a transcript channel - this is logged for analytics
    console.log(`[TwilioCallHandler] Transcript (${role}): ${text.substring(0, 50)}...`);
  }

  /**
   * Handle agent started speaking
   */
  handleAgentSpeaking(): void {
    console.log(`[TwilioCallHandler] Agent speaking`);
  }

  /**
   * Handle agent listening
   */
  handleAgentListening(): void {
    console.log(`[TwilioCallHandler] Agent listening`);
  }

  /**
   * Handle user interruption - clear audio buffer
   */
  handleUserInterrupted(): void {
    console.log(`[TwilioCallHandler] User interrupted - clearing buffer`);
    this.clearBuffer();
  }
}

/**
 * Factory function to create Twilio call handler
 */
export function createTwilioCallHandler(
  ws: WebSocket,
  sessionId: string,
  callId: string,
  aiProvider: "openai" | "gemini" = "openai"
): TwilioCallHandler {
  // OpenAI Realtime API uses 24kHz, Gemini Live uses 16kHz
  const sampleRate = aiProvider === "openai" ? 24000 : 16000;
  return new TwilioCallHandler(ws, sessionId, callId, sampleRate);
}
