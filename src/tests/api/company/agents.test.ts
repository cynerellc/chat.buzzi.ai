/**
 * Company Agents API Tests
 *
 * Tests for the agents CRUD API endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/company/agents/route";

// Mock auth guards
vi.mock("@/lib/auth/guards", () => ({
  requireCompanyAdmin: vi.fn(),
}));

// Mock tenant
vi.mock("@/lib/auth/tenant", () => ({
  getCurrentCompany: vi.fn(),
}));

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";

describe("Company Agents API", () => {
  const mockCompany = {
    id: "company-123",
    name: "Test Company",
    slug: "test-company",
  };

  const mockAgent = {
    id: "agent-123",
    companyId: "company-123",
    name: "Test Agent",
    description: "A test agent",
    type: "support",
    status: "active",
    systemPrompt: "You are a helpful assistant",
    modelId: "gpt-4o-mini",
    temperature: 70,
    totalConversations: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCompanyAdmin).mockResolvedValue(undefined);
    vi.mocked(getCurrentCompany).mockResolvedValue(mockCompany as never);
  });

  // ============================================================================
  // GET /api/company/agents
  // ============================================================================

  describe("GET /api/company/agents", () => {
    it("should return empty list when no agents exist", async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));
      vi.mocked(db.select).mockImplementation(mockSelect);

      const request = new NextRequest("http://localhost/api/company/agents");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toEqual([]);
    });

    it("should require company admin authorization", async () => {
      vi.mocked(requireCompanyAdmin).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new NextRequest("http://localhost/api/company/agents");
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("should return 404 when company not found", async () => {
      vi.mocked(getCurrentCompany).mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/company/agents");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Company not found");
    });

    it("should filter by status when provided", async () => {
      const mockWhere = vi.fn(() => ({
        orderBy: vi.fn(() => Promise.resolve([])),
      }));
      const mockFrom = vi.fn(() => ({
        where: mockWhere,
      }));
      const mockSelect = vi.fn(() => ({
        from: mockFrom,
      }));
      vi.mocked(db.select).mockImplementation(mockSelect);

      const request = new NextRequest(
        "http://localhost/api/company/agents?status=active"
      );
      await GET(request);

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // POST /api/company/agents
  // ============================================================================

  describe("POST /api/company/agents", () => {
    it("should create agent with required fields", async () => {
      const mockReturning = vi.fn(() => Promise.resolve([mockAgent]));
      const mockValues = vi.fn(() => ({
        returning: mockReturning,
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const request = new NextRequest("http://localhost/api/company/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Agent",
          description: "A test agent",
          type: "support",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.agent).toBeDefined();
      expect(data.agent.name).toBe("Test Agent");
    });

    it("should return 400 when name is missing", async () => {
      const request = new NextRequest("http://localhost/api/company/agents", {
        method: "POST",
        body: JSON.stringify({
          description: "A test agent",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Agent name is required");
    });

    it("should require company admin authorization", async () => {
      vi.mocked(requireCompanyAdmin).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new NextRequest("http://localhost/api/company/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Agent",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it("should return 404 when company not found", async () => {
      vi.mocked(getCurrentCompany).mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/company/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Agent",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Company not found");
    });

    it("should set default values when not provided", async () => {
      const mockReturning = vi.fn(() =>
        Promise.resolve([
          {
            ...mockAgent,
            type: "custom",
            status: "draft",
            modelId: "gpt-4o-mini",
            temperature: 70,
          },
        ])
      );
      const mockValues = vi.fn(() => ({
        returning: mockReturning,
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const request = new NextRequest("http://localhost/api/company/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Agent",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.agent.status).toBe("draft");
      expect(data.agent.modelId).toBe("gpt-4o-mini");
    });
  });
});
