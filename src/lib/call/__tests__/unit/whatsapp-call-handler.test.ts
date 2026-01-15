/**
 * WhatsAppCallHandler Unit Tests
 *
 * Tests for the WhatsApp Business Calling API handler including:
 * - WebRTC peer connection setup
 * - SDP offer/answer negotiation
 * - Opus codec handling
 * - Audio format conversion
 * - Status updates
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WhatsAppCallHandler, createWhatsAppCallHandler } from "../../handlers/whatsapp-call-handler";

// Mock the WebRTC service
vi.mock("../../services/webrtc-service", () => ({
  webrtcService: {
    validateSDPOffer: vi.fn(() => ({ valid: true, issues: [] })),
    getPreferredAudioCodec: vi.fn(() => "opus"),
    createSession: vi.fn(async () => ({
      sdpAnswer: "mock-sdp-answer",
      peerConnection: {},
    })),
    sendAudio: vi.fn(async () => {}),
    clearAudioQueue: vi.fn(),
    endSession: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock the audio converter
vi.mock("../../utils/audio-converter", () => ({
  webrtcToOpenAI: vi.fn(async () => "base64-encoded-audio"),
  webrtcToGemini: vi.fn(async () => "base64-encoded-audio"),
  resamplePCM16: vi.fn(async (data: Buffer) => data),
  monoToStereo: vi.fn((data: Buffer) => Buffer.alloc(data.length * 2)),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockSdpOffer = `v=0
o=- 123456789 2 IN IP4 127.0.0.1
s=-
t=0 0
m=audio 9 UDP/TLS/RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1`;

// ============================================================================
// Tests
// ============================================================================

describe("WhatsAppCallHandler", () => {
  let handler: WhatsAppCallHandler;

  const defaultCallData = {
    callId: "whatsapp-call-123",
    phoneNumber: "+1234567890",
    sdpOffer: mockSdpOffer,
    fromNumber: "+0987654321",
    toNumber: "+1234567890",
    integrationAccountId: "integration-123",
  };

  const defaultOptions = {
    aiProvider: "OPENAI" as const,
    onAudioToAI: vi.fn(),
  };

  beforeEach(() => {
    handler = new WhatsAppCallHandler(
      "test-session-123",
      "test-call-456",
      defaultCallData,
      defaultOptions
    );
  });

  afterEach(() => {
    handler.removeAllListeners();
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

    it("should store call data", () => {
      const callInfo = handler.getCallInfo();
      expect(callInfo.whatsappCallId).toBe("whatsapp-call-123");
      expect(callInfo.phoneNumber).toBe("+1234567890");
    });

    it("should store AI provider", () => {
      const callInfo = handler.getCallInfo();
      expect(callInfo.aiProvider).toBe("OPENAI");
    });
  });

  // ============================================================================
  // Start Tests
  // ============================================================================

  describe("start", () => {
    it("should set handler as active", async () => {
      await handler.start();
      expect(handler.isHandlerActive()).toBe(true);
    });

    it("should emit callStarted event", async () => {
      const callStartedHandler = vi.fn();
      handler.on("callStarted", callStartedHandler);

      await handler.start();

      expect(callStartedHandler).toHaveBeenCalled();
    });

    it("should validate SDP offer", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      await handler.start();

      expect(webrtcService.validateSDPOffer).toHaveBeenCalledWith(mockSdpOffer);
    });

    it("should create WebRTC session", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      await handler.start();

      expect(webrtcService.createSession).toHaveBeenCalled();
    });

    it("should set SDP answer after WebRTC setup", async () => {
      await handler.start();

      const sdpAnswer = handler.getSDPAnswer();
      expect(sdpAnswer).toBe("mock-sdp-answer");
    });

    it("should handle invalid SDP offer", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");
      vi.mocked(webrtcService.validateSDPOffer).mockReturnValueOnce({
        valid: false,
        issues: ["Missing audio codec"],
      });

      const errorHandler = vi.fn();
      handler.on("error", errorHandler);

      await expect(handler.start()).rejects.toThrow("Invalid SDP offer");
      expect(errorHandler).toHaveBeenCalled();
    });

    it("should work without SDP offer", async () => {
      const handlerNoSdp = new WhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123" },
        { aiProvider: "OPENAI" }
      );

      await handlerNoSdp.start();

      expect(handlerNoSdp.isHandlerActive()).toBe(true);
      expect(handlerNoSdp.getSDPAnswer()).toBeNull();
    });

    it("should set up WebRTC audio pipeline", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      await handler.start();

      expect(webrtcService.on).toHaveBeenCalledWith("audio:received", expect.any(Function));
    });
  });

  // ============================================================================
  // Handle Audio Tests
  // ============================================================================

  describe("handleAudio", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should convert audio and forward to AI", async () => {
      const audioData = Buffer.from([1, 2, 3, 4]);
      await handler.handleAudio(audioData);

      expect(defaultOptions.onAudioToAI).toHaveBeenCalled();
    });

    it("should use OpenAI converter for OPENAI provider", async () => {
      const { webrtcToOpenAI } = await import("../../utils/audio-converter");

      const audioData = Buffer.from([1, 2, 3, 4]);
      await handler.handleAudio(audioData);

      expect(webrtcToOpenAI).toHaveBeenCalled();
    });

    it("should use Gemini converter for GEMINI provider", async () => {
      const { webrtcToGemini } = await import("../../utils/audio-converter");

      const geminiHandler = new WhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123" },
        { aiProvider: "GEMINI", onAudioToAI: vi.fn() }
      );
      await geminiHandler.start();

      const audioData = Buffer.from([1, 2, 3, 4]);
      await geminiHandler.handleAudio(audioData);

      expect(webrtcToGemini).toHaveBeenCalled();
    });

    it("should not process audio when inactive", async () => {
      await handler.end();
      vi.mocked(defaultOptions.onAudioToAI).mockClear();

      await handler.handleAudio(Buffer.from([1, 2, 3]));

      expect(defaultOptions.onAudioToAI).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Send Audio Tests
  // ============================================================================

  describe("sendAudio", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should resample and send audio via WebRTC", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");
      const { resamplePCM16, monoToStereo } = await import("../../utils/audio-converter");

      const audioData = Buffer.alloc(480); // 10ms at 24kHz
      await handler.sendAudio(audioData);

      expect(resamplePCM16).toHaveBeenCalled();
      expect(monoToStereo).toHaveBeenCalled();
      expect(webrtcService.sendAudio).toHaveBeenCalled();
    });

    it("should not send audio when inactive", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      await handler.end();
      vi.mocked(webrtcService.sendAudio).mockClear();

      await handler.sendAudio(Buffer.from([1, 2, 3]));

      expect(webrtcService.sendAudio).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Status Update Tests
  // ============================================================================

  describe("handleStatusUpdate", () => {
    beforeEach(async () => {
      await handler.start();
    });

    it("should handle completed status", async () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      await handler.handleStatusUpdate("completed");

      expect(handler.isHandlerActive()).toBe(false);
      expect(callEndedHandler).toHaveBeenCalled();
    });

    it("should handle failed status", async () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      await handler.handleStatusUpdate("failed");

      expect(handler.isHandlerActive()).toBe(false);
      expect(callEndedHandler).toHaveBeenCalledWith("Call failed");
    });

    it("should handle no-answer status", async () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      await handler.handleStatusUpdate("no-answer");

      expect(handler.isHandlerActive()).toBe(false);
    });

    it("should handle busy status", async () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      await handler.handleStatusUpdate("busy");

      expect(handler.isHandlerActive()).toBe(false);
    });

    it("should handle in-progress status", async () => {
      await handler.handleStatusUpdate("in-progress");

      expect(handler.isHandlerActive()).toBe(true);
    });

    it("should handle unknown status gracefully", async () => {
      await handler.handleStatusUpdate("unknown-status");

      // Should not throw or change state
      expect(handler.isHandlerActive()).toBe(true);
    });
  });

  // ============================================================================
  // Clear Audio Queue Tests
  // ============================================================================

  describe("clearAudioQueue", () => {
    it("should call WebRTC service to clear queue", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      handler.clearAudioQueue();

      expect(webrtcService.clearAudioQueue).toHaveBeenCalledWith("whatsapp-call-123");
    });
  });

  // ============================================================================
  // End Tests
  // ============================================================================

  describe("end", () => {
    beforeEach(async () => {
      await handler.start();
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

    it("should clean up audio handler", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      await handler.end();

      expect(webrtcService.off).toHaveBeenCalledWith("audio:received", expect.any(Function));
    });

    it("should end WebRTC session", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");

      await handler.end();

      expect(webrtcService.endSession).toHaveBeenCalledWith("whatsapp-call-123");
    });

    it("should use default reason if not provided", async () => {
      const callEndedHandler = vi.fn();
      handler.on("callEnded", callEndedHandler);

      await handler.end();

      expect(callEndedHandler).toHaveBeenCalledWith("Call ended");
    });
  });

  // ============================================================================
  // Get Call Info Tests
  // ============================================================================

  describe("getCallInfo", () => {
    it("should return complete call info", async () => {
      await handler.start();

      const info = handler.getCallInfo();

      expect(info.sessionId).toBe("test-session-123");
      expect(info.callId).toBe("test-call-456");
      expect(info.whatsappCallId).toBe("whatsapp-call-123");
      expect(info.phoneNumber).toBe("+1234567890");
      expect(info.platform).toBe("whatsapp");
      expect(info.audioCodec).toBe("opus");
      expect(info.audioSampleRate).toBe(48000);
      expect(info.aiProvider).toBe("OPENAI");
      expect(info.isActive).toBe(true);
      expect(info.sdpNegotiated).toBe(true);
    });

    it("should reflect inactive state", async () => {
      await handler.start();
      await handler.end();

      const info = handler.getCallInfo();

      expect(info.isActive).toBe(false);
    });

    it("should show SDP not negotiated when no offer", async () => {
      const handlerNoSdp = new WhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123" },
        { aiProvider: "OPENAI" }
      );
      await handlerNoSdp.start();

      const info = handlerNoSdp.getCallInfo();

      expect(info.sdpNegotiated).toBe(false);
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe("createWhatsAppCallHandler", () => {
    it("should create handler with provided options", () => {
      const handlerFromFactory = createWhatsAppCallHandler(
        "session-123",
        "call-456",
        { callId: "wa-call", phoneNumber: "+123" },
        { aiProvider: "GEMINI" }
      );

      expect(handlerFromFactory).toBeInstanceOf(WhatsAppCallHandler);
      expect(handlerFromFactory.getCallInfo().aiProvider).toBe("GEMINI");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should handle full call lifecycle", async () => {
      const callStartedHandler = vi.fn();
      const callEndedHandler = vi.fn();

      handler.on("callStarted", callStartedHandler);
      handler.on("callEnded", callEndedHandler);

      // Start
      await handler.start();
      expect(callStartedHandler).toHaveBeenCalled();
      expect(handler.isHandlerActive()).toBe(true);

      // Handle audio
      await handler.handleAudio(Buffer.from([1, 2, 3]));
      expect(defaultOptions.onAudioToAI).toHaveBeenCalled();

      // Send audio
      await handler.sendAudio(Buffer.alloc(480));

      // End
      await handler.end("Call completed");
      expect(callEndedHandler).toHaveBeenCalledWith("Call completed");
      expect(handler.isHandlerActive()).toBe(false);
    });

    it("should handle GEMINI provider correctly", async () => {
      const geminiHandler = createWhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123", sdpOffer: mockSdpOffer },
        { aiProvider: "GEMINI", onAudioToAI: vi.fn() }
      );

      await geminiHandler.start();

      const info = geminiHandler.getCallInfo();
      expect(info.aiProvider).toBe("GEMINI");

      await geminiHandler.end();
    });
  });

  // ============================================================================
  // Codec Detection Tests
  // ============================================================================

  describe("codec detection", () => {
    it("should detect opus codec from SDP", async () => {
      await handler.start();

      const info = handler.getCallInfo();
      expect(info.audioCodec).toBe("opus");
      expect(info.audioSampleRate).toBe(48000);
    });

    it("should handle PCMU codec", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");
      vi.mocked(webrtcService.getPreferredAudioCodec).mockReturnValueOnce("PCMU");

      const pcmuHandler = new WhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123", sdpOffer: mockSdpOffer },
        { aiProvider: "OPENAI" }
      );
      await pcmuHandler.start();

      const info = pcmuHandler.getCallInfo();
      expect(info.audioCodec).toBe("PCMU");
      expect(info.audioSampleRate).toBe(8000);
    });

    it("should handle G722 codec", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");
      vi.mocked(webrtcService.getPreferredAudioCodec).mockReturnValueOnce("G722");

      const g722Handler = new WhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123", sdpOffer: mockSdpOffer },
        { aiProvider: "OPENAI" }
      );
      await g722Handler.start();

      const info = g722Handler.getCallInfo();
      expect(info.audioCodec).toBe("G722");
      expect(info.audioSampleRate).toBe(16000);
    });

    it("should default to 8000 for unknown codec", async () => {
      const { webrtcService } = await import("../../services/webrtc-service");
      vi.mocked(webrtcService.getPreferredAudioCodec).mockReturnValueOnce("unknown");

      const unknownHandler = new WhatsAppCallHandler(
        "session",
        "call",
        { callId: "call-123", phoneNumber: "+123", sdpOffer: mockSdpOffer },
        { aiProvider: "OPENAI" }
      );
      await unknownHandler.start();

      const info = unknownHandler.getCallInfo();
      expect(info.audioSampleRate).toBe(8000);
    });
  });
});
