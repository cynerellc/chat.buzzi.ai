/**
 * BaseCallHandler Unit Tests
 *
 * Tests for the abstract base class for call handlers.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BaseCallHandler, isCallHandler } from "../../handlers/base-call-handler";

// ============================================================================
// Test Implementation
// ============================================================================

class TestCallHandler extends BaseCallHandler {
  public startCalled = false;
  public handleAudioCalled = false;
  public sendAudioCalled = false;
  public endCalled = false;
  public lastAudioData: Buffer | null = null;
  public lastEndReason: string | undefined = undefined;

  async start(): Promise<void> {
    this.startCalled = true;
    this.isActive = true;
    this.emitCallStarted();
  }

  async handleAudio(audioData: Buffer): Promise<void> {
    this.handleAudioCalled = true;
    this.lastAudioData = audioData;
    this.emitAudioReceived(audioData);
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    this.sendAudioCalled = true;
    this.lastAudioData = audioData;
  }

  async end(reason?: string): Promise<void> {
    this.endCalled = true;
    this.lastEndReason = reason;
    this.isActive = false;
    this.emitCallEnded(reason);
  }

  // Expose protected methods for testing
  public testEmitAudioReceived(audioData: Buffer): void {
    this.emitAudioReceived(audioData);
  }

  public testEmitCallStarted(): void {
    this.emitCallStarted();
  }

  public testEmitCallEnded(reason?: string): void {
    this.emitCallEnded(reason);
  }

  public testEmitError(error: Error): void {
    this.emitError(error);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("BaseCallHandler", () => {
  let handler: TestCallHandler;

  beforeEach(() => {
    handler = new TestCallHandler("test-session-123", "test-call-456");
  });

  afterEach(() => {
    handler.removeAllListeners();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with provided sessionId and callId", () => {
      expect(handler.getSessionId()).toBe("test-session-123");
      expect(handler.getCallId()).toBe("test-call-456");
    });

    it("should start with isActive = false", () => {
      expect(handler.isHandlerActive()).toBe(false);
    });
  });

  // ============================================================================
  // Getter Tests
  // ============================================================================

  describe("getters", () => {
    it("getSessionId should return the session ID", () => {
      expect(handler.getSessionId()).toBe("test-session-123");
    });

    it("getCallId should return the call ID", () => {
      expect(handler.getCallId()).toBe("test-call-456");
    });

    it("isHandlerActive should return current active state", () => {
      expect(handler.isHandlerActive()).toBe(false);
    });

    it("isHandlerActive should update when start is called", async () => {
      expect(handler.isHandlerActive()).toBe(false);
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);
    });

    it("isHandlerActive should update when end is called", async () => {
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);
      await handler.end();
      expect(handler.isHandlerActive()).toBe(false);
    });
  });

  // ============================================================================
  // Abstract Method Tests
  // ============================================================================

  describe("abstract methods", () => {
    it("start should be called correctly", async () => {
      expect(handler.startCalled).toBe(false);
      await handler.start();
      expect(handler.startCalled).toBe(true);
    });

    it("handleAudio should receive audio data", async () => {
      const audioData = Buffer.from([1, 2, 3, 4, 5]);
      await handler.handleAudio(audioData);

      expect(handler.handleAudioCalled).toBe(true);
      expect(handler.lastAudioData).toEqual(audioData);
    });

    it("sendAudio should receive audio data", async () => {
      const audioData = Buffer.from([10, 20, 30, 40, 50]);
      await handler.sendAudio(audioData);

      expect(handler.sendAudioCalled).toBe(true);
      expect(handler.lastAudioData).toEqual(audioData);
    });

    it("end should receive reason", async () => {
      await handler.end("user_hangup");

      expect(handler.endCalled).toBe(true);
      expect(handler.lastEndReason).toBe("user_hangup");
    });

    it("end should work without reason", async () => {
      await handler.end();

      expect(handler.endCalled).toBe(true);
      expect(handler.lastEndReason).toBeUndefined();
    });
  });

  // ============================================================================
  // Event Emitter Tests
  // ============================================================================

  describe("event emitters", () => {
    it("emitAudioReceived should emit audioReceived event", () => {
      const audioHandler = vi.fn();
      handler.on("audioReceived", audioHandler);

      const audioData = Buffer.from([1, 2, 3]);
      handler.testEmitAudioReceived(audioData);

      expect(audioHandler).toHaveBeenCalledTimes(1);
      expect(audioHandler).toHaveBeenCalledWith(audioData);
    });

    it("emitCallStarted should emit callStarted event", () => {
      const startHandler = vi.fn();
      handler.on("callStarted", startHandler);

      handler.testEmitCallStarted();

      expect(startHandler).toHaveBeenCalledTimes(1);
    });

    it("emitCallEnded should emit callEnded event with reason", () => {
      const endHandler = vi.fn();
      handler.on("callEnded", endHandler);

      handler.testEmitCallEnded("timeout");

      expect(endHandler).toHaveBeenCalledTimes(1);
      expect(endHandler).toHaveBeenCalledWith("timeout");
    });

    it("emitCallEnded should emit callEnded event without reason", () => {
      const endHandler = vi.fn();
      handler.on("callEnded", endHandler);

      handler.testEmitCallEnded();

      expect(endHandler).toHaveBeenCalledTimes(1);
      expect(endHandler).toHaveBeenCalledWith(undefined);
    });

    it("emitError should emit error event", () => {
      const errorHandler = vi.fn();
      handler.on("error", errorHandler);

      const error = new Error("test error");
      handler.testEmitError(error);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(error);
    });
  });

  // ============================================================================
  // Typed Event Listener Tests
  // ============================================================================

  describe("typed event listeners", () => {
    it("on should register typed event handlers", () => {
      const audioHandler = vi.fn();
      const startHandler = vi.fn();
      const endHandler = vi.fn();
      const errorHandler = vi.fn();

      handler.on("audioReceived", audioHandler);
      handler.on("callStarted", startHandler);
      handler.on("callEnded", endHandler);
      handler.on("error", errorHandler);

      // Trigger all events
      handler.testEmitAudioReceived(Buffer.from([1]));
      handler.testEmitCallStarted();
      handler.testEmitCallEnded("test");
      handler.testEmitError(new Error("test"));

      expect(audioHandler).toHaveBeenCalled();
      expect(startHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
    });

    it("once should register one-time event handlers", () => {
      const startHandler = vi.fn();
      handler.once("callStarted", startHandler);

      handler.testEmitCallStarted();
      handler.testEmitCallStarted();

      expect(startHandler).toHaveBeenCalledTimes(1);
    });

    it("emit should return true when listeners exist", () => {
      handler.on("callStarted", vi.fn());

      const result = handler.emit("callStarted");
      expect(result).toBe(true);
    });

    it("emit should return false when no listeners exist", () => {
      const result = handler.emit("callStarted");
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should emit callStarted when start is called", async () => {
      const startHandler = vi.fn();
      handler.on("callStarted", startHandler);

      await handler.start();

      expect(startHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit audioReceived when handleAudio is called", async () => {
      const audioHandler = vi.fn();
      handler.on("audioReceived", audioHandler);

      const audioData = Buffer.from([1, 2, 3]);
      await handler.handleAudio(audioData);

      expect(audioHandler).toHaveBeenCalledWith(audioData);
    });

    it("should emit callEnded when end is called", async () => {
      const endHandler = vi.fn();
      handler.on("callEnded", endHandler);

      await handler.end("normal");

      expect(endHandler).toHaveBeenCalledWith("normal");
    });

    it("should handle full lifecycle", async () => {
      const startHandler = vi.fn();
      const audioHandler = vi.fn();
      const endHandler = vi.fn();

      handler.on("callStarted", startHandler);
      handler.on("audioReceived", audioHandler);
      handler.on("callEnded", endHandler);

      // Start call
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);
      expect(startHandler).toHaveBeenCalled();

      // Send audio
      const audio1 = Buffer.from([1, 2, 3]);
      const audio2 = Buffer.from([4, 5, 6]);
      await handler.handleAudio(audio1);
      await handler.handleAudio(audio2);
      expect(audioHandler).toHaveBeenCalledTimes(2);

      // End call
      await handler.end("completed");
      expect(handler.isHandlerActive()).toBe(false);
      expect(endHandler).toHaveBeenCalledWith("completed");
    });
  });

  // ============================================================================
  // Type Guard Tests
  // ============================================================================

  describe("isCallHandler type guard", () => {
    it("should return true for BaseCallHandler instances", () => {
      expect(isCallHandler(handler)).toBe(true);
    });

    it("should return false for non-handler objects", () => {
      expect(isCallHandler({})).toBe(false);
      expect(isCallHandler(null)).toBe(false);
      expect(isCallHandler(undefined)).toBe(false);
      expect(isCallHandler("string")).toBe(false);
      expect(isCallHandler(123)).toBe(false);
      expect(isCallHandler({ isHandlerActive: () => true })).toBe(false);
    });
  });
});
