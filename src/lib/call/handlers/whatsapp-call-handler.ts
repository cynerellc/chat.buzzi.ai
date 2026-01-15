/**
 * WhatsApp Call Handler
 *
 * Handles WhatsApp voice calls using WhatsApp Business Calling API.
 * Integrates WebRTC, SDP negotiation, and AI providers (OpenAI/Gemini).
 *
 * Features:
 * - WebRTC peer connection for audio streaming
 * - SDP offer/answer negotiation
 * - Opus codec handling (WhatsApp requirement)
 * - Audio conversion between WhatsApp and AI providers
 * - Interruption handling
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/handlers/whatsapp-call.js
 */

import { BaseCallHandler } from "./base-call-handler";
import { webrtcService } from "../services/webrtc-service";
import {
  webrtcToOpenAI,
  webrtcToGemini,
  resamplePCM16,
  monoToStereo,
} from "../utils/audio-converter";
import type { CallAiProvider } from "../types";

// ============================================================================
// Types
// ============================================================================

interface WhatsAppCallData {
  callId: string;
  phoneNumber: string;
  sdpOffer?: string;
  fromNumber?: string;
  toNumber?: string;
  integrationAccountId?: string;
}

interface WhatsAppCallHandlerOptions {
  aiProvider: CallAiProvider;
  onAudioToAI?: (audio: string) => Promise<void>;
}

// ============================================================================
// WhatsApp Call Handler
// ============================================================================

export class WhatsAppCallHandler extends BaseCallHandler {
  private callData: WhatsAppCallData;
  private whatsappCallId: string;
  private phoneNumber: string;
  private sdpOffer?: string;
  private sdpAnswer: string | null = null;
  private audioCodec: string = "opus";
  private audioSampleRate: number = 48000;
  private aiProvider: CallAiProvider;
  private onAudioToAI?: (audio: string) => Promise<void>;

  // Audio event handler reference for cleanup
  private audioReceivedHandler: ((data: { callId: string; audio: Buffer; codec: string; sampleRate: number }) => void) | null = null;

  constructor(
    sessionId: string,
    callId: string,
    callData: WhatsAppCallData,
    options: WhatsAppCallHandlerOptions
  ) {
    super(sessionId, callId);
    this.callData = callData;
    this.whatsappCallId = callData.callId;
    this.phoneNumber = callData.phoneNumber;
    this.sdpOffer = callData.sdpOffer;
    this.aiProvider = options.aiProvider;
    this.onAudioToAI = options.onAudioToAI;
  }

  /**
   * Start the WhatsApp call handler
   */
  async start(): Promise<void> {
    try {
      console.log(`[WhatsAppCallHandler] Starting (sessionId: ${this.sessionId}, phone: ${this.phoneNumber})`);

      // Validate and process SDP offer if present
      if (this.sdpOffer) {
        const validation = webrtcService.validateSDPOffer(this.sdpOffer);

        if (!validation.valid) {
          throw new Error(`Invalid SDP offer: ${validation.issues.join(", ")}`);
        }

        // Determine audio codec from SDP
        this.audioCodec = webrtcService.getPreferredAudioCodec(this.sdpOffer) || "opus";
        this.audioSampleRate = this.getSampleRateForCodec(this.audioCodec);

        console.log(`[WhatsAppCallHandler] SDP validated (codec: ${this.audioCodec}, sampleRate: ${this.audioSampleRate})`);

        // Create WebRTC session
        const webrtcSession = await webrtcService.createSession(
          this.whatsappCallId,
          this.sdpOffer,
          {
            audioCodec: this.audioCodec,
            audioSampleRate: this.audioSampleRate,
          }
        );

        this.sdpAnswer = webrtcSession.sdpAnswer;

        console.log(`[WhatsAppCallHandler] WebRTC session created (callId: ${this.whatsappCallId})`);
      }

      // Set up audio pipeline (listen for incoming audio from WebRTC)
      this.setupWebRTCAudioPipeline();

      this.isActive = true;
      this.emitCallStarted();

      console.log(`[WhatsAppCallHandler] Handler ready and active (sessionId: ${this.sessionId})`);
    } catch (error) {
      console.error(`[WhatsAppCallHandler] Error starting:`, error);
      this.emitError(error instanceof Error ? error : new Error("Failed to start WhatsApp call handler"));
      throw error;
    }
  }

  /**
   * Get sample rate for codec
   */
  private getSampleRateForCodec(codec: string): number {
    const codecRates: Record<string, number> = {
      PCMU: 8000,
      PCMA: 8000,
      opus: 48000,
      G722: 16000,
      L16: 16000,
    };

    return codecRates[codec] || 8000;
  }

  /**
   * Set up WebRTC audio pipeline
   * Listens for incoming audio from WebRTC and forwards to AI
   */
  private setupWebRTCAudioPipeline(): void {
    this.audioReceivedHandler = async (data: {
      callId: string;
      audio: Buffer;
      codec: string;
      sampleRate: number;
    }) => {
      if (data.callId !== this.whatsappCallId) return;

      try {
        if (!this.isActive) {
          return;
        }

        // Convert WebRTC audio to AI format based on provider
        const base64Audio =
          this.aiProvider === "GEMINI"
            ? await webrtcToGemini(data.audio, data.codec, data.sampleRate)
            : await webrtcToOpenAI(data.audio, data.codec, data.sampleRate);

        // Forward to AI via callback
        if (this.onAudioToAI) {
          await this.onAudioToAI(base64Audio);
        }

        // Also emit audio received event
        this.emitAudioReceived(Buffer.from(base64Audio, "base64"));
      } catch (error) {
        console.error(`[WhatsAppCallHandler] Error processing incoming audio:`, error);
      }
    };

    // Register audio handler
    webrtcService.on("audio:received", this.audioReceivedHandler);

    console.log(`[WhatsAppCallHandler] WebRTC audio pipeline configured (callId: ${this.whatsappCallId})`);
  }

  /**
   * Handle incoming audio from WhatsApp (implementation of base class)
   */
  async handleAudio(audioData: Buffer): Promise<void> {
    if (!this.isActive) {
      console.warn(`[WhatsAppCallHandler] Received audio but not active (sessionId: ${this.sessionId})`);
      return;
    }

    try {
      // Convert WebRTC audio to AI format based on provider
      const base64Audio =
        this.aiProvider === "GEMINI"
          ? await webrtcToGemini(audioData, this.audioCodec, this.audioSampleRate)
          : await webrtcToOpenAI(audioData, this.audioCodec, this.audioSampleRate);

      // Forward to AI via callback
      if (this.onAudioToAI) {
        await this.onAudioToAI(base64Audio);
      }
    } catch (error) {
      console.error(`[WhatsAppCallHandler] Error handling audio:`, error);
    }
  }

  /**
   * Send audio to WhatsApp client (implementation of base class)
   * Audio comes from AI (OpenAI or Gemini) as PCM16 24kHz mono
   */
  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.isActive) {
      console.warn(`[WhatsAppCallHandler] Cannot send audio - not active (sessionId: ${this.sessionId})`);
      return;
    }

    try {
      // Both OpenAI and Gemini output PCM16 at 24kHz mono
      // Need to convert to 48kHz stereo for WhatsApp

      // Resample from 24kHz to 48kHz
      const pcm16_48kHz_mono = await resamplePCM16(audioData, 24000, 48000);

      // Convert mono to stereo (WhatsApp requirement)
      const stereoBuffer = monoToStereo(pcm16_48kHz_mono);

      // Send via WebRTC
      await webrtcService.sendAudio(this.whatsappCallId, stereoBuffer);
    } catch (error) {
      console.error(`[WhatsAppCallHandler] Error sending audio:`, error);
    }
  }

  /**
   * Handle call status update from WhatsApp
   */
  async handleStatusUpdate(status: string): Promise<void> {
    try {
      console.log(`[WhatsAppCallHandler] Status update: ${status} (sessionId: ${this.sessionId})`);

      switch (status) {
        case "completed":
        case "failed":
        case "no-answer":
        case "busy":
          this.isActive = false;
          await this.end(`Call ${status}`);
          break;

        case "in-progress":
          this.isActive = true;
          console.log(`[WhatsAppCallHandler] Call in progress (sessionId: ${this.sessionId})`);
          break;

        default:
          console.debug(`[WhatsAppCallHandler] Unknown status: ${status}`);
      }
    } catch (error) {
      console.error(`[WhatsAppCallHandler] Error handling status update:`, error);
    }
  }

  /**
   * Clear audio queue (for interruption handling)
   */
  clearAudioQueue(): void {
    webrtcService.clearAudioQueue(this.whatsappCallId);
  }

  /**
   * End the call (implementation of base class)
   */
  async end(reason: string = "Call ended"): Promise<void> {
    try {
      this.isActive = false;

      // Clean up WebRTC audio handler
      if (this.audioReceivedHandler) {
        webrtcService.off("audio:received", this.audioReceivedHandler);
        this.audioReceivedHandler = null;
        console.log(`[WhatsAppCallHandler] Audio handler cleaned up (sessionId: ${this.sessionId})`);
      }

      // End WebRTC session
      webrtcService.endSession(this.whatsappCallId);

      this.emitCallEnded(reason);

      console.log(`[WhatsAppCallHandler] Handler ended (sessionId: ${this.sessionId}, reason: ${reason})`);
    } catch (error) {
      console.error(`[WhatsAppCallHandler] Error ending call:`, error);
      // Still emit ended event
      this.emitCallEnded(reason);
    }
  }

  /**
   * Get SDP answer (for responding to WhatsApp)
   */
  getSDPAnswer(): string | null {
    return this.sdpAnswer;
  }

  /**
   * Get WhatsApp-specific call info
   */
  getCallInfo(): {
    sessionId: string;
    callId: string;
    whatsappCallId: string;
    phoneNumber: string;
    platform: string;
    audioCodec: string;
    audioSampleRate: number;
    aiProvider: CallAiProvider;
    isActive: boolean;
    sdpNegotiated: boolean;
  } {
    return {
      sessionId: this.sessionId,
      callId: this.callId,
      whatsappCallId: this.whatsappCallId,
      phoneNumber: this.phoneNumber,
      platform: "whatsapp",
      audioCodec: this.audioCodec,
      audioSampleRate: this.audioSampleRate,
      aiProvider: this.aiProvider,
      isActive: this.isActive,
      sdpNegotiated: !!this.sdpAnswer,
    };
  }
}

/**
 * Factory function to create WhatsApp call handler
 */
export function createWhatsAppCallHandler(
  sessionId: string,
  callId: string,
  callData: WhatsAppCallData,
  options: WhatsAppCallHandlerOptions
): WhatsAppCallHandler {
  return new WhatsAppCallHandler(sessionId, callId, callData, options);
}
