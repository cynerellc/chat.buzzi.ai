/**
 * Health API Tests
 *
 * Tests for the health check endpoint used by load balancers and monitoring.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, HEAD } from "@/app/api/health/route";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { db } from "@/lib/db";

describe("Health API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET /api/health
  // ============================================================================

  describe("GET /api/health", () => {
    it("should return healthy when database is up", async () => {
      vi.mocked(db.execute).mockResolvedValue([{ "1": 1 }] as unknown as ReturnType<typeof db.execute>);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("healthy");
      expect(data.checks.database.status).toBe("up");
      expect(data.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
    });

    it("should return unhealthy when database is down", async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error("Connection refused"));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe("unhealthy");
      expect(data.checks.database.status).toBe("down");
      expect(data.checks.database.error).toBe("Connection refused");
    });

    it("should include cache control headers", async () => {
      vi.mocked(db.execute).mockResolvedValue([{ "1": 1 }] as unknown as ReturnType<typeof db.execute>);

      const response = await GET();

      expect(response.headers.get("Cache-Control")).toBe(
        "no-cache, no-store, must-revalidate"
      );
      expect(response.headers.get("Pragma")).toBe("no-cache");
    });

    it("should return valid ISO timestamp", async () => {
      vi.mocked(db.execute).mockResolvedValue([{ "1": 1 }] as unknown as ReturnType<typeof db.execute>);

      const response = await GET();
      const data = await response.json();

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });
  });

  // ============================================================================
  // HEAD /api/health
  // ============================================================================

  describe("HEAD /api/health", () => {
    it("should return 200 when healthy", async () => {
      vi.mocked(db.execute).mockResolvedValue([{ "1": 1 }] as unknown as ReturnType<typeof db.execute>);

      const response = await HEAD();

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it("should return 503 when unhealthy", async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error("Connection refused"));

      const response = await HEAD();

      expect(response.status).toBe(503);
    });

    it("should include cache control headers", async () => {
      vi.mocked(db.execute).mockResolvedValue([{ "1": 1 }] as unknown as ReturnType<typeof db.execute>);

      const response = await HEAD();

      expect(response.headers.get("Cache-Control")).toBe(
        "no-cache, no-store, must-revalidate"
      );
    });
  });
});
