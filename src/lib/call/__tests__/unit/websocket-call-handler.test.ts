/**
 * WebSocketCallHandler Unit Tests
 *
 * Tests for the WebSocket-based call handler including:
 * - Message parsing
 * - Audio encoding/decoding
 * - Event emission
 * - WebSocket lifecycle
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WebSocketCallHandler, WEBSOCKET_EVENTS } from "../../handlers/websocket-call-handler";
import { createMockWebSocket } from "../utils/mocks";

// ============================================================================
// Tests
// ============================================================================

describe("WebSocketCallHandler", () => {
  let handler: WebSocketCallHandler;
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    handler = new WebSocketCallHandler(mockWs as unknown as WebSocket, "test-session-123", "test-call-456");
  });

  afterEach(() => {
    handler.removeAllListeners();
    mockWs._reset();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with provided session and call IDs", () => {
      expect(handler.getSessionId()).toBe("test-session-123");
      expect(handler.getCallId()).toBe("test-call-456");
    });

    it("should start inactive", () => {
      expect(handler.isHandlerActive()).toBe(false);
    });
  });

  // ============================================================================
  // Start Tests
  // ============================================================================

  describe("start", () => {
    it("should set up WebSocket handlers", async () => {
      await handler.start();

      // Should have registered message, close, and error handlers
      expect(mockWs.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should set handler as active", async () => {
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);
    });

    it("should send status message to client", async () => {
      await handler.start();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.STATUS)
      );
    });
  });

  // ============================================================================
  // Message Handling Tests
  // ============================================================================

  describe("message handling", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should handle start_call message", () => {
      const callStartedHandler = vi.fn();
      handler.on("callStarted", callStartedHandler);

      // Simulate client sending start_call
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.START_CALL,
          data: { name: "Test User", email: "test@example.com" },
        })
      );

      expect(callStartedHandler).toHaveBeenCalled();
    });

    it("should handle audio_data message", () => {
      const audioReceivedHandler = vi.fn();
      handler.on("audioReceived", audioReceivedHandler);

      // Create test audio and encode as base64
      const testAudio = Buffer.from([1, 2, 3, 4, 5]);
      const base64Audio = testAudio.toString("base64");

      // Simulate client sending audio
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.AUDIO_DATA,
          data: { audio: base64Audio },
        })
      );

      expect(audioReceivedHandler).toHaveBeenCalled();
      // Verify the audio was decoded correctly
      const receivedAudio = audioReceivedHandler.mock.calls[0][0];
      expect(receivedAudio).toEqual(testAudio);
    });

    it("should handle end_call message", () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      // Simulate client ending call
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.END_CALL,
        })
      );

      expect(callEndedHandler).toHaveBeenCalledWith("User ended call");
    });

    it("should handle invalid message format", () => {
      // Should not throw when receiving invalid JSON
      mockWs._simulateMessage("not valid json");

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.ERROR)
      );
    });

    it("should ignore unknown event types", () => {
      const errorHandler = vi.fn();
      handler.on("error", errorHandler);

      mockWs._simulateMessage(
        JSON.stringify({
          type: "unknown_event",
          data: {},
        })
      );

      // Should not emit error
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("should ignore empty audio data", () => {
      const audioReceivedHandler = vi.fn();
      handler.on("audioReceived", audioReceivedHandler);

      // Send message with no audio
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.AUDIO_DATA,
          data: {},
        })
      );

      expect(audioReceivedHandler).not.toHaveBeenCalled();
    });

    it("should ignore empty audio buffer", () => {
      const audioReceivedHandler = vi.fn();
      handler.on("audioReceived", audioReceivedHandler);

      // Send message with empty audio
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.AUDIO_DATA,
          data: { audio: "" },
        })
      );

      expect(audioReceivedHandler).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Send Audio Tests
  // ============================================================================

  describe("sendAudio", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should send base64 encoded audio to client", async () => {
      const testAudio = Buffer.from([10, 20, 30, 40, 50]);
      await handler.sendAudio(testAudio);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.AUDIO_RESPONSE)
      );

      // Verify the sent message contains base64 audio
      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0] as string);
      expect(message.type).toBe(WEBSOCKET_EVENTS.AUDIO_RESPONSE);
      expect(message.data.audio).toBe(testAudio.toString("base64"));
    });

    it("should not send if WebSocket is closed", async () => {
      // Close the WebSocket
      mockWs._simulateClose();

      // Clear previous send calls
      mockWs.send.mockClear();

      await handler.sendAudio(Buffer.from([1, 2, 3]));

      // Should not have sent anything
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // End Tests
  // ============================================================================

  describe("end", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should send call_ended message to client", async () => {
      await handler.end("Test reason");

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.CALL_ENDED)
      );

      // Verify the message contains the reason
      const calls = mockWs.send.mock.calls;
      const endedCall = calls.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.type === WEBSOCKET_EVENTS.CALL_ENDED;
      });
      expect(endedCall).toBeDefined();
      const message = JSON.parse(endedCall![0] as string);
      expect(message.data.reason).toBe("Test reason");
    });

    it("should close WebSocket connection", async () => {
      await handler.end();

      expect(mockWs.close).toHaveBeenCalled();
    });

    it("should set handler as inactive", async () => {
      await handler.end();

      expect(handler.isHandlerActive()).toBe(false);
    });

    it("should emit callEnded event", async () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      await handler.end("Normal end");

      expect(callEndedHandler).toHaveBeenCalledWith("Normal end");
    });

    it("should handle end without reason", async () => {
      await handler.end();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Call ended")
      );
    });
  });

  // ============================================================================
  // WebSocket Event Tests
  // ============================================================================

  describe("WebSocket events", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should handle WebSocket close event", () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      mockWs._simulateClose();

      expect(callEndedHandler).toHaveBeenCalledWith("Client disconnected");
    });

    it("should handle WebSocket error event", () => {
      const errorHandler = vi.fn();
      handler.on("error", errorHandler);

      const testError = new Error("WebSocket error");
      mockWs._simulateError(testError);

      expect(errorHandler).toHaveBeenCalledWith(testError);
    });
  });

  // ============================================================================
  // Public Event Handler Tests
  // ============================================================================

  describe("public event handlers", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("handleTranscript should send transcript to client", () => {
      handler.handleTranscript("Hello, world!", "assistant");

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.TRANSCRIPT)
      );

      const calls = mockWs.send.mock.calls;
      const transcriptCall = calls.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.type === WEBSOCKET_EVENTS.TRANSCRIPT;
      });
      const message = JSON.parse(transcriptCall![0] as string);
      expect(message.data.text).toBe("Hello, world!");
      expect(message.data.role).toBe("assistant");
    });

    it("handleAgentSpeaking should send agent_speaking to client", () => {
      handler.handleAgentSpeaking();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.AGENT_SPEAKING)
      );
    });

    it("handleAgentListening should send agent_listening to client", () => {
      handler.handleAgentListening();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.AGENT_LISTENING)
      );
    });

    it("handleUserInterrupted should send stop_audio to client", () => {
      handler.handleUserInterrupted();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(WEBSOCKET_EVENTS.STOP_AUDIO)
      );
    });

    it("should not send events when disconnected", () => {
      mockWs._simulateClose();
      mockWs.send.mockClear();

      handler.handleTranscript("Test", "user");
      handler.handleAgentSpeaking();
      handler.handleAgentListening();
      handler.handleUserInterrupted();

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should handle full call lifecycle", async () => {
      const callStartedHandler = vi.fn();
      const audioReceivedHandler = vi.fn();
      const callEndedHandler = vi.fn();

      handler.on("callStarted", callStartedHandler);
      handler.on("audioReceived", audioReceivedHandler);
      handler.on("callEnded", callEndedHandler);

      // Start handler
      await handler.start();

      // Client starts call
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.START_CALL,
          data: {},
        })
      );
      expect(callStartedHandler).toHaveBeenCalled();

      // Client sends audio
      const audio = Buffer.from([1, 2, 3]);
      mockWs._simulateMessage(
        JSON.stringify({
          type: WEBSOCKET_EVENTS.AUDIO_DATA,
          data: { audio: audio.toString("base64") },
        })
      );
      expect(audioReceivedHandler).toHaveBeenCalled();

      // End call
      await handler.end("Call completed");
      expect(callEndedHandler).toHaveBeenCalledWith("Call completed");
    });

    it("should handle multiple audio chunks", async () => {
      const audioReceivedHandler = vi.fn();
      handler.on("audioReceived", audioReceivedHandler);

      await handler.start();

      // Send multiple audio chunks
      for (let i = 0; i < 5; i++) {
        const audio = Buffer.from([i, i + 1, i + 2]);
        mockWs._simulateMessage(
          JSON.stringify({
            type: WEBSOCKET_EVENTS.AUDIO_DATA,
            data: { audio: audio.toString("base64") },
          })
        );
      }

      expect(audioReceivedHandler).toHaveBeenCalledTimes(5);
    });

    it("should handle rapid start/end cycle", async () => {
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);

      await handler.end();
      expect(handler.isHandlerActive()).toBe(false);
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe("WEBSOCKET_EVENTS constants", () => {
    it("should define all expected event types", () => {
      expect(WEBSOCKET_EVENTS.START_CALL).toBe("start_call");
      expect(WEBSOCKET_EVENTS.AUDIO_DATA).toBe("audio_data");
      expect(WEBSOCKET_EVENTS.END_CALL).toBe("end_call");
      expect(WEBSOCKET_EVENTS.STATUS).toBe("status");
      expect(WEBSOCKET_EVENTS.CALL_STARTED).toBe("call_started");
      expect(WEBSOCKET_EVENTS.CALL_ENDED).toBe("call_ended");
      expect(WEBSOCKET_EVENTS.AUDIO_RESPONSE).toBe("audio_response");
      expect(WEBSOCKET_EVENTS.TRANSCRIPT).toBe("transcript");
      expect(WEBSOCKET_EVENTS.AGENT_SPEAKING).toBe("agent_speaking");
      expect(WEBSOCKET_EVENTS.AGENT_LISTENING).toBe("agent_listening");
      expect(WEBSOCKET_EVENTS.STOP_AUDIO).toBe("stop_audio");
      expect(WEBSOCKET_EVENTS.ERROR).toBe("error");
    });
  });
});
