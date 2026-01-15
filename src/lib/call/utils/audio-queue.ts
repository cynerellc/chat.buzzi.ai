/**
 * Audio Queue for Paced Playback
 *
 * Provides a queue-based audio playback system for WebRTC calls.
 * Ensures smooth audio delivery by:
 * - Buffering incoming audio chunks
 * - Sending audio at consistent intervals (e.g., 10ms chunks)
 * - Handling interruptions gracefully
 *
 * Reference: Ported from /Users/joseph/Projects/voice.buzzi.ai/src/utils/audio-queue.js
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

interface AudioQueueConfig {
  /** Interval in ms for sending audio chunks (default: 10ms) */
  sendIntervalMs: number;
  /** Maximum queue size in chunks before dropping old data (default: 500) */
  maxQueueSize: number;
  /** Chunk size in bytes for sending (default: 320 = 10ms at 16kHz mono) */
  chunkSize: number;
  /** Sample rate of the audio (default: 16000) */
  sampleRate: number;
}

interface AudioQueueStats {
  queueLength: number;
  chunksProcessed: number;
  chunksDropped: number;
  isPlaying: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AudioQueueConfig = {
  sendIntervalMs: 10,
  maxQueueSize: 500, // ~5 seconds of audio at 10ms chunks
  chunkSize: 320, // 10ms at 16kHz mono (16000 samples/sec * 0.01 sec * 2 bytes/sample = 320)
  sampleRate: 16000,
};

// ============================================================================
// Audio Queue Class
// ============================================================================

export class AudioQueue extends EventEmitter {
  private config: AudioQueueConfig;
  private queue: Buffer[] = [];
  private isPlaying: boolean = false;
  private playbackTimer: NodeJS.Timeout | null = null;
  private chunksProcessed: number = 0;
  private chunksDropped: number = 0;
  private currentBuffer: Buffer | null = null;
  private currentBufferOffset: number = 0;

  constructor(config: Partial<AudioQueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add audio data to the queue
   */
  enqueue(audioData: Buffer): void {
    if (audioData.length === 0) {
      return;
    }

    // If queue is at max size, drop oldest chunks
    while (this.queue.length >= this.config.maxQueueSize) {
      this.queue.shift();
      this.chunksDropped++;
    }

    this.queue.push(audioData);

    // Start playback if not already playing
    if (!this.isPlaying) {
      this.startPlayback();
    }
  }

  /**
   * Start the playback timer
   */
  startPlayback(): void {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.emit("playbackStarted");

    this.playbackTimer = setInterval(() => {
      this.processNextChunk();
    }, this.config.sendIntervalMs);

    // Ensure timer doesn't prevent process exit
    if (this.playbackTimer.unref) {
      this.playbackTimer.unref();
    }
  }

  /**
   * Stop playback immediately
   */
  stopPlayback(): void {
    if (!this.isPlaying) {
      return;
    }

    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.isPlaying = false;
    this.currentBuffer = null;
    this.currentBufferOffset = 0;
    this.emit("playbackStopped");
  }

  /**
   * Clear the queue (for interruption handling)
   */
  clear(): void {
    const queuedChunks = this.queue.length;
    this.queue = [];
    this.currentBuffer = null;
    this.currentBufferOffset = 0;

    if (queuedChunks > 0) {
      this.emit("queueCleared", queuedChunks);
    }

    // Stop playback if queue is empty
    if (this.isPlaying && this.queue.length === 0) {
      this.stopPlayback();
    }
  }

  /**
   * Clear queue and stop playback (for interruptions)
   */
  interrupt(): void {
    this.clear();
    this.stopPlayback();
    this.emit("interrupted");
  }

  /**
   * Process and emit the next chunk of audio
   */
  private processNextChunk(): void {
    // If we have no current buffer, try to get one from queue
    if (!this.currentBuffer || this.currentBufferOffset >= this.currentBuffer.length) {
      if (this.queue.length === 0) {
        // Queue is empty, stop playback
        this.stopPlayback();
        return;
      }

      this.currentBuffer = this.queue.shift() || null;
      this.currentBufferOffset = 0;
    }

    if (!this.currentBuffer) {
      return;
    }

    // Extract chunk from current buffer
    const remainingBytes = this.currentBuffer.length - this.currentBufferOffset;
    const bytesToSend = Math.min(this.config.chunkSize, remainingBytes);
    const chunk = this.currentBuffer.subarray(
      this.currentBufferOffset,
      this.currentBufferOffset + bytesToSend
    );

    this.currentBufferOffset += bytesToSend;
    this.chunksProcessed++;

    // Emit the chunk
    this.emit("audioChunk", chunk);
  }

  /**
   * Get queue statistics
   */
  getStats(): AudioQueueStats {
    return {
      queueLength: this.queue.length,
      chunksProcessed: this.chunksProcessed,
      chunksDropped: this.chunksDropped,
      isPlaying: this.isPlaying,
    };
  }

  /**
   * Get estimated queue duration in milliseconds
   */
  getQueueDurationMs(): number {
    let totalBytes = 0;
    for (const buffer of this.queue) {
      totalBytes += buffer.length;
    }

    // Duration = bytes / (sampleRate * bytesPerSample)
    // For 16-bit audio: bytesPerSample = 2
    const bytesPerMs = (this.config.sampleRate * 2) / 1000;
    return Math.round(totalBytes / bytesPerMs);
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.currentBuffer === null;
  }

  /**
   * Check if currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.chunksProcessed = 0;
    this.chunksDropped = 0;
  }

  // ============================================================================
  // Typed Event Listeners
  // ============================================================================

  on(event: "audioChunk", handler: (chunk: Buffer) => void): this;
  on(event: "playbackStarted", handler: () => void): this;
  on(event: "playbackStopped", handler: () => void): this;
  on(event: "queueCleared", handler: (count: number) => void): this;
  on(event: "interrupted", handler: () => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, handler: (...args: any[]) => void): this {
    return super.on(event, handler);
  }

  emit(event: "audioChunk", chunk: Buffer): boolean;
  emit(event: "playbackStarted"): boolean;
  emit(event: "playbackStopped"): boolean;
  emit(event: "queueCleared", count: number): boolean;
  emit(event: "interrupted"): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an audio queue for OpenAI (24kHz output)
 */
export function createOpenAIAudioQueue(): AudioQueue {
  return new AudioQueue({
    sendIntervalMs: 10,
    sampleRate: 24000,
    chunkSize: 480, // 10ms at 24kHz mono (24000 * 0.01 * 2 = 480 bytes)
  });
}

/**
 * Create an audio queue for Gemini (24kHz output)
 */
export function createGeminiAudioQueue(): AudioQueue {
  return new AudioQueue({
    sendIntervalMs: 10,
    sampleRate: 24000,
    chunkSize: 480, // 10ms at 24kHz mono
  });
}

/**
 * Create an audio queue for WebRTC/WhatsApp (16kHz or 48kHz depending on codec)
 */
export function createWebRTCAudioQueue(sampleRate: number = 48000): AudioQueue {
  const chunkSize = Math.round((sampleRate * 0.01) * 2); // 10ms of audio
  return new AudioQueue({
    sendIntervalMs: 10,
    sampleRate,
    chunkSize,
  });
}
