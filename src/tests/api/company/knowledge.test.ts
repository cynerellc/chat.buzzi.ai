/**
 * Company Knowledge API Tests
 *
 * Tests for the knowledge sources CRUD API endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/company/knowledge/route";

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
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve([])),
            })),
          })),
          groupBy: vi.fn(() => Promise.resolve([])),
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

describe("Company Knowledge API", () => {
  const mockCompany = {
    id: "company-123",
    name: "Test Company",
    slug: "test-company",
  };

  const mockKnowledgeSource = {
    id: "source-123",
    companyId: "company-123",
    name: "Test Knowledge Source",
    description: "A test knowledge source",
    type: "text",
    status: "pending",
    chunkCount: 0,
    tokenCount: 0,
    sourceConfig: { content: "Test content" },
    processingError: null,
    lastProcessedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCompanyAdmin).mockResolvedValue(undefined);
    vi.mocked(getCurrentCompany).mockResolvedValue(mockCompany as never);
  });

  // ============================================================================
  // GET /api/company/knowledge
  // ============================================================================

  describe("GET /api/company/knowledge", () => {
    it("should return empty list when no sources exist", async () => {
      // Mock the count query
      const mockCountSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 0 }])),
        })),
      }));

      // Mock the sources query
      const mockSourcesSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve([])),
              })),
            })),
          })),
        })),
      }));

      // Mock the status counts query
      const mockStatusSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      // Setup mock to return different results for different calls
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockCountSelect() as never;
        if (callCount === 2) return mockSourcesSelect() as never;
        return mockStatusSelect() as never;
      });

      const request = new NextRequest("http://localhost/api/company/knowledge");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sources).toEqual([]);
      expect(data.pagination).toBeDefined();
    });

    it("should require company admin authorization", async () => {
      vi.mocked(requireCompanyAdmin).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new NextRequest("http://localhost/api/company/knowledge");
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("should return 404 when company not found", async () => {
      vi.mocked(getCurrentCompany).mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/company/knowledge");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Company not found");
    });

    it("should support pagination parameters", async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve([])),
              })),
            })),
            groupBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));
      vi.mocked(db.select).mockImplementation(mockSelect);

      const request = new NextRequest(
        "http://localhost/api/company/knowledge?page=2&limit=10"
      );
      await GET(request);

      // Verify select was called
      expect(mockSelect).toHaveBeenCalled();
    });

    it("should filter by type when provided", async () => {
      const mockWhere = vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve([])),
          })),
        })),
        groupBy: vi.fn(() => Promise.resolve([])),
      }));
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          where: mockWhere,
        })),
      }) as never);

      const request = new NextRequest(
        "http://localhost/api/company/knowledge?type=file"
      );
      await GET(request);

      expect(mockWhere).toHaveBeenCalled();
    });

    it("should filter by status when provided", async () => {
      const mockWhere = vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve([])),
          })),
        })),
        groupBy: vi.fn(() => Promise.resolve([])),
      }));
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          where: mockWhere,
        })),
      }) as never);

      const request = new NextRequest(
        "http://localhost/api/company/knowledge?status=indexed"
      );
      await GET(request);

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // POST /api/company/knowledge
  // ============================================================================

  describe("POST /api/company/knowledge", () => {
    it("should create text knowledge source", async () => {
      const mockReturning = vi.fn(() =>
        Promise.resolve([mockKnowledgeSource])
      );
      const mockValues = vi.fn(() => ({
        returning: mockReturning,
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      vi.mocked(db.insert).mockImplementation(mockInsert);

      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Knowledge Source",
          type: "text",
          sourceConfig: {
            content: "This is test knowledge content for the AI.",
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source).toBeDefined();
      expect(data.source.name).toBe("Test Knowledge Source");
    });

    it("should create URL knowledge source", async () => {
      const urlSource = {
        ...mockKnowledgeSource,
        type: "url",
        sourceConfig: { url: "https://example.com" },
      };
      const mockReturning = vi.fn(() => Promise.resolve([urlSource]));
      const mockValues = vi.fn(() => ({
        returning: mockReturning,
      }));
      vi.mocked(db.insert).mockImplementation(() => ({
        values: mockValues,
      }) as never);

      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Website Knowledge",
          type: "url",
          sourceConfig: {
            url: "https://example.com",
            crawlDepth: 2,
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source.type).toBe("url");
    });

    it("should return 400 when name is missing", async () => {
      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          type: "text",
          sourceConfig: { content: "Test" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Source name is required");
    });

    it("should return 400 when type is missing", async () => {
      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Source",
          sourceConfig: { content: "Test" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Source type is required");
    });

    it("should return 400 when URL is missing for url type", async () => {
      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Source",
          type: "url",
          sourceConfig: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("URL is required for URL sources");
    });

    it("should return 400 when content is missing for text type", async () => {
      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Source",
          type: "text",
          sourceConfig: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Content is required for text sources");
    });

    it("should require company admin authorization", async () => {
      vi.mocked(requireCompanyAdmin).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Source",
          type: "text",
          sourceConfig: { content: "Test" },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it("should return 404 when company not found", async () => {
      vi.mocked(getCurrentCompany).mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Source",
          type: "text",
          sourceConfig: { content: "Test" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Company not found");
    });

    it("should set status to pending initially", async () => {
      const mockReturning = vi.fn(() =>
        Promise.resolve([{ ...mockKnowledgeSource, status: "pending" }])
      );
      const mockValues = vi.fn(() => ({
        returning: mockReturning,
      }));
      vi.mocked(db.insert).mockImplementation(() => ({
        values: mockValues,
      }) as never);

      const request = new NextRequest("http://localhost/api/company/knowledge", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Source",
          type: "text",
          sourceConfig: { content: "Test content" },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source.status).toBe("pending");
    });
  });
});
