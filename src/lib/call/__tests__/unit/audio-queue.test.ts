/**
 * AudioQueue Unit Tests
 *
 * Tests for the audio queue system including:
 * - Basic queue operations
 * - Playback lifecycle
 * - Interruption handling
 * - Queue limits and eviction
 * - Statistics
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AudioQueue,
  createOpenAIAudioQueue,
  createGeminiAudioQueue,
  createWebRTCAudioQueue,
} from "../../utils/audio-queue";

// ============================================================================
// Tests
// ============================================================================

describe("AudioQueue", () => {
  let queue: AudioQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new AudioQueue();
  });

  afterEach(() => {
    queue.stopPlayback();
    queue.removeAllListeners();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should create queue with default config", () => {
      const stats = queue.getStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.chunksProcessed).toBe(0);
      expect(stats.chunksDropped).toBe(0);
      expect(stats.isPlaying).toBe(false);
    });

    it("should create queue with custom config", () => {
      const customQueue = new AudioQueue({
        sendIntervalMs: 20,
        maxQueueSize: 100,
        chunkSize: 640,
        sampleRate: 24000,
      });

      expect(customQueue.isEmpty()).toBe(true);
    });

    it("should allow partial config override", () => {
      const customQueue = new AudioQueue({
        sampleRate: 24000,
      });

      expect(customQueue.isEmpty()).toBe(true);
    });
  });

  // ============================================================================
  // Enqueue Tests
  // ============================================================================

  describe("enqueue", () => {
    it("should add audio data to queue", () => {
      const audioData = Buffer.from([1, 2, 3, 4]);
      queue.enqueue(audioData);

      expect(queue.isEmpty()).toBe(false);
      const stats = queue.getStats();
      expect(stats.queueLength).toBe(1);
    });

    it("should ignore empty buffers", () => {
      queue.enqueue(Buffer.alloc(0));

      expect(queue.isEmpty()).toBe(true);
      const stats = queue.getStats();
      expect(stats.queueLength).toBe(0);
    });

    it("should automatically start playback when data is added", () => {
      const playbackStartedHandler = vi.fn();
      queue.on("playbackStarted", playbackStartedHandler);

      queue.enqueue(Buffer.from([1, 2, 3]));

      expect(playbackStartedHandler).toHaveBeenCalled();
      expect(queue.isCurrentlyPlaying()).toBe(true);
    });

    it("should not start playback twice", () => {
      const playbackStartedHandler = vi.fn();
      queue.on("playbackStarted", playbackStartedHandler);

      queue.enqueue(Buffer.from([1, 2, 3]));
      queue.enqueue(Buffer.from([4, 5, 6]));

      expect(playbackStartedHandler).toHaveBeenCalledTimes(1);
    });

    it("should drop oldest chunks when at max size", () => {
      // Create queue with small max size
      const smallQueue = new AudioQueue({
        maxQueueSize: 3,
      });

      // Add more chunks than max size
      smallQueue.enqueue(Buffer.from([1]));
      smallQueue.enqueue(Buffer.from([2]));
      smallQueue.enqueue(Buffer.from([3]));
      smallQueue.enqueue(Buffer.from([4])); // Should drop chunk 1

      const stats = smallQueue.getStats();
      expect(stats.chunksDropped).toBe(1);
      expect(stats.queueLength).toBeLessThanOrEqual(3);

      smallQueue.stopPlayback();
    });
  });

  // ============================================================================
  // Playback Tests
  // ============================================================================

  describe("playback", () => {
    it("should emit audioChunk events at regular intervals", () => {
      const audioChunkHandler = vi.fn();
      queue.on("audioChunk", audioChunkHandler);

      // Add audio data
      queue.enqueue(Buffer.alloc(640)); // Larger than default chunk size (320)

      // Advance time to process chunks
      vi.advanceTimersByTime(10); // First chunk
      vi.advanceTimersByTime(10); // Second chunk

      expect(audioChunkHandler).toHaveBeenCalled();
    });

    it("should stop playback when queue is empty", () => {
      const playbackStoppedHandler = vi.fn();
      queue.on("playbackStopped", playbackStoppedHandler);

      // Add small chunk
      queue.enqueue(Buffer.alloc(100));

      // Process all chunks
      vi.advanceTimersByTime(100);

      expect(playbackStoppedHandler).toHaveBeenCalled();
      expect(queue.isCurrentlyPlaying()).toBe(false);
    });

    it("should chunk large buffers into smaller pieces", () => {
      const audioChunkHandler = vi.fn();
      queue.on("audioChunk", audioChunkHandler);

      // Add buffer larger than chunk size (default 320 bytes)
      queue.enqueue(Buffer.alloc(1000));

      // Process multiple chunks
      vi.advanceTimersByTime(50); // Should process ~5 chunks at 10ms interval

      // Should have emitted multiple chunks
      expect(audioChunkHandler.mock.calls.length).toBeGreaterThan(1);
    });

    it("startPlayback should be idempotent", () => {
      const playbackStartedHandler = vi.fn();
      queue.on("playbackStarted", playbackStartedHandler);

      queue.enqueue(Buffer.from([1, 2, 3]));
      queue.startPlayback(); // Second call should do nothing
      queue.startPlayback(); // Third call should do nothing

      expect(playbackStartedHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Stop Playback Tests
  // ============================================================================

  describe("stopPlayback", () => {
    it("should stop playback timer", () => {
      const playbackStoppedHandler = vi.fn();
      queue.on("playbackStopped", playbackStoppedHandler);

      queue.enqueue(Buffer.alloc(1000));
      expect(queue.isCurrentlyPlaying()).toBe(true);

      queue.stopPlayback();

      expect(playbackStoppedHandler).toHaveBeenCalled();
      expect(queue.isCurrentlyPlaying()).toBe(false);
    });

    it("should be idempotent", () => {
      const playbackStoppedHandler = vi.fn();
      queue.on("playbackStopped", playbackStoppedHandler);

      queue.enqueue(Buffer.from([1, 2, 3]));
      queue.stopPlayback();
      queue.stopPlayback();
      queue.stopPlayback();

      expect(playbackStoppedHandler).toHaveBeenCalledTimes(1);
    });

    it("should reset current buffer state", () => {
      queue.enqueue(Buffer.alloc(1000));
      vi.advanceTimersByTime(10); // Process part of the buffer

      queue.stopPlayback();

      // Queue should still have data but not be playing
      expect(queue.isCurrentlyPlaying()).toBe(false);
    });
  });

  // ============================================================================
  // Clear Tests
  // ============================================================================

  describe("clear", () => {
    it("should clear all queued chunks", () => {
      queue.enqueue(Buffer.alloc(100));
      queue.enqueue(Buffer.alloc(100));
      queue.enqueue(Buffer.alloc(100));

      queue.clear();

      const stats = queue.getStats();
      expect(stats.queueLength).toBe(0);
    });

    it("should emit queueCleared event with count", () => {
      const queueClearedHandler = vi.fn();
      queue.on("queueCleared", queueClearedHandler);

      queue.enqueue(Buffer.alloc(100));
      queue.enqueue(Buffer.alloc(100));

      queue.clear();

      expect(queueClearedHandler).toHaveBeenCalledWith(expect.any(Number));
    });

    it("should not emit event if queue was already empty", () => {
      const queueClearedHandler = vi.fn();
      queue.on("queueCleared", queueClearedHandler);

      queue.clear();

      expect(queueClearedHandler).not.toHaveBeenCalled();
    });

    it("should stop playback if queue becomes empty", () => {
      queue.enqueue(Buffer.alloc(100));
      expect(queue.isCurrentlyPlaying()).toBe(true);

      queue.clear();

      expect(queue.isCurrentlyPlaying()).toBe(false);
    });
  });

  // ============================================================================
  // Interrupt Tests
  // ============================================================================

  describe("interrupt", () => {
    it("should clear queue and stop playback", () => {
      queue.enqueue(Buffer.alloc(100));
      queue.enqueue(Buffer.alloc(100));

      queue.interrupt();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.isCurrentlyPlaying()).toBe(false);
    });

    it("should emit interrupted event", () => {
      const interruptedHandler = vi.fn();
      queue.on("interrupted", interruptedHandler);

      queue.enqueue(Buffer.alloc(100));
      queue.interrupt();

      expect(interruptedHandler).toHaveBeenCalled();
    });

    it("should handle interrupt when already empty", () => {
      const interruptedHandler = vi.fn();
      queue.on("interrupted", interruptedHandler);

      queue.interrupt();

      expect(interruptedHandler).toHaveBeenCalled();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe("getStats", () => {
    it("should return accurate queue length", () => {
      queue.enqueue(Buffer.alloc(100));
      queue.enqueue(Buffer.alloc(100));

      const stats = queue.getStats();
      expect(stats.queueLength).toBe(2);
    });

    it("should track chunks processed", () => {
      queue.enqueue(Buffer.alloc(320)); // Single chunk size

      // Process the chunk
      vi.advanceTimersByTime(20);

      const stats = queue.getStats();
      expect(stats.chunksProcessed).toBeGreaterThan(0);
    });

    it("should track chunks dropped", () => {
      const smallQueue = new AudioQueue({ maxQueueSize: 2 });

      smallQueue.enqueue(Buffer.from([1]));
      smallQueue.enqueue(Buffer.from([2]));
      smallQueue.enqueue(Buffer.from([3])); // Drops first chunk

      const stats = smallQueue.getStats();
      expect(stats.chunksDropped).toBe(1);

      smallQueue.stopPlayback();
    });

    it("should report playing state", () => {
      expect(queue.getStats().isPlaying).toBe(false);

      queue.enqueue(Buffer.alloc(100));
      expect(queue.getStats().isPlaying).toBe(true);

      queue.stopPlayback();
      expect(queue.getStats().isPlaying).toBe(false);
    });
  });

  // ============================================================================
  // Duration Tests
  // ============================================================================

  describe("getQueueDurationMs", () => {
    it("should return 0 for empty queue", () => {
      expect(queue.getQueueDurationMs()).toBe(0);
    });

    it("should calculate duration based on buffer sizes", () => {
      // Default sample rate is 16000, so 320 bytes = 10ms
      queue.enqueue(Buffer.alloc(320));
      queue.enqueue(Buffer.alloc(320));

      const duration = queue.getQueueDurationMs();
      expect(duration).toBe(20); // 2 * 10ms
    });

    it("should work with custom sample rate", () => {
      const queue24k = new AudioQueue({ sampleRate: 24000 });

      // At 24kHz, 480 bytes = 10ms
      queue24k.enqueue(Buffer.alloc(480));

      const duration = queue24k.getQueueDurationMs();
      expect(duration).toBe(10);

      queue24k.stopPlayback();
    });
  });

  // ============================================================================
  // isEmpty Tests
  // ============================================================================

  describe("isEmpty", () => {
    it("should return true for empty queue", () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it("should return false when queue has data", () => {
      queue.enqueue(Buffer.from([1]));
      expect(queue.isEmpty()).toBe(false);
    });

    it("should return true after clearing", () => {
      queue.enqueue(Buffer.from([1]));
      queue.clear();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  // ============================================================================
  // Reset Stats Tests
  // ============================================================================

  describe("resetStats", () => {
    it("should reset processed and dropped counts", () => {
      const smallQueue = new AudioQueue({ maxQueueSize: 1 });

      smallQueue.enqueue(Buffer.from([1]));
      smallQueue.enqueue(Buffer.from([2])); // Drops first

      vi.advanceTimersByTime(100);

      // Stats should show activity
      let stats = smallQueue.getStats();
      expect(stats.chunksDropped).toBe(1);

      smallQueue.resetStats();

      stats = smallQueue.getStats();
      expect(stats.chunksProcessed).toBe(0);
      expect(stats.chunksDropped).toBe(0);

      smallQueue.stopPlayback();
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe("factory functions", () => {
    it("createOpenAIAudioQueue should create 24kHz queue", () => {
      const openaiQueue = createOpenAIAudioQueue();

      // At 24kHz with 480 byte chunks = 10ms
      openaiQueue.enqueue(Buffer.alloc(480));
      const duration = openaiQueue.getQueueDurationMs();

      expect(duration).toBe(10);
      openaiQueue.stopPlayback();
    });

    it("createGeminiAudioQueue should create 24kHz queue", () => {
      const geminiQueue = createGeminiAudioQueue();

      // At 24kHz with 480 byte chunks = 10ms
      geminiQueue.enqueue(Buffer.alloc(480));
      const duration = geminiQueue.getQueueDurationMs();

      expect(duration).toBe(10);
      geminiQueue.stopPlayback();
    });

    it("createWebRTCAudioQueue should create queue with custom sample rate", () => {
      const webrtcQueue48k = createWebRTCAudioQueue(48000);
      const webrtcQueue16k = createWebRTCAudioQueue(16000);

      // 48kHz: 960 bytes = 10ms
      webrtcQueue48k.enqueue(Buffer.alloc(960));
      expect(webrtcQueue48k.getQueueDurationMs()).toBe(10);

      // 16kHz: 320 bytes = 10ms
      webrtcQueue16k.enqueue(Buffer.alloc(320));
      expect(webrtcQueue16k.getQueueDurationMs()).toBe(10);

      webrtcQueue48k.stopPlayback();
      webrtcQueue16k.stopPlayback();
    });

    it("createWebRTCAudioQueue should default to 48kHz", () => {
      const webrtcQueue = createWebRTCAudioQueue();

      // 48kHz: 960 bytes = 10ms
      webrtcQueue.enqueue(Buffer.alloc(960));
      expect(webrtcQueue.getQueueDurationMs()).toBe(10);

      webrtcQueue.stopPlayback();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should handle continuous audio stream", () => {
      const audioChunkHandler = vi.fn();
      queue.on("audioChunk", audioChunkHandler);

      // Simulate continuous audio stream
      for (let i = 0; i < 10; i++) {
        queue.enqueue(Buffer.alloc(320)); // 10ms worth at 16kHz
      }

      // Process 50ms worth
      vi.advanceTimersByTime(50);

      expect(audioChunkHandler.mock.calls.length).toBeGreaterThan(0);
    });

    it("should handle interruption during playback", () => {
      const audioChunkHandler = vi.fn();
      const interruptedHandler = vi.fn();

      queue.on("audioChunk", audioChunkHandler);
      queue.on("interrupted", interruptedHandler);

      // Start playing
      queue.enqueue(Buffer.alloc(1000));
      vi.advanceTimersByTime(20);

      // Interrupt
      queue.interrupt();

      expect(interruptedHandler).toHaveBeenCalled();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.isCurrentlyPlaying()).toBe(false);
    });

    it("should resume after stop and enqueue", () => {
      const playbackStartedHandler = vi.fn();
      queue.on("playbackStarted", playbackStartedHandler);

      // First playback
      queue.enqueue(Buffer.from([1]));
      vi.advanceTimersByTime(100);

      // Should have stopped naturally
      expect(queue.isCurrentlyPlaying()).toBe(false);

      // Reset handler
      playbackStartedHandler.mockClear();

      // Resume with new data
      queue.enqueue(Buffer.from([2]));

      expect(playbackStartedHandler).toHaveBeenCalled();
      expect(queue.isCurrentlyPlaying()).toBe(true);
    });
  });
});
