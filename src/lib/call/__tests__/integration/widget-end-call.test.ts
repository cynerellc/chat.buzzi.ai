/**
 * Widget End Call API Integration Tests
 *
 * Tests for POST /api/widget/call/[sessionId]/end endpoint
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSession } from "../utils/test-data";

// Mock rate limiter
vi.mock("@/lib/redis/rate-limit", () => ({
  withRateLimit: vi.fn(() => null),
}));

// Mock call runner
const mockEndCall = vi.fn();
vi.mock("@/lib/call/execution/call-runner", () => ({
  getCallRunner: vi.fn(() => ({
    endCall: mockEndCall,
  })),
}));

// Mock session manager
const mockGetSession = vi.fn();
vi.mock("@/lib/call/execution/call-session-manager", () => ({
  getCallSessionManager: vi.fn(() => ({
    getSession: mockGetSession,
  })),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(
  sessionId: string,
  body?: { reason?: string },
  headers: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost:3000/api/widget/call/${sessionId}/end`;
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/widget/call/[sessionId]/end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe("validation", () => {
    it("should return 400 when sessionId is empty", async () => {
      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest("");
      const response = await POST(request, { params: Promise.resolve({ sessionId: "" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sessionId");
    });
  });

  // ============================================================================
  // Session Not Found Tests
  // ============================================================================

  describe("session not found", () => {
    it("should return 404 when session does not exist", async () => {
      mockGetSession.mockResolvedValue(null);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest("non-existent-session");
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: "non-existent-session" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Session not found");
    });
  });

  // ============================================================================
  // Successful End Call Tests
  // ============================================================================

  describe("successful end call", () => {
    it("should end call and return success response", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId);
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("ended successfully");
      expect(data.callSummary).toBeDefined();
      expect(data.callSummary.callId).toBe(mockSession.callId);
      expect(data.callSummary.status).toBe("completed");
      expect(data.callSummary.endedAt).toBeDefined();
    });

    it("should use provided reason", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId, { reason: "user_hangup" });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });

      expect(response.status).toBe(200);
      expect(mockEndCall).toHaveBeenCalledWith(mockSession.sessionId, "user_hangup");
    });

    it("should use default reason when not provided", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId);
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });

      expect(response.status).toBe(200);
      expect(mockEndCall).toHaveBeenCalledWith(mockSession.sessionId, "user_ended");
    });

    it("should calculate duration correctly", async () => {
      const startTime = Date.now() - 120000; // 2 minutes ago
      const mockSession = createMockSession({
        startedAt: new Date(startTime),
      });
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId);
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Duration should be approximately 120 seconds
      expect(data.callSummary.durationSeconds).toBeGreaterThanOrEqual(118);
      expect(data.callSummary.durationSeconds).toBeLessThanOrEqual(122);
    });
  });

  // ============================================================================
  // CORS Tests
  // ============================================================================

  describe("CORS handling", () => {
    it("should set CORS headers when origin is present", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId, undefined, {
        origin: "https://example.com",
      });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should handle OPTIONS preflight request", async () => {
      const { OPTIONS } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = new NextRequest("http://localhost:3000/api/widget/call/test-session/end", {
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
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should return 500 when endCall throws", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockRejectedValue(new Error("Internal error"));

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId);
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to end call");
    });

    it("should handle malformed JSON body gracefully", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      // Create request with no body
      const request = new NextRequest(
        `http://localhost:3000/api/widget/call/${mockSession.sessionId}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });

      // Should still succeed with default reason
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe("rate limiting", () => {
    it("should apply rate limiting", async () => {
      const { withRateLimit } = await import("@/lib/redis/rate-limit");
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue(mockSession);
      mockEndCall.mockResolvedValue(undefined);

      const { POST } = await import("@/app/api/widget/call/[sessionId]/end/route");

      const request = createMockRequest(mockSession.sessionId);
      await POST(request, {
        params: Promise.resolve({ sessionId: mockSession.sessionId }),
      });

      expect(withRateLimit).toHaveBeenCalled();
    });
  });
});
