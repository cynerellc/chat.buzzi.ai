/**
 * WhatsApp Calling Webhook Integration Tests
 *
 * Tests for GET/POST /api/webhook/whatsapp/calls endpoint
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";
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
const mockCreateSession = vi.fn();
const mockEndCall = vi.fn();
const mockStartCall = vi.fn();
const mockSendAudio = vi.fn();
vi.mock("@/lib/call/execution/call-runner", () => ({
  getCallRunner: vi.fn(() => ({
    createSession: mockCreateSession,
    endCall: mockEndCall,
    startCall: mockStartCall,
    sendAudio: mockSendAudio,
  })),
}));

// Mock WhatsApp call handler
const mockHandlerStart = vi.fn();
const mockHandlerGetSDPAnswer = vi.fn();
const mockHandlerHandleAudio = vi.fn();
vi.mock("@/lib/call/handlers/whatsapp-call-handler", () => ({
  createWhatsAppCallHandler: vi.fn(() => ({
    start: mockHandlerStart,
    getSDPAnswer: mockHandlerGetSDPAnswer,
    handleAudio: mockHandlerHandleAudio,
  })),
}));

// Mock fetch for WhatsApp API calls
global.fetch = vi.fn();

// ============================================================================
// Test Helpers
// ============================================================================

function createWhatsAppWebhookPayload(
  callEvents: Array<{
    id: string;
    call_id: string;
    from: string;
    timestamp: string;
    event: "connect" | "terminate" | "media";
    call?: {
      offer?: { sdp: string };
      termination_reason?: string;
    };
    media?: {
      payload: string;
      codec: string;
      sample_rate: number;
    };
  }>,
  phoneNumberId: string = "123456789"
): object {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "business-account-id",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+19876543210",
                phone_number_id: phoneNumberId,
              },
              calls: callEvents,
            },
            field: "calls",
          },
        ],
      },
    ],
  };
}

function createSignature(body: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function createMockPostRequest(
  payload: object,
  appSecret?: string
): NextRequest {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (appSecret) {
    headers["x-hub-signature-256"] = createSignature(body, appSecret);
  }

  return new NextRequest("http://localhost:3000/api/webhook/whatsapp/calls", {
    method: "POST",
    headers,
    body,
  });
}

function createMockGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/webhook/whatsapp/calls");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new NextRequest(url, {
    method: "GET",
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("WhatsApp Calling Webhook", () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const dbModule = await import("@/lib/db");
    mockDb = dbModule.db as typeof mockDb;
    vi.clearAllMocks();

    // Reset env vars
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET - Webhook Verification Tests
  // ============================================================================

  describe("GET /api/webhook/whatsapp/calls (verification)", () => {
    it("should return 500 when verify token not configured", async () => {
      const { GET } = await import("@/app/api/webhook/whatsapp/calls/route");

      const request = createMockGetRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": "my-verify-token",
        "hub.challenge": "challenge-123",
      });

      const response = await GET(request);

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toContain("not configured");
    });

    it("should return challenge when token matches", async () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "my-verify-token";

      const { GET } = await import("@/app/api/webhook/whatsapp/calls/route");

      const request = createMockGetRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": "my-verify-token",
        "hub.challenge": "challenge-123",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("challenge-123");
    });

    it("should return 403 when token does not match", async () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "correct-token";

      const { GET } = await import("@/app/api/webhook/whatsapp/calls/route");

      const request = createMockGetRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "challenge-123",
      });

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it("should return 403 when mode is not subscribe", async () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "my-verify-token";

      const { GET } = await import("@/app/api/webhook/whatsapp/calls/route");

      const request = createMockGetRequest({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "my-verify-token",
        "hub.challenge": "challenge-123",
      });

      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================================
  // POST - Signature Validation Tests
  // ============================================================================

  describe("POST signature validation", () => {
    it("should reject request with invalid signature", async () => {
      process.env.WHATSAPP_APP_SECRET = "app-secret";

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([]);
      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hub-signature-256": "sha256=invalid-signature",
          },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain("Invalid signature");
    });

    it("should accept request with valid signature", async () => {
      process.env.WHATSAPP_APP_SECRET = "app-secret";

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      // Empty call events = no processing needed
      const payload = createWhatsAppWebhookPayload([]);
      const request = createMockPostRequest(payload, "app-secret");

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("ok");
    });

    it("should accept request without signature when secret not configured", async () => {
      // No WHATSAPP_APP_SECRET set
      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([]);
      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // POST - Connect Event Tests
  // ============================================================================

  describe("POST connect event", () => {
    it("should handle incoming call connect event", async () => {
      const mockIntegration = createMockIntegrationAccount({
        provider: "whatsapp",
        credentials: {
          whatsapp_phone_number_id: "123456789",
          whatsapp_access_token: "access-token",
        },
      });

      const mockChatbot = createMockChatbot({
        companyId: mockIntegration.companyId,
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      const mockSession = createMockSession();
      mockCreateSession.mockResolvedValue(mockSession);
      mockHandlerStart.mockResolvedValue(undefined);
      mockHandlerGetSDPAnswer.mockReturnValue("v=0\r\no=- ...");
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
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

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "connect",
          call: {
            offer: {
              sdp: "v=0\r\no=- 123 ...",
            },
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          chatbotId: mockChatbot.id,
          companyId: mockIntegration.companyId,
          source: "whatsapp",
          fromNumber: "+1234567890",
        })
      );
    });

    it("should reject call when no integration found", async () => {
      process.env.WHATSAPP_ACCESS_TOKEN = "access-token";

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "connect",
          call: {
            offer: { sdp: "v=0\r\n..." },
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200); // Webhook acknowledges receipt
      // Should have called reject endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/reject"),
        expect.any(Object)
      );
    });

    it("should reject call when no chatbot found", async () => {
      process.env.WHATSAPP_ACCESS_TOKEN = "access-token";

      const mockIntegration = createMockIntegrationAccount({
        provider: "whatsapp",
        credentials: {
          whatsapp_phone_number_id: "123456789",
        },
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
              limit: vi.fn().mockResolvedValue([]), // No chatbot
            }),
          }),
        });

      mockDb.select = selectMock;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "connect",
          call: {
            offer: { sdp: "v=0\r\n..." },
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/reject"),
        expect.objectContaining({
          body: expect.stringContaining("no_chatbot"),
        })
      );
    });
  });

  // ============================================================================
  // POST - Terminate Event Tests
  // ============================================================================

  describe("POST terminate event", () => {
    it("should handle call termination", async () => {
      // This test verifies terminate events are processed
      // In reality, the handler lookup would need to be mocked at module level

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "terminate",
          call: {
            termination_reason: "user_hangup",
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      // The handler map is internal, so we just verify no error
    });
  });

  // ============================================================================
  // POST - Media Event Tests
  // ============================================================================

  describe("POST media event", () => {
    it("should handle media event", async () => {
      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "media",
          media: {
            payload: Buffer.from([1, 2, 3]).toString("base64"),
            codec: "opus",
            sample_rate: 16000,
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // POST - Non-Call Events Tests
  // ============================================================================

  describe("POST non-call events", () => {
    it("should ignore message events", async () => {
      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "business-account-id",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+19876543210",
                    phone_number_id: "123456789",
                  },
                  messages: [
                    {
                      id: "msg-123",
                      from: "+1234567890",
                      text: { body: "Hello" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      // No session should be created for message events
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should return 500 on JSON parse error", async () => {
      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid-json{",
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it("should handle database errors gracefully", async () => {
      mockDb.select = vi.fn().mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "connect",
          call: {
            offer: { sdp: "v=0\r\n..." },
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  // ============================================================================
  // Multiple Events Tests
  // ============================================================================

  describe("multiple events", () => {
    it("should process multiple call events in one payload", async () => {
      const { POST } = await import("@/app/api/webhook/whatsapp/calls/route");

      const payload = createWhatsAppWebhookPayload([
        {
          id: "event-1",
          call_id: "call-123",
          from: "+1234567890",
          timestamp: "1234567890",
          event: "terminate",
          call: {
            termination_reason: "user_hangup",
          },
        },
        {
          id: "event-2",
          call_id: "call-456",
          from: "+0987654321",
          timestamp: "1234567891",
          event: "terminate",
          call: {
            termination_reason: "timeout",
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/webhook/whatsapp/calls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
