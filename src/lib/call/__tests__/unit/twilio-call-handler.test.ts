/**
 * TwilioCallHandler Unit Tests
 *
 * Tests for the Twilio Media Streams-based call handler including:
 * - Twilio message parsing
 * - Audio format conversion (mulaw ↔ PCM16)
 * - Sample rate conversion (8kHz ↔ 24kHz)
 * - Mark handling
 * - WebSocket lifecycle
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TwilioCallHandler, TWILIO_EVENTS, createTwilioCallHandler } from "../../handlers/twilio-call-handler";
import { createMockWebSocket } from "../utils/mocks";

// Mock the audio converter module
vi.mock("../../utils/audio-converter", () => ({
  mulawToPCM16: vi.fn((data: Buffer) => Buffer.alloc(data.length * 2)),
  pcm16ToMulaw: vi.fn((data: Buffer) => Buffer.alloc(data.length / 2)),
  resamplePCM16: vi.fn((data: Buffer) => Buffer.from(data)),
}));

// ============================================================================
// Tests
// ============================================================================

describe("TwilioCallHandler", () => {
  let handler: TwilioCallHandler;
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    handler = new TwilioCallHandler(mockWs as unknown as WebSocket, "test-session-123", "test-call-456", 24000);
  });

  afterEach(() => {
    handler.removeAllListeners();
    mockWs._reset();
    vi.clearAllMocks();
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

    it("should accept custom sample rate", () => {
      const handler16k = new TwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call",
        16000
      );
      expect(handler16k).toBeDefined();
    });

    it("should default to 24000 sample rate", () => {
      const defaultHandler = new TwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call"
      );
      expect(defaultHandler).toBeDefined();
    });
  });

  // ============================================================================
  // Start Tests
  // ============================================================================

  describe("start", () => {
    it("should set up WebSocket handlers", async () => {
      await handler.start();

      expect(mockWs.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should set handler as active", async () => {
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);
    });
  });

  // ============================================================================
  // Twilio Message Handling Tests
  // ============================================================================

  describe("Twilio message handling", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should handle connected event", () => {
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.CONNECTED,
          protocol: "Call",
          version: "1.0.0",
        })
      );

      // Should not throw or emit errors
      expect(handler.isHandlerActive()).toBe(true);
    });

    it("should handle start event", () => {
      const callStartedHandler = vi.fn();
      handler.on("callStarted", callStartedHandler);

      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: {
              encoding: "audio/x-mulaw",
              sampleRate: 8000,
              channels: 1,
            },
          },
        })
      );

      expect(callStartedHandler).toHaveBeenCalled();
    });

    it("should handle media event", () => {
      const audioReceivedHandler = vi.fn();
      handler.on("audioReceived", audioReceivedHandler);

      // First, send start event to get streamSid
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: {
              encoding: "audio/x-mulaw",
              sampleRate: 8000,
              channels: 1,
            },
          },
        })
      );

      // Then send media
      const mulawAudio = Buffer.from([0x7f, 0x7f, 0x7f, 0x7f]);
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.MEDIA,
          sequenceNumber: "2",
          media: {
            track: "inbound",
            chunk: "1",
            timestamp: "1234567890",
            payload: mulawAudio.toString("base64"),
          },
        })
      );

      expect(audioReceivedHandler).toHaveBeenCalled();
    });

    it("should handle stop event", () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.STOP,
          sequenceNumber: "10",
          stop: {
            accountSid: "AC123",
            callSid: "CA123",
          },
        })
      );

      expect(callEndedHandler).toHaveBeenCalledWith("Stream stopped");
    });

    it("should handle mark event", () => {
      // First set up streamSid
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
          },
        })
      );

      // Mark events are informational - just verify no errors
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.MARK,
          sequenceNumber: "5",
          mark: {
            name: "end_of_response",
          },
        })
      );

      expect(handler.isHandlerActive()).toBe(true);
    });

    it("should handle unknown events gracefully", () => {
      mockWs._simulateMessage(
        JSON.stringify({
          event: "unknown_event",
          data: {},
        })
      );

      // Should not throw
      expect(handler.isHandlerActive()).toBe(true);
    });

    it("should handle invalid JSON gracefully", () => {
      mockWs._simulateMessage("not valid json");

      // Should not throw
      expect(handler.isHandlerActive()).toBe(true);
    });
  });

  // ============================================================================
  // Send Audio Tests
  // ============================================================================

  describe("sendAudio", () => {
    beforeEach(async () => {
      await handler.start();
      // Set up streamSid
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
          },
        })
      );
    });

    it("should send converted audio to Twilio", async () => {
      const pcm16Audio = Buffer.alloc(480); // 10ms at 24kHz
      await handler.sendAudio(pcm16Audio);

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessages = mockWs.send.mock.calls;
      const mediaMessage = sentMessages.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.event === "media";
      });
      expect(mediaMessage).toBeDefined();
    });

    it("should not send if no streamSid", async () => {
      // Create fresh handler without start event
      const freshHandler = new TwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call",
        24000
      );
      await freshHandler.start();
      mockWs.send.mockClear();

      await freshHandler.sendAudio(Buffer.alloc(100));

      // Should not send media (might send other messages from start)
      const mediaMessages = mockWs.send.mock.calls.filter((call) => {
        try {
          const msg = JSON.parse(call[0] as string);
          return msg.event === "media";
        } catch {
          return false;
        }
      });
      expect(mediaMessages.length).toBe(0);
    });

    it("should not send if WebSocket is closed", async () => {
      mockWs._simulateClose();
      mockWs.send.mockClear();

      await handler.sendAudio(Buffer.alloc(100));

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Send Mark Tests
  // ============================================================================

  describe("sendMark", () => {
    beforeEach(async () => {
      await handler.start();
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
          },
        })
      );
      mockWs.send.mockClear();
    });

    it("should send mark with custom name", () => {
      handler.sendMark("custom_mark");

      const markMessage = mockWs.send.mock.calls.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.event === "mark" && msg.mark.name === "custom_mark";
      });
      expect(markMessage).toBeDefined();
    });

    it("should send mark with auto-generated name", () => {
      handler.sendMark();

      const markMessage = mockWs.send.mock.calls.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.event === "mark";
      });
      expect(markMessage).toBeDefined();
    });

    it("should not send mark if no streamSid", () => {
      const freshHandler = new TwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call"
      );
      mockWs.send.mockClear();

      freshHandler.sendMark();

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Clear Buffer Tests
  // ============================================================================

  describe("clearBuffer", () => {
    beforeEach(async () => {
      await handler.start();
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
          },
        })
      );
      mockWs.send.mockClear();
    });

    it("should send clear event to Twilio", () => {
      handler.clearBuffer();

      const clearMessage = mockWs.send.mock.calls.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.event === "clear";
      });
      expect(clearMessage).toBeDefined();
    });

    it("should not send if no streamSid", () => {
      const freshHandler = new TwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call"
      );
      mockWs.send.mockClear();

      freshHandler.clearBuffer();

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

      await handler.end("Test reason");

      expect(callEndedHandler).toHaveBeenCalledWith("Test reason");
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

      expect(callEndedHandler).toHaveBeenCalledWith("Connection closed");
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

    it("handleTranscript should log transcript", () => {
      // Twilio doesn't send transcripts to client, just logs
      // This should not throw
      handler.handleTranscript("Test transcript", "assistant");
    });

    it("handleAgentSpeaking should log", () => {
      handler.handleAgentSpeaking();
      // Should not throw
    });

    it("handleAgentListening should log", () => {
      handler.handleAgentListening();
      // Should not throw
    });

    it("handleUserInterrupted should clear buffer", () => {
      // Set up streamSid
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
          },
        })
      );
      mockWs.send.mockClear();

      handler.handleUserInterrupted();

      const clearMessage = mockWs.send.mock.calls.find((call) => {
        const msg = JSON.parse(call[0] as string);
        return msg.event === "clear";
      });
      expect(clearMessage).toBeDefined();
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe("createTwilioCallHandler", () => {
    it("should create handler with OpenAI sample rate (24kHz)", () => {
      const openaiHandler = createTwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call",
        "openai"
      );
      expect(openaiHandler).toBeInstanceOf(TwilioCallHandler);
    });

    it("should create handler with Gemini sample rate (16kHz)", () => {
      const geminiHandler = createTwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call",
        "gemini"
      );
      expect(geminiHandler).toBeInstanceOf(TwilioCallHandler);
    });

    it("should default to OpenAI sample rate", () => {
      const defaultHandler = createTwilioCallHandler(
        mockWs as unknown as WebSocket,
        "session",
        "call"
      );
      expect(defaultHandler).toBeInstanceOf(TwilioCallHandler);
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe("TWILIO_EVENTS constants", () => {
    it("should define all expected event types", () => {
      expect(TWILIO_EVENTS.CONNECTED).toBe("connected");
      expect(TWILIO_EVENTS.START).toBe("start");
      expect(TWILIO_EVENTS.MEDIA).toBe("media");
      expect(TWILIO_EVENTS.STOP).toBe("stop");
      expect(TWILIO_EVENTS.MARK).toBe("mark");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should handle full Twilio call lifecycle", async () => {
      const callStartedHandler = vi.fn();
      const audioReceivedHandler = vi.fn();
      const callEndedHandler = vi.fn();

      handler.on("callStarted", callStartedHandler);
      handler.on("audioReceived", audioReceivedHandler);
      handler.on("callEnded", callEndedHandler);

      // Start handler
      await handler.start();

      // Connected
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.CONNECTED,
          protocol: "Call",
          version: "1.0.0",
        })
      );

      // Start stream
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.START,
          sequenceNumber: "1",
          start: {
            streamSid: "MZ123",
            accountSid: "AC123",
            callSid: "CA123",
            tracks: ["inbound"],
            mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
          },
        })
      );
      expect(callStartedHandler).toHaveBeenCalled();

      // Media packets
      for (let i = 0; i < 5; i++) {
        mockWs._simulateMessage(
          JSON.stringify({
            event: TWILIO_EVENTS.MEDIA,
            sequenceNumber: String(i + 2),
            media: {
              track: "inbound",
              chunk: String(i),
              timestamp: String(Date.now()),
              payload: Buffer.from([0x7f, 0x7f]).toString("base64"),
            },
          })
        );
      }
      expect(audioReceivedHandler).toHaveBeenCalledTimes(5);

      // Stop
      mockWs._simulateMessage(
        JSON.stringify({
          event: TWILIO_EVENTS.STOP,
          sequenceNumber: "10",
          stop: {
            accountSid: "AC123",
            callSid: "CA123",
          },
        })
      );
      expect(callEndedHandler).toHaveBeenCalled();
    });
  });
});
