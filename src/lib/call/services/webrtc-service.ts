/**
 * WebRTC Service for WhatsApp Voice Calls
 *
 * Handles WebRTC peer connection management for WhatsApp Business Calling API.
 * - SDP negotiation (offer/answer)
 * - ICE candidate management
 * - Audio track handling (send/receive)
 * - Media stream management
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/services/webrtc.js
 */

import sdpTransform from "sdp-transform";
import { EventEmitter } from "events";
import wrtc, {
  RTCPeerConnection as WRTCPeerConnection,
  RTCSessionDescription as WRTCSessionDescription,
  RTCAudioSink as WRTCAudioSink,
  RTCAudioSource as WRTCAudioSource,
  MediaStreamTrack as WRTCMediaStreamTrack,
} from "wrtc";

const RTCPeerConnection = WRTCPeerConnection;
const RTCSessionDescription = WRTCSessionDescription;
const { RTCAudioSink } = wrtc.nonstandard;

// ============================================================================
// Types
// ============================================================================

type AudioSinkType = InstanceType<typeof WRTCAudioSink>;
type AudioSourceType = InstanceType<typeof WRTCAudioSource>;

interface WebRTCSessionData {
  callId: string;
  pc: InstanceType<typeof WRTCPeerConnection> | null;
  sdpOffer: string;
  sdpAnswer: string | null;
  mediaInfo: MediaInfo | null;
  createdAt: Date;
  status: string;
  options: WebRTCSessionOptions;
  audioSender?: RTCRtpSender;
  audioReceiver?: RTCRtpReceiver;
  audioSink?: AudioSinkType;
  audioSource?: AudioSourceType;
  audioQueue?: AudioQueue;
  statsInterval?: NodeJS.Timeout;
}

interface MediaInfo {
  type: string;
  port: number;
  protocol: string;
  codecs: Array<{
    payloadType: number;
    codec: string;
    rate?: number;
    encoding?: number;
  }>;
  direction?: string;
  iceUfrag?: string;
  icePwd?: string;
}

interface WebRTCSessionOptions {
  audioCodec?: string;
  audioSampleRate?: number;
  publicIp?: string;
  audioPort?: number;
  iceUfrag?: string;
  icePwd?: string;
}

interface AudioReceivedData {
  callId: string;
  audio: Buffer;
  codec: string;
  sampleRate: number;
}

// ============================================================================
// Audio Queue for Pacing
// ============================================================================

class AudioQueue {
  private audioSource: AudioSourceType;
  private callId: string;
  private buffer: Buffer = Buffer.alloc(0);
  private interval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private chunksSent: number = 0;

  // Constants for 48kHz Stereo
  private readonly SAMPLE_RATE = 48000;
  private readonly CHANNEL_COUNT = 2;
  private readonly CHUNK_DURATION_MS = 10;
  private readonly SAMPLES_PER_CHUNK: number;
  private readonly BYTES_PER_CHUNK: number;

  constructor(audioSource: AudioSourceType, callId: string) {
    this.audioSource = audioSource;
    this.callId = callId;
    this.SAMPLES_PER_CHUNK = (this.SAMPLE_RATE * this.CHUNK_DURATION_MS) / 1000; // 480
    this.BYTES_PER_CHUNK = this.SAMPLES_PER_CHUNK * this.CHANNEL_COUNT * 2; // 1920 bytes
    this.start();
  }

  enqueue(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  start(): void {
    if (this.interval) return;

    this.startTime = Date.now();
    this.chunksSent = 0;

    this.interval = setInterval(() => {
      this.processTick();
    }, this.CHUNK_DURATION_MS);

    console.log(`[WebRTCService] Audio pacing queue started (callId: ${this.callId})`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log(`[WebRTCService] Audio pacing queue stopped (callId: ${this.callId})`);
    }
    this.buffer = Buffer.alloc(0);
  }

  clear(): void {
    this.buffer = Buffer.alloc(0);
    this.startTime = Date.now();
    this.chunksSent = 0;
    console.log(`[WebRTCService] Audio queue cleared (callId: ${this.callId})`);
  }

  private processTick(): void {
    const now = Date.now();
    const elapsedMs = now - this.startTime;
    const expectedChunks = Math.floor(elapsedMs / this.CHUNK_DURATION_MS);

    const chunksNeeded = expectedChunks - this.chunksSent;
    const maxCatchUp = 5;
    const chunksToSend = Math.min(chunksNeeded, maxCatchUp);

    for (let i = 0; i < chunksToSend; i++) {
      if (this.buffer.length < this.BYTES_PER_CHUNK) {
        if (this.buffer.length === 0 && chunksNeeded > 10) {
          this.startTime = now;
          this.chunksSent = 0;
        }
        break;
      }
      this.sendNextChunk();
    }
  }

  private sendNextChunk(): void {
    if (this.buffer.length < this.BYTES_PER_CHUNK) return;

    try {
      const chunk = this.buffer.subarray(0, this.BYTES_PER_CHUNK);
      this.buffer = this.buffer.subarray(this.BYTES_PER_CHUNK);

      const arrayBuffer = new ArrayBuffer(this.BYTES_PER_CHUNK);
      const samples = new Int16Array(arrayBuffer);

      for (let i = 0; i < this.SAMPLES_PER_CHUNK * this.CHANNEL_COUNT; i++) {
        samples[i] = chunk.readInt16LE(i * 2);
      }

      this.audioSource.onData({
        samples,
        sampleRate: this.SAMPLE_RATE,
        bitsPerSample: 16,
        channelCount: this.CHANNEL_COUNT,
        numberOfFrames: this.SAMPLES_PER_CHUNK,
      });

      this.chunksSent++;
    } catch (error) {
      console.error(`[WebRTCService] Error processing audio chunk:`, error);
    }
  }
}

// ============================================================================
// WebRTC Service
// ============================================================================

class WebRTCService extends EventEmitter {
  private sessions: Map<string, WebRTCSessionData> = new Map();
  private config: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  constructor() {
    super();
  }

  /**
   * Parse SDP string using sdp-transform
   */
  parseSDP(sdpOffer: string): ReturnType<typeof sdpTransform.parse> {
    if (!sdpOffer || typeof sdpOffer !== "string") {
      throw new Error("SDP offer must be a non-empty string");
    }

    const parsed = sdpTransform.parse(sdpOffer);

    if (!parsed || typeof parsed.version === "undefined" || !parsed.origin) {
      throw new Error("Invalid SDP format - missing required fields");
    }

    return parsed;
  }

  /**
   * Pre-process WhatsApp SDP to make it WebRTC-compatible
   */
  preprocessSDP(sdpOffer: string): string {
    try {
      const parsed = sdpTransform.parse(sdpOffer);

      // Remove ice-lite attribute if present
      if (parsed.icelite) {
        delete parsed.icelite;
      }

      // Filter out IPv6 candidates
      if (parsed.media && Array.isArray(parsed.media)) {
        parsed.media.forEach((media) => {
          if (media.candidates && Array.isArray(media.candidates)) {
            media.candidates = media.candidates.filter((candidate) => {
              return candidate.ip && candidate.ip.includes(".") && !candidate.ip.includes(":");
            });
          }
        });
      }

      return sdpTransform.write(parsed);
    } catch (error) {
      console.error("[WebRTCService] Failed to preprocess SDP:", error);
      return sdpOffer;
    }
  }

  /**
   * Create SDP answer for incoming call
   */
  createSDPAnswer(sdpOffer: string, options: WebRTCSessionOptions = {}): string {
    const parsed = this.parseSDP(sdpOffer);
    const audioMedia = parsed.media?.find((m) => m.type === "audio");

    if (!audioMedia) {
      throw new Error("No audio media found in SDP offer");
    }

    // Find Opus codec (required by WhatsApp)
    const opusCodec = audioMedia.rtp?.find((r) => r.codec.toLowerCase() === "opus");

    if (!opusCodec) {
      throw new Error("Opus codec not found in SDP offer (required by WhatsApp)");
    }

    const opusPayloadType = opusCodec.payload.toString();
    const opusFmtp = audioMedia.fmtp?.filter((f) => f.payload === opusCodec.payload) || [];

    const answer: ReturnType<typeof sdpTransform.parse> = {
      version: 0,
      origin: {
        username: "chat-buzzi",
        sessionId: String(Date.now()),
        sessionVersion: 1,
        netType: "IN",
        ipVer: 4,
        address: options.publicIp || "0.0.0.0",
      },
      name: "Chat Buzzi Voice Agent",
      timing: { start: 0, stop: 0 },
      media: [],
    };

    if (parsed.groups && parsed.groups.length > 0) {
      answer.groups = parsed.groups;
    }

    if (parsed.msidSemantic) {
      answer.msidSemantic = parsed.msidSemantic;
    }

    const audioAnswer: Record<string, unknown> = {
      type: "audio",
      port: options.audioPort || 9,
      protocol: audioMedia.protocol || "UDP/TLS/RTP/SAVPF",
      payloads: opusPayloadType,
      rtp: [opusCodec],
      fmtp: opusFmtp,
      direction: "sendrecv",
      connection: {
        version: 4,
        ip: options.publicIp || "0.0.0.0",
      },
    };

    if (audioMedia.rtcpMux === "rtcp-mux") {
      audioAnswer.rtcpMux = "rtcp-mux";
    }

    if (audioMedia.iceUfrag && audioMedia.icePwd) {
      audioAnswer.iceUfrag = options.iceUfrag || this.generateIceUfrag();
      audioAnswer.icePwd = options.icePwd || this.generateIcePwd();
      audioAnswer.iceOptions = "trickle";
    }

    // CRITICAL: WhatsApp requires setup:active in answer
    audioAnswer.setup = "active";

    if (audioMedia.fingerprint) {
      audioAnswer.fingerprint = audioMedia.fingerprint;
    }

    if (audioMedia.mid !== undefined) {
      audioAnswer.mid = audioMedia.mid;
    }

    answer.media.push(audioAnswer as unknown as ReturnType<typeof sdpTransform.parse>["media"][0]);

    return sdpTransform.write(answer);
  }

  /**
   * Generate ICE username fragment
   */
  generateIceUfrag(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Generate ICE password
   */
  generateIcePwd(): string {
    return Math.random().toString(36).substring(2, 26);
  }

  /**
   * Extract media information from SDP
   */
  extractMediaInfo(sdp: string): MediaInfo | null {
    try {
      const parsed = this.parseSDP(sdp);
      const audioMedia = parsed.media?.find((m) => m.type === "audio");

      if (!audioMedia) return null;

      const codecs =
        audioMedia.rtp?.map((r) => ({
          payloadType: r.payload,
          codec: r.codec,
          rate: r.rate,
          encoding: r.encoding,
        })) || [];

      return {
        type: "audio",
        port: audioMedia.port,
        protocol: audioMedia.protocol || "",
        codecs,
        direction: audioMedia.direction,
        iceUfrag: audioMedia.iceUfrag,
        icePwd: audioMedia.icePwd,
      };
    } catch {
      return null;
    }
  }

  /**
   * Create a new WebRTC session for a call
   */
  async createSession(
    callId: string,
    sdpOffer: string,
    options: WebRTCSessionOptions = {}
  ): Promise<WebRTCSessionData> {
    console.log(`[WebRTCService] Creating WebRTC session (callId: ${callId})`);

    const mediaInfo = this.extractMediaInfo(sdpOffer);
    const processedSDP = this.preprocessSDP(sdpOffer);

    let pc: InstanceType<typeof WRTCPeerConnection> | null = null;
    let sdpAnswer: string | null = null;
    let sender: RTCRtpSender | undefined;
    let audioSource: AudioSourceType | undefined;

    try {
      const result = await this.createPeerConnection(callId, processedSDP, options);
      pc = result.pc;
      sender = result.sender;
      audioSource = result.audioSource;
      sdpAnswer = result.answer.sdp || result.answer.toString();

      console.log(`[WebRTCService] Successfully created WebRTC peer connection (callId: ${callId})`);
    } catch (webrtcError) {
      console.error(`[WebRTCService] WebRTC failed, falling back to manual SDP (callId: ${callId}):`, webrtcError);
      sdpAnswer = this.createSDPAnswer(sdpOffer, options);
    }

    const session: WebRTCSessionData = {
      callId,
      pc,
      sdpOffer,
      sdpAnswer,
      mediaInfo,
      createdAt: new Date(),
      status: "created",
      options,
      audioSender: sender,
      audioSource,
    };

    this.sessions.set(callId, session);

    console.log(`[WebRTCService] WebRTC session created (callId: ${callId})`);

    return session;
  }

  /**
   * Create RTCPeerConnection for WebRTC audio streaming
   */
  private async createPeerConnection(
    callId: string,
    sdpOffer: string,
    options: WebRTCSessionOptions = {}
  ): Promise<{ pc: InstanceType<typeof WRTCPeerConnection>; answer: RTCSessionDescriptionInit; sender?: RTCRtpSender; audioSource?: AudioSourceType }> {
    const pc = new RTCPeerConnection(this.config);

    console.log(`[WebRTCService] RTCPeerConnection created (callId: ${callId})`);

    // Register placeholder session before SDP negotiation
    this.sessions.set(callId, {
      callId,
      pc,
      sdpOffer,
      sdpAnswer: null,
      mediaInfo: null,
      status: "initializing",
      createdAt: new Date(),
      options,
    });

    // Handle ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log(`[WebRTCService] ICE candidate generated (callId: ${callId})`);
        this.emit("icecandidate", { callId, candidate });
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTCService] ICE state: ${pc.iceConnectionState} (callId: ${callId})`);

      if (pc.iceConnectionState === "connected") {
        this.updateSessionStatus(callId, "connected");
        this.emit("call:connected", callId);
      } else if (pc.iceConnectionState === "failed") {
        this.updateSessionStatus(callId, "failed");
        this.emit("call:failed", callId);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTCService] Connection state: ${pc.connectionState} (callId: ${callId})`);

      if (pc.connectionState === "connected") {
        this.emit("call:connected", callId);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.emit("call:ended", callId);
      }
    };

    // Handle incoming audio track from WhatsApp
    pc.ontrack = (event) => {
      console.log(`[WebRTCService] Received remote audio track (callId: ${callId})`);

      if (event.track.kind === "audio") {
        this.handleIncomingTrack(callId, event.track, event.receiver);
      }
    };

    // Set remote description
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: sdpOffer }));

    console.log(`[WebRTCService] Remote description set (callId: ${callId})`);

    // Get audio transceiver
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === "audio");

    if (!audioTransceiver) {
      throw new Error("No audio transceiver found after setting remote description");
    }

    const sender = audioTransceiver.sender;

    // Create audio source and track for sending audio
    let audioSource: AudioSourceType | undefined;
    try {
      audioSource = new wrtc.nonstandard.RTCAudioSource();
      const track = audioSource.createTrack();
      await sender.replaceTrack(track as unknown as MediaStreamTrack);

      audioTransceiver.direction = "sendrecv";

      console.log(`[WebRTCService] Audio track created and attached (callId: ${callId})`);
    } catch (trackError) {
      console.error(`[WebRTCService] Failed to create audio track, will be receive-only:`, trackError);
    }

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    console.log(`[WebRTCService] Local description set (callId: ${callId})`);

    return { pc, answer, sender, audioSource };
  }

  /**
   * Handle incoming audio track from WhatsApp
   */
  private handleIncomingTrack(callId: string, track: WRTCMediaStreamTrack, receiver: RTCRtpReceiver): void {
    const session = this.sessions.get(callId);
    if (!session) {
      console.warn(`[WebRTCService] Session not found for incoming track (callId: ${callId})`);
      return;
    }

    session.audioReceiver = receiver;

    // Use RTCAudioSink to receive audio data
    const audioSink = new RTCAudioSink(track);

    audioSink.ondata = (data: { samples: Int16Array; sampleRate: number }) => {
      try {
        const buffer = Buffer.from(data.samples.buffer, data.samples.byteOffset, data.samples.byteLength);

        this.emit("audio:received", {
          callId,
          audio: buffer,
          codec: "pcm16",
          sampleRate: data.sampleRate,
        } as AudioReceivedData);
      } catch (error) {
        console.error(`[WebRTCService] Error processing incoming audio:`, error);
      }
    };

    session.audioSink = audioSink;

    console.log(`[WebRTCService] RTCAudioSink setup complete (callId: ${callId})`);
  }

  /**
   * Send audio to WhatsApp via RTCAudioSource
   */
  async sendAudio(callId: string, pcm16Data: Buffer): Promise<void> {
    const session = this.sessions.get(callId);

    if (!session) {
      console.debug(`[WebRTCService] No session found for sendAudio (callId: ${callId})`);
      return;
    }

    if (!session.pc || !session.audioSource) {
      console.warn(`[WebRTCService] No audio source available (callId: ${callId})`);
      return;
    }

    // Initialize audio queue if not present
    if (!session.audioQueue) {
      session.audioQueue = new AudioQueue(session.audioSource, callId);
    }

    // Push audio to the pacing queue
    session.audioQueue.enqueue(pcm16Data);
  }

  /**
   * Clear audio queue (for interruption handling)
   */
  clearAudioQueue(callId: string): void {
    const session = this.sessions.get(callId);
    if (session?.audioQueue) {
      session.audioQueue.clear();
      console.log(`[WebRTCService] Audio queue cleared (callId: ${callId})`);
    }
  }

  /**
   * Validate SDP offer
   */
  validateSDPOffer(sdpOffer: string): { valid: boolean; issues: string[]; mediaInfo: MediaInfo | null } {
    try {
      this.parseSDP(sdpOffer);
      const mediaInfo = this.extractMediaInfo(sdpOffer);

      const issues: string[] = [];

      if (!mediaInfo) {
        issues.push("No audio media found");
      }

      if (!mediaInfo?.codecs || mediaInfo.codecs.length === 0) {
        issues.push("No audio codecs found");
      }

      return {
        valid: issues.length === 0,
        issues,
        mediaInfo,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [error instanceof Error ? error.message : "Unknown error"],
        mediaInfo: null,
      };
    }
  }

  /**
   * Get preferred audio codec from SDP
   */
  getPreferredAudioCodec(sdpOffer: string): string {
    try {
      const mediaInfo = this.extractMediaInfo(sdpOffer);

      if (!mediaInfo?.codecs) return "PCMU";

      const opus = mediaInfo.codecs.find((c) => c.codec.toLowerCase() === "opus");
      if (opus) return "opus";

      const pcmu = mediaInfo.codecs.find((c) => c.codec.toLowerCase() === "pcmu");
      if (pcmu) return "PCMU";

      return mediaInfo.codecs[0]?.codec || "PCMU";
    } catch {
      return "PCMU";
    }
  }

  /**
   * Get session by call ID
   */
  getSession(callId: string): WebRTCSessionData | undefined {
    return this.sessions.get(callId);
  }

  /**
   * Update session status
   */
  updateSessionStatus(callId: string, status: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.status = status;
      console.log(`[WebRTCService] Session status updated: ${status} (callId: ${callId})`);
    }
  }

  /**
   * End a WebRTC session
   */
  endSession(callId: string): void {
    const session = this.sessions.get(callId);

    if (session) {
      console.log(`[WebRTCService] Ending WebRTC session (callId: ${callId})`);

      // Stop audio queue
      if (session.audioQueue) {
        session.audioQueue.stop();
      }

      // Close audio sink
      if (session.audioSink) {
        session.audioSink.stop?.();
      }

      // Clear stats interval
      if (session.statsInterval) {
        clearInterval(session.statsInterval);
      }

      // Close peer connection
      if (session.pc) {
        session.pc.close();
      }

      session.status = "ended";

      // Cleanup after delay
      setTimeout(() => {
        this.sessions.delete(callId);
        console.log(`[WebRTCService] WebRTC session cleaned up (callId: ${callId})`);
      }, 30000);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WebRTCSessionData[] {
    return Array.from(this.sessions.values()).filter((s) => s.status !== "ended");
  }

  /**
   * Get service statistics
   */
  getStats(): { totalSessions: number; activeSessions: number; endedSessions: number } {
    const sessions = Array.from(this.sessions.values());

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status !== "ended").length,
      endedSessions: sessions.filter((s) => s.status === "ended").length,
    };
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();
export default webrtcService;
