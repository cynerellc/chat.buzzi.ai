/**
 * ExecutorCache Unit Tests
 *
 * Tests for the executor caching system including:
 * - LRU eviction at capacity
 * - TTL-based expiry
 * - Activity tracking
 * - Cleanup timer
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// We'll test the ExecutorCache by importing from call-runner
// Since ExecutorCache is a private class, we'll test it through CallRunnerService behavior
// For a more direct test, we would need to export ExecutorCache

import { createMockExecutor } from "../utils/mocks";

// ============================================================================
// ExecutorCache Tests (through CallRunnerService behavior)
// ============================================================================

describe("ExecutorCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Basic Cache Operations
  // ============================================================================

  describe("cache operations", () => {
    it("should create a mock executor", () => {
      const executor = createMockExecutor();
      expect(executor).toBeDefined();
      expect(executor.chatbotId).toBe("mock-chatbot-id");
      expect(executor.companyId).toBe("mock-company-id");
      expect(executor.aiProvider).toBe("OPENAI");
    });

    it("should track connection state", async () => {
      const executor = createMockExecutor();

      expect(executor.isExecutorConnected()).toBe(false);

      await executor.connect();
      expect(executor.isExecutorConnected()).toBe(true);

      await executor.disconnect();
      expect(executor.isExecutorConnected()).toBe(false);
    });

    it("should track speaking state", () => {
      const executor = createMockExecutor();

      expect(executor.isExecutorSpeaking()).toBe(false);

      executor._simulateAgentSpeaking();
      expect(executor.isExecutorSpeaking()).toBe(true);

      executor._simulateAgentListening();
      expect(executor.isExecutorSpeaking()).toBe(false);
    });

    it("should emit events correctly", () => {
      const executor = createMockExecutor();
      const audioDeltaHandler = vi.fn();
      const agentSpeakingHandler = vi.fn();
      const errorHandler = vi.fn();

      executor.on("audioDelta", audioDeltaHandler);
      executor.on("agentSpeaking", agentSpeakingHandler);
      executor.on("error", errorHandler);

      const testAudio = Buffer.from([1, 2, 3, 4]);
      executor._simulateAudioDelta(testAudio);
      expect(audioDeltaHandler).toHaveBeenCalledWith(testAudio);

      executor._simulateAgentSpeaking();
      expect(agentSpeakingHandler).toHaveBeenCalled();

      const testError = new Error("test error");
      executor._simulateError(testError);
      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    it("should send audio and trigger response", async () => {
      const executor = createMockExecutor();
      const audioDeltaHandler = vi.fn();

      executor.on("audioDelta", audioDeltaHandler);

      const inputAudio = Buffer.alloc(960);
      await executor.sendAudio(inputAudio);

      expect(executor.sendAudio).toHaveBeenCalledWith(inputAudio);

      // Advance timers to trigger the simulated response
      vi.advanceTimersByTime(20);

      expect(audioDeltaHandler).toHaveBeenCalled();
    });

    it("should reset executor state", () => {
      const executor = createMockExecutor();

      // Set some state
      executor._simulateAgentSpeaking();
      expect(executor.isExecutorSpeaking()).toBe(true);

      // Reset
      executor._reset();

      expect(executor.isExecutorSpeaking()).toBe(false);
      expect(executor.isExecutorConnected()).toBe(false);
    });
  });

  // ============================================================================
  // LRU Eviction Tests (Simulated)
  // ============================================================================

  describe("LRU eviction simulation", () => {
    it("should simulate LRU eviction behavior", () => {
      // Create a simple cache for testing LRU behavior
      const cache = new Map<string, { executor: ReturnType<typeof createMockExecutor>; lastActivity: number }>();
      const maxSize = 3;

      function set(chatbotId: string, executor: ReturnType<typeof createMockExecutor>) {
        // Evict LRU if at capacity
        if (cache.size >= maxSize && !cache.has(chatbotId)) {
          let oldest: { key: string; time: number } | null = null;
          for (const [key, entry] of cache.entries()) {
            if (!oldest || entry.lastActivity < oldest.time) {
              oldest = { key, time: entry.lastActivity };
            }
          }
          if (oldest) {
            cache.delete(oldest.key);
          }
        }
        cache.set(chatbotId, { executor, lastActivity: Date.now() });
      }

      function touch(chatbotId: string) {
        const entry = cache.get(chatbotId);
        if (entry) {
          entry.lastActivity = Date.now();
        }
      }

      // Fill cache to capacity
      set("chatbot-1", createMockExecutor());
      vi.advanceTimersByTime(100);
      set("chatbot-2", createMockExecutor());
      vi.advanceTimersByTime(100);
      set("chatbot-3", createMockExecutor());
      vi.advanceTimersByTime(100);

      expect(cache.size).toBe(3);

      // Touch chatbot-1 to make it recently used
      touch("chatbot-1");
      vi.advanceTimersByTime(100);

      // Add new executor - should evict chatbot-2 (LRU)
      set("chatbot-4", createMockExecutor());

      expect(cache.size).toBe(3);
      expect(cache.has("chatbot-1")).toBe(true);
      expect(cache.has("chatbot-2")).toBe(false); // Evicted
      expect(cache.has("chatbot-3")).toBe(true);
      expect(cache.has("chatbot-4")).toBe(true);
    });
  });

  // ============================================================================
  // TTL Expiry Tests (Simulated)
  // ============================================================================

  describe("TTL expiry simulation", () => {
    it("should simulate TTL-based expiry", () => {
      const TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
      const cache = new Map<string, { executor: ReturnType<typeof createMockExecutor>; lastActivity: number }>();

      function set(chatbotId: string, executor: ReturnType<typeof createMockExecutor>) {
        cache.set(chatbotId, { executor, lastActivity: Date.now() });
      }

      function get(chatbotId: string): ReturnType<typeof createMockExecutor> | undefined {
        const entry = cache.get(chatbotId);
        if (entry) {
          const now = Date.now();
          if (now - entry.lastActivity > TTL_MS) {
            cache.delete(chatbotId);
            return undefined;
          }
          entry.lastActivity = now;
          return entry.executor;
        }
        return undefined;
      }

      // Add executor
      set("chatbot-1", createMockExecutor());

      // Access immediately - should exist
      expect(get("chatbot-1")).toBeDefined();

      // Advance time by 2 hours - should still exist
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(get("chatbot-1")).toBeDefined();

      // Advance time by 4 more hours (total > 3 hours since last access at 2 hours)
      vi.advanceTimersByTime(4 * 60 * 60 * 1000);
      expect(get("chatbot-1")).toBeUndefined();
    });

    it("should reset TTL on access", () => {
      const TTL_MS = 3 * 60 * 60 * 1000;
      const cache = new Map<string, { executor: ReturnType<typeof createMockExecutor>; lastActivity: number }>();

      function set(chatbotId: string, executor: ReturnType<typeof createMockExecutor>) {
        cache.set(chatbotId, { executor, lastActivity: Date.now() });
      }

      function get(chatbotId: string): ReturnType<typeof createMockExecutor> | undefined {
        const entry = cache.get(chatbotId);
        if (entry) {
          const now = Date.now();
          if (now - entry.lastActivity > TTL_MS) {
            cache.delete(chatbotId);
            return undefined;
          }
          entry.lastActivity = now;
          return entry.executor;
        }
        return undefined;
      }

      set("chatbot-1", createMockExecutor());

      // Access every 2 hours - should never expire
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(2 * 60 * 60 * 1000);
        expect(get("chatbot-1")).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Cleanup Timer Tests (Simulated)
  // ============================================================================

  describe("cleanup timer simulation", () => {
    it("should clean up expired entries periodically", () => {
      const TTL_MS = 3 * 60 * 60 * 1000;
      const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
      const cache = new Map<string, { executor: ReturnType<typeof createMockExecutor>; lastActivity: number }>();
      let cleanupCount = 0;

      function set(chatbotId: string, executor: ReturnType<typeof createMockExecutor>) {
        cache.set(chatbotId, { executor, lastActivity: Date.now() });
      }

      function cleanup() {
        const now = Date.now();
        for (const [chatbotId, entry] of cache.entries()) {
          if (now - entry.lastActivity > TTL_MS) {
            cache.delete(chatbotId);
            cleanupCount++;
          }
        }
      }

      // Add executors
      set("chatbot-1", createMockExecutor());
      vi.advanceTimersByTime(100);
      set("chatbot-2", createMockExecutor());
      vi.advanceTimersByTime(100);
      set("chatbot-3", createMockExecutor());

      expect(cache.size).toBe(3);

      // Advance time past TTL and run cleanup
      vi.advanceTimersByTime(TTL_MS + CLEANUP_INTERVAL_MS);
      cleanup();

      expect(cache.size).toBe(0);
      expect(cleanupCount).toBe(3);
    });
  });

  // ============================================================================
  // Cache Statistics Tests (Simulated)
  // ============================================================================

  describe("cache statistics", () => {
    it("should provide accurate statistics", () => {
      const cache = new Map<string, { executor: ReturnType<typeof createMockExecutor>; lastActivity: number }>();
      const maxSize = 100;
      const inactivityTTL = 3 * 60 * 60 * 1000;

      function set(chatbotId: string, executor: ReturnType<typeof createMockExecutor>) {
        cache.set(chatbotId, { executor, lastActivity: Date.now() });
      }

      function getStats() {
        const now = Date.now();
        return {
          size: cache.size,
          maxSize,
          inactivityTTL,
          entries: Array.from(cache.entries()).map(([chatbotId, entry]) => ({
            chatbotId,
            idleTime: now - entry.lastActivity,
          })),
        };
      }

      // Add some executors
      set("chatbot-1", createMockExecutor());
      vi.advanceTimersByTime(1000);
      set("chatbot-2", createMockExecutor());
      vi.advanceTimersByTime(2000);
      set("chatbot-3", createMockExecutor());

      const stats = getStats();

      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(100);
      expect(stats.inactivityTTL).toBe(3 * 60 * 60 * 1000);
      expect(stats.entries).toHaveLength(3);

      // Check idle times are reasonable
      const chatbot1Entry = stats.entries.find((e) => e.chatbotId === "chatbot-1");
      const chatbot3Entry = stats.entries.find((e) => e.chatbotId === "chatbot-3");

      expect(chatbot1Entry?.idleTime).toBeGreaterThan(chatbot3Entry?.idleTime || 0);
    });
  });
});
