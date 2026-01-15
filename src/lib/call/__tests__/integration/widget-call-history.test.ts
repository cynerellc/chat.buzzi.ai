/**
 * Widget Call History API Integration Tests
 *
 * Tests for GET /api/widget/call/history endpoint
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockCallRecord } from "../utils/test-data";

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(
  searchParams: Record<string, string>,
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL("http://localhost:3000/api/widget/call/history");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new NextRequest(url, {
    method: "GET",
    headers: {
      ...headers,
    },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("GET /api/widget/call/history", () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
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
    it("should return 400 when chatbotId is missing", async () => {
      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("chatbotId");
    });

    it("should return 400 when endUserId is missing", async () => {
      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("endUserId");
    });
  });

  // ============================================================================
  // Successful Retrieval Tests
  // ============================================================================

  describe("successful retrieval", () => {
    it("should return empty history when no calls exist", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toEqual([]);
    });

    it("should return call history when calls exist", async () => {
      const mockCalls = [
        createMockCallRecord({
          status: "completed",
          durationSeconds: 120,
          startedAt: new Date("2024-01-15T10:00:00Z"),
          endedAt: new Date("2024-01-15T10:02:00Z"),
        }),
        createMockCallRecord({
          status: "completed",
          durationSeconds: 60,
          startedAt: new Date("2024-01-14T10:00:00Z"),
          endedAt: new Date("2024-01-14T10:01:00Z"),
        }),
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockCalls),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toHaveLength(2);
      expect(data.history[0].id).toBe(mockCalls[0].id);
      expect(data.history[0].status).toBe("completed");
      expect(data.history[0].durationSeconds).toBe(120);
    });

    it("should format dates as ISO strings", async () => {
      const mockCall = createMockCallRecord({
        startedAt: new Date("2024-01-15T10:00:00Z"),
        endedAt: new Date("2024-01-15T10:02:00Z"),
      });

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCall]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history[0].startedAt).toBe("2024-01-15T10:00:00.000Z");
      expect(data.history[0].endedAt).toBe("2024-01-15T10:02:00.000Z");
    });

    it("should include AI provider in response", async () => {
      const mockCall = createMockCallRecord({
        aiProvider: "GEMINI",
      });

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCall]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history[0].aiProvider).toBe("GEMINI");
    });
  });

  // ============================================================================
  // Pagination Tests
  // ============================================================================

  describe("pagination", () => {
    it("should use default limit of 10", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      await GET(request);

      // Check that limit was called with 10
      const limitCall = mockDb.select().from(null).where(null).orderBy(null).limit as ReturnType<typeof vi.fn>;
      expect(limitCall).toHaveBeenCalledWith(10);
    });

    it("should respect custom limit parameter", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
        limit: "25",
      });

      await GET(request);

      const limitCall = mockDb.select().from(null).where(null).orderBy(null).limit as ReturnType<typeof vi.fn>;
      expect(limitCall).toHaveBeenCalledWith(25);
    });

    it("should cap limit at 50", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
        limit: "100",
      });

      await GET(request);

      const limitCall = mockDb.select().from(null).where(null).orderBy(null).limit as ReturnType<typeof vi.fn>;
      expect(limitCall).toHaveBeenCalledWith(50);
    });
  });

  // ============================================================================
  // CORS Tests
  // ============================================================================

  describe("CORS handling", () => {
    it("should set CORS headers when origin is present", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest(
        {
          chatbotId: "chatbot-123",
          endUserId: "user-123",
        },
        { origin: "https://example.com" }
      );

      const response = await GET(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should handle OPTIONS preflight request", async () => {
      const { OPTIONS } = await import("@/app/api/widget/call/history/route");

      const request = new NextRequest("http://localhost:3000/api/widget/call/history", {
        method: "OPTIONS",
        headers: {
          origin: "https://example.com",
        },
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should return 500 on database error", async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error("Database error")),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to fetch");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle null durationSeconds", async () => {
      const mockCall = createMockCallRecord({
        durationSeconds: null as unknown as number,
      });

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCall]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history[0].durationSeconds).toBe(0);
    });

    it("should handle calls without endedAt", async () => {
      const mockCall = createMockCallRecord({
        endedAt: null,
        status: "in_progress",
      });

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCall]),
            }),
          }),
        }),
      });

      const { GET } = await import("@/app/api/widget/call/history/route");

      const request = createMockRequest({
        chatbotId: "chatbot-123",
        endUserId: "user-123",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history[0].endedAt).toBeUndefined();
      expect(data.history[0].status).toBe("in_progress");
    });
  });
});
