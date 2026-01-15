/**
 * Call Analytics API Integration Tests
 *
 * Tests for GET /api/company/analytics/calls endpoint
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockCallRecord, createMockChatbot } from "../utils/test-data";

// Track mock state for dynamic responses
let queryCallIndex = 0;
let queryResults: any[] = [];

// Mock auth guard
vi.mock("@/lib/auth/guards", () => ({
  requireCompanyAdmin: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-123", role: "chatapp.company_admin" },
      company: { id: "company-123", name: "Test Company" },
    })
  ),
}));

// Create flexible chain builder
const createFlexibleChain = () => {
  const getNextResult = () => {
    const result = queryResults[queryCallIndex] || [];
    queryCallIndex++;
    return result;
  };

  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(getNextResult())),
    then: (resolve: Function) => Promise.resolve(getNextResult()).then(resolve),
  };

  return chain;
};

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => createFlexibleChain()),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/company/analytics/calls");
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new NextRequest(url, {
    method: "GET",
    headers: {
      host: "localhost:3000",
    },
  });
}

// Default query results for a complete analytics response
function getDefaultQueryResults() {
  return [
    // 1. Summary query
    [{
      totalCalls: 100,
      completedCalls: 80,
      failedCalls: 10,
      averageDurationSeconds: 120.5,
      totalDurationSeconds: 12050,
      totalTurns: 500,
      averageTurns: 5,
    }],
    // 2. Daily metrics query
    [
      { date: "2024-01-13", calls: 10, completed: 8, failed: 1, totalDuration: 1200 },
      { date: "2024-01-14", calls: 15, completed: 12, failed: 2, totalDuration: 1800 },
    ],
    // 3. Source breakdown query
    [
      { source: "web", count: 60 },
      { source: "twilio", count: 25 },
      { source: "whatsapp", count: 15 },
    ],
    // 4. AI Provider breakdown query
    [
      { aiProvider: "OPENAI", count: 70 },
      { aiProvider: "GEMINI", count: 30 },
    ],
    // 5. Status breakdown query
    [
      { status: "completed", count: 80 },
      { status: "failed", count: 10 },
      { status: "in_progress", count: 5 },
      { status: "connecting", count: 5 },
    ],
    // 6. Top chatbots query
    [
      { chatbotId: "chatbot-1", chatbotName: "Sales Bot", totalCalls: 50, completedCalls: 45, averageDuration: 120 },
      { chatbotId: "chatbot-2", chatbotName: "Support Bot", totalCalls: 30, completedCalls: 28, averageDuration: 90 },
    ],
    // 7. Recent calls query
    [
      {
        id: "call-1",
        chatbotName: "Sales Bot",
        source: "web",
        aiProvider: "OPENAI",
        status: "completed",
        durationSeconds: 120,
        createdAt: new Date("2024-01-15T10:00:00Z"),
        endReason: "user_ended",
      },
      {
        id: "call-2",
        chatbotName: "Support Bot",
        source: "twilio",
        aiProvider: "GEMINI",
        status: "completed",
        durationSeconds: 90,
        createdAt: new Date("2024-01-15T09:00:00Z"),
        endReason: "user_ended",
      },
    ],
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe("GET /api/company/analytics/calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCallIndex = 0;
    queryResults = getDefaultQueryResults();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Authentication Tests
  // ============================================================================

  describe("authentication", () => {
    it("should require company admin authentication", async () => {
      const { requireCompanyAdmin } = await import("@/lib/auth/guards");

      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      await GET(request);

      expect(requireCompanyAdmin).toHaveBeenCalled();
    });

    it("should return 401 when not authenticated", async () => {
      const guardsModule = await import("@/lib/auth/guards");
      vi.mocked(guardsModule.requireCompanyAdmin).mockRejectedValueOnce(
        new Error("Unauthorized")
      );

      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // Summary Statistics Tests
  // ============================================================================

  describe("summary statistics", () => {
    it("should return summary with all metrics", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(data.summary.totalCalls).toBe(100);
      expect(data.summary.completedCalls).toBe(80);
      expect(data.summary.failedCalls).toBe(10);
      expect(data.summary.successRate).toBe(80);
      expect(data.summary.averageDurationSeconds).toBe(121); // Rounded
    });

    it("should handle zero calls gracefully", async () => {
      queryResults[0] = [{
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        averageDurationSeconds: null,
        totalDurationSeconds: 0,
        totalTurns: 0,
        averageTurns: null,
      }];

      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.totalCalls).toBe(0);
      expect(data.summary.successRate).toBe(0);
      expect(data.summary.averageDurationSeconds).toBeNull();
    });
  });

  // ============================================================================
  // Date Range Tests
  // ============================================================================

  describe("date range", () => {
    it("should use default 30-day range", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest(); // No days param
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dateRange).toBeDefined();
      expect(data.dateRange.start).toBeDefined();
      expect(data.dateRange.end).toBeDefined();
    });

    it("should respect custom days parameter", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest({ days: "7" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify date range is approximately 7 days
      const startDate = new Date(data.dateRange.start);
      const endDate = new Date(data.dateRange.end);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(6);
      expect(daysDiff).toBeLessThanOrEqual(8);
    });
  });

  // ============================================================================
  // Daily Metrics Tests
  // ============================================================================

  describe("daily metrics", () => {
    it("should return daily breakdown", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dailyMetrics).toBeDefined();
      expect(Array.isArray(data.dailyMetrics)).toBe(true);
    });
  });

  // ============================================================================
  // Breakdown Tests
  // ============================================================================

  describe("breakdowns", () => {
    it("should return source breakdown", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sourceBreakdown).toBeDefined();
    });

    it("should return AI provider breakdown", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.aiProviderBreakdown).toBeDefined();
    });

    it("should return status breakdown", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.statusBreakdown).toBeDefined();
    });
  });

  // ============================================================================
  // Top Chatbots Tests
  // ============================================================================

  describe("top chatbots", () => {
    it("should return top chatbots by call volume", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topChatbots).toBeDefined();
      expect(Array.isArray(data.topChatbots)).toBe(true);
    });
  });

  // ============================================================================
  // Recent Calls Tests
  // ============================================================================

  describe("recent calls", () => {
    it("should return recent calls list", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentCalls).toBeDefined();
      expect(Array.isArray(data.recentCalls)).toBe(true);
    });

    it("should format dates as ISO strings", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.recentCalls && data.recentCalls.length > 0) {
        expect(data.recentCalls[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });
  });

  // ============================================================================
  // Response Format Tests
  // ============================================================================

  describe("response format", () => {
    it("should return complete analytics response structure", async () => {
      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("summary");
      expect(data).toHaveProperty("dailyMetrics");
      expect(data).toHaveProperty("sourceBreakdown");
      expect(data).toHaveProperty("aiProviderBreakdown");
      expect(data).toHaveProperty("statusBreakdown");
      expect(data).toHaveProperty("topChatbots");
      expect(data).toHaveProperty("recentCalls");
      expect(data).toHaveProperty("dateRange");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should return 500 on database error", async () => {
      // Set query results to throw error
      queryResults = [];

      const dbModule = await import("@/lib/db");
      vi.mocked(dbModule.db.select).mockImplementationOnce(() => {
        throw new Error("Database connection failed");
      });

      const { GET } = await import("@/app/api/company/analytics/calls/route");

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
