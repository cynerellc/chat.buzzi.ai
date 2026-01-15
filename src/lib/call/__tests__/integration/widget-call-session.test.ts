/**
 * Widget Call Session API Integration Tests
 *
 * Tests for POST /api/widget/call/session endpoint
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockChatbot, createMockSession } from "../utils/test-data";

// Mock session for call runner
const mockSession = createMockSession();

// Mock database - create chain builders
const createSelectChain = (result: any[] = []) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(result),
    }),
  }),
});

const createInsertChain = (result: any[] = [{ id: "inserted-id" }]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(result),
  }),
});

const createUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

// Track mock state for dynamic responses
let selectResults: any[][] = [];
let selectCallIndex = 0;

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: any[]) => {
      const result = selectResults[selectCallIndex] || [];
      selectCallIndex++;
      return createSelectChain(result);
    },
    insert: (...args: any[]) => createInsertChain([{ id: "end-user-123" }]),
    update: (...args: any[]) => createUpdateChain(),
  },
}));

// Mock rate limiter
vi.mock("@/lib/redis/rate-limit", () => ({
  withRateLimit: vi.fn(() => null),
}));

// Mock call runner
vi.mock("@/lib/call/execution/call-runner", () => ({
  getCallRunner: vi.fn(() => ({
    createSession: vi.fn(() => Promise.resolve(mockSession)),
  })),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const url = "http://localhost:3000/api/widget/call/session";
  const request = new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "localhost:3000",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return request;
}

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/widget/call/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock state - default to empty results
    selectResults = [];
    selectCallIndex = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe("validation", () => {
    it("should return 400 when chatbotId is missing", async () => {
      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        companyId: "company-123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 when companyId is missing", async () => {
      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 when both required fields are missing", async () => {
      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // Company Validation Tests
  // ============================================================================

  describe("company validation", () => {
    it("should return 404 when company not found", async () => {
      // Mock empty company result (default is already empty)
      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        companyId: "non-existent-company",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Company not found");
    });
  });

  // ============================================================================
  // Chatbot Validation Tests
  // ============================================================================

  describe("chatbot validation", () => {
    it("should return 404 when chatbot not found", async () => {
      // First call returns company, second returns empty (chatbot not found)
      selectResults = [
        [{ id: "company-123", status: "active" }], // Company query
        [], // Chatbot query - not found
      ];

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: "non-existent-chatbot",
        companyId: "company-123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Chatbot not found");
    });

    it("should return 403 when call feature is disabled", async () => {
      const mockChatbot = createMockChatbot({ enabledCall: false });

      selectResults = [
        [{ id: "company-123", status: "active" }], // Company query
        [mockChatbot], // Chatbot query
      ];

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: mockChatbot.id,
        companyId: mockChatbot.companyId,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Call feature not enabled");
    });

    it("should return 500 when AI provider is not configured", async () => {
      const mockChatbot = createMockChatbot({
        enabledCall: true,
        callAiProvider: null,
      });

      selectResults = [
        [{ id: "company-123", status: "active" }], // Company query
        [mockChatbot], // Chatbot query
      ];

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: mockChatbot.id,
        companyId: mockChatbot.companyId,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("AI provider not configured");
    });
  });

  // ============================================================================
  // Success Cases
  // ============================================================================

  describe("successful session creation", () => {
    function setupSuccessMocks(mockChatbot: ReturnType<typeof createMockChatbot>) {
      selectResults = [
        [{ id: "company-123", status: "active" }], // Company query
        [mockChatbot], // Chatbot query
        [], // End user query (optional)
      ];
      selectCallIndex = 0;
    }

    it("should create session and return sessionId and wsUrl", async () => {
      const mockChatbot = createMockChatbot({
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      setupSuccessMocks(mockChatbot);

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: mockChatbot.id,
        companyId: mockChatbot.companyId,
        customer: {
          name: "Test User",
          email: "test@example.com",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBeDefined();
      expect(data.callId).toBeDefined();
      expect(data.wsUrl).toBeDefined();
      expect(data.wsUrl).toContain("ws://");
      expect(data.wsUrl).toContain("sessionId=");
      expect(data.expiresAt).toBeDefined();
    });

    it("should include customer info when provided", async () => {
      const mockChatbot = createMockChatbot({
        enabledCall: true,
        callAiProvider: "OPENAI",
      });

      setupSuccessMocks(mockChatbot);

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: mockChatbot.id,
        companyId: mockChatbot.companyId,
        customer: {
          id: "cust-123",
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
        },
        pageUrl: "https://example.com/page",
        referrer: "https://google.com",
        userAgent: "Mozilla/5.0",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // CORS Tests
  // ============================================================================

  describe("CORS handling", () => {
    it("should set CORS headers when origin is present", async () => {
      const mockChatbot = createMockChatbot({
        enabledCall: true,
        callAiProvider: "OPENAI",
        behavior: { widgetConfig: { allowedDomains: [] } }, // Allow all domains
      });

      // NOTE: Order matters! validateWidgetOrigin queries before company/chatbot
      selectResults = [
        [{ behavior: { widgetConfig: { allowedDomains: [] } } }], // validateWidgetOrigin query
        [{ id: "company-123", status: "active" }], // Company query
        [mockChatbot], // Chatbot query
        [], // End user query (find)
        [{ id: "end-user-123" }], // End user insert result handled by insert chain
      ];

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest(
        {
          chatbotId: mockChatbot.id,
          companyId: mockChatbot.companyId,
        },
        { origin: "https://example.com" }
      );

      const response = await POST(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should handle OPTIONS preflight request", async () => {
      const { OPTIONS } = await import("@/app/api/widget/call/session/route");

      const request = new NextRequest("http://localhost:3000/api/widget/call/session", {
        method: "OPTIONS",
        headers: {
          origin: "https://example.com",
        },
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe("rate limiting", () => {
    it("should apply rate limiting", async () => {
      const { withRateLimit } = await import("@/lib/redis/rate-limit");

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        companyId: "company-123",
      });

      await POST(request);

      expect(withRateLimit).toHaveBeenCalled();
    });

    it("should return rate limit response when exceeded", async () => {
      // Mock rate limiter to return a response
      const rateLimitModule = await import("@/lib/redis/rate-limit");
      vi.mocked(rateLimitModule.withRateLimit).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 })
      );

      const { POST } = await import("@/app/api/widget/call/session/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        companyId: "company-123",
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
    });
  });
});
