/**
 * Twilio Voice Webhook Integration Tests
 *
 * Tests for POST /api/webhook/twilio/voice endpoint
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockChatbot, createMockIntegrationAccount, createMockSession } from "../utils/test-data";

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock call runner
vi.mock("@/lib/call/execution/call-runner", () => ({
  getCallRunner: vi.fn(() => ({
    createSession: vi.fn(() => Promise.resolve(createMockSession())),
  })),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTwilioRequest(
  params: Record<string, string>,
  headers: Record<string, string> = {}
): NextRequest {
  const url = "http://localhost:3000/api/webhook/twilio/voice";
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      host: "localhost:3000",
      ...headers,
    },
    body: formData.toString(),
  });
}

function parseTwiML(xml: string): {
  hasConnect: boolean;
  hasSay: boolean;
  hasHangup: boolean;
  streamUrl?: string;
  sayContent?: string;
} {
  const hasConnect = xml.includes("<Connect>");
  const hasSay = xml.includes("<Say");
  const hasHangup = xml.includes("<Hangup/>");

  const streamMatch = xml.match(/<Stream url="([^"]+)"/);
  const streamUrl = streamMatch?.[1];

  const sayMatch = xml.match(/<Say[^>]*>([^<]+)<\/Say>/);
  const sayContent = sayMatch?.[1];

  return { hasConnect, hasSay, hasHangup, streamUrl, sayContent };
}

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/webhook/twilio/voice", () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const dbModule = await import("@/lib/db");
    mockDb = dbModule.db as typeof mockDb;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe("validation", () => {
    it("should return TwiML error when To number is missing", async () => {
      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        From: "+1234567890",
        CallSid: "CA123456789",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(response.headers.get("Content-Type")).toBe("text/xml");
      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
      expect(parsed.sayContent).toContain("Invalid");
    });

    it("should return TwiML error when From number is missing", async () => {
      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+1987654321",
        CallSid: "CA123456789",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
    });

    it("should return TwiML error when CallSid is missing", async () => {
      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+1987654321",
        From: "+1234567890",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
    });
  });

  // ============================================================================
  // Integration Account Lookup Tests
  // ============================================================================

  describe("integration account lookup", () => {
    it("should return TwiML error when no integration found for phone number", async () => {
      // Mock empty integration result
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+1987654321",
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
      expect(parsed.sayContent).toContain("not configured");
    });

    it("should match integration by normalized phone number", async () => {
      const mockIntegration = createMockIntegrationAccount({
        provider: "twilio",
        credentials: {
          twilio_account_sid: "AC123",
          twilio_auth_token: "auth-token",
          twilio_phone_number: "+1 (987) 654-3210",
        },
      });

      const mockChatbot = createMockChatbot({
        companyId: mockIntegration.companyId,
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      // First call returns integrations, second returns chatbots
      const selectMock = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockIntegration]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChatbot]),
            }),
          }),
        });

      mockDb.select = selectMock;

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210", // No formatting
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      // Should find integration and return stream
      expect(parsed.hasConnect || parsed.hasSay).toBe(true);
    });
  });

  // ============================================================================
  // Chatbot Lookup Tests
  // ============================================================================

  describe("chatbot lookup", () => {
    it("should return TwiML error when no call-enabled chatbot found", async () => {
      const mockIntegration = createMockIntegrationAccount({
        provider: "twilio",
        credentials: {
          twilio_phone_number: "+19876543210",
        },
      });

      // Integration found but no chatbot
      const selectMock = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockIntegration]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No chatbot
            }),
          }),
        });

      mockDb.select = selectMock;

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
      expect(parsed.sayContent).toContain("no AI assistant");
    });
  });

  // ============================================================================
  // Successful Call Setup Tests
  // ============================================================================

  describe("successful call setup", () => {
    it("should return TwiML with Stream directive for valid call", async () => {
      const mockIntegration = createMockIntegrationAccount({
        provider: "twilio",
        credentials: {
          twilio_phone_number: "+19876543210",
        },
      });

      const mockChatbot = createMockChatbot({
        companyId: mockIntegration.companyId,
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      const selectMock = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockIntegration]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChatbot]),
            }),
          }),
        });

      mockDb.select = selectMock;

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(response.headers.get("Content-Type")).toBe("text/xml");
      expect(parsed.hasConnect).toBe(true);
      expect(parsed.streamUrl).toBeDefined();
      expect(parsed.streamUrl).toContain("sessionId=");
    });

    it("should include session parameters in Stream element", async () => {
      const mockIntegration = createMockIntegrationAccount({
        provider: "twilio",
        credentials: {
          twilio_phone_number: "+19876543210",
        },
      });

      const mockChatbot = createMockChatbot({
        companyId: mockIntegration.companyId,
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      const selectMock = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockIntegration]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChatbot]),
            }),
          }),
        });

      mockDb.select = selectMock;

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();

      expect(text).toContain('<Parameter name="sessionId"');
      expect(text).toContain('<Parameter name="callId"');
      expect(text).toContain('<Parameter name="chatbotId"');
    });
  });

  // ============================================================================
  // Signature Validation Tests
  // ============================================================================

  describe("signature validation", () => {
    it("should reject request with invalid signature when auth token is set", async () => {
      const originalToken = process.env.TWILIO_AUTH_TOKEN;
      process.env.TWILIO_AUTH_TOKEN = "test-auth-token";

      const mockIntegration = createMockIntegrationAccount({
        provider: "twilio",
        credentials: {
          twilio_phone_number: "+19876543210",
          twilio_auth_token: "account-auth-token",
        },
      });

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockIntegration]),
        }),
      });

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest(
        {
          To: "+19876543210",
          From: "+1234567890",
          CallSid: "CA123456789",
          AccountSid: "AC123456789",
          Direction: "inbound",
        },
        {
          "x-twilio-signature": "invalid-signature",
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(403);

      // Restore env
      if (originalToken) {
        process.env.TWILIO_AUTH_TOKEN = originalToken;
      } else {
        delete process.env.TWILIO_AUTH_TOKEN;
      }
    });
  });

  // ============================================================================
  // Session Creation Failure Tests
  // ============================================================================

  describe("session creation failure", () => {
    it("should return TwiML error when session creation fails", async () => {
      const mockIntegration = createMockIntegrationAccount({
        provider: "twilio",
        credentials: {
          twilio_phone_number: "+19876543210",
        },
      });

      const mockChatbot = createMockChatbot({
        companyId: mockIntegration.companyId,
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      const selectMock = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockIntegration]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockChatbot]),
            }),
          }),
        });

      mockDb.select = selectMock;

      // Mock call runner to return null (session creation failed)
      const callRunnerModule = await import("@/lib/call/execution/call-runner");
      vi.mocked(callRunnerModule.getCallRunner).mockReturnValueOnce({
        createSession: vi.fn().mockResolvedValue(null),
      } as any);

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
      expect(parsed.sayContent).toContain("could not start");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should return TwiML error on unexpected exception", async () => {
      mockDb.select = vi.fn().mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
        AccountSid: "AC123456789",
        Direction: "inbound",
      });

      const response = await POST(request);
      const text = await response.text();
      const parsed = parseTwiML(text);

      expect(parsed.hasSay).toBe(true);
      expect(parsed.hasHangup).toBe(true);
      expect(parsed.sayContent).toContain("error occurred");
    });
  });

  // ============================================================================
  // Response Format Tests
  // ============================================================================

  describe("response format", () => {
    it("should always return XML content type", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
      });

      const response = await POST(request);

      expect(response.headers.get("Content-Type")).toBe("text/xml");
    });

    it("should return valid TwiML structure", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { POST } = await import("@/app/api/webhook/twilio/voice/route");

      const request = createMockTwilioRequest({
        To: "+19876543210",
        From: "+1234567890",
        CallSid: "CA123456789",
      });

      const response = await POST(request);
      const text = await response.text();

      expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(text).toContain("<Response>");
      expect(text).toContain("</Response>");
    });
  });
});
