/**
 * Company Escalations API Tests
 *
 * Tests for the escalation management API endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/company/escalations/route";

// Mock auth guards
vi.mock("@/lib/auth/guards", () => ({
  requireCompanyAdmin: vi.fn(),
}));

// Mock tenant
vi.mock("@/lib/auth/tenant", () => ({
  getCurrentCompany: vi.fn(),
}));

// Mock escalation service
vi.mock("@/lib/escalation", () => ({
  getEscalationService: vi.fn(() => ({
    createEscalation: vi.fn(),
  })),
}));

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      offset: vi.fn(() => Promise.resolve([])),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { getEscalationService } from "@/lib/escalation";
import { db } from "@/lib/db";

describe("Company Escalations API", () => {
  const mockCompany = {
    id: "company-123",
    name: "Test Company",
    slug: "test-company",
  };

  const mockEscalation = {
    id: "escalation-123",
    conversationId: "conversation-123",
    status: "pending",
    priority: "medium",
    reason: "Customer requested human agent",
    triggerType: "explicit_request",
    assignedUserId: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCompanyAdmin).mockResolvedValue(undefined);
    vi.mocked(getCurrentCompany).mockResolvedValue(mockCompany as never);
  });

  // ============================================================================
  // GET /api/company/escalations
  // ============================================================================

  describe("GET /api/company/escalations", () => {
    it("should return empty list when no escalations exist", async () => {
      // Mock count query
      const mockCountSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([{ count: 0 }])),
          })),
        })),
      }));

      // Mock escalations query
      const mockEscalationsSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        offset: vi.fn(() => Promise.resolve([])),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      }));

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockEscalationsSelect() as never;
        return mockCountSelect() as never;
      });

      const request = new NextRequest(
        "http://localhost/api/company/escalations"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.escalations).toEqual([]);
      expect(data.pagination).toBeDefined();
    });

    it("should require company admin authorization", async () => {
      vi.mocked(requireCompanyAdmin).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new NextRequest(
        "http://localhost/api/company/escalations"
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("should return 404 when company not found", async () => {
      vi.mocked(getCurrentCompany).mockResolvedValue(null as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Company not found");
    });

    it("should support pagination parameters", async () => {
      const mockSelect = vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        offset: vi.fn(() => Promise.resolve([])),
                      })),
                    })),
                  })),
                })),
              })),
            })),
            where: vi.fn(() => Promise.resolve([{ count: 0 }])),
          })),
        })),
      }));
      vi.mocked(db.select).mockImplementation(mockSelect);

      const request = new NextRequest(
        "http://localhost/api/company/escalations?page=2&limit=10"
      );
      await GET(request);

      expect(mockSelect).toHaveBeenCalled();
    });

    it("should filter by status when provided", async () => {
      const mockWhere = vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: mockWhere,
                })),
              })),
            })),
            where: vi.fn(() => Promise.resolve([{ count: 0 }])),
          })),
        })),
      }) as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations?status=pending"
      );
      await GET(request);

      expect(mockWhere).toHaveBeenCalled();
    });

    it("should filter by priority when provided", async () => {
      const mockWhere = vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                leftJoin: vi.fn(() => ({
                  where: mockWhere,
                })),
              })),
            })),
            where: vi.fn(() => Promise.resolve([{ count: 0 }])),
          })),
        })),
      }) as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations?priority=high"
      );
      await GET(request);

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // POST /api/company/escalations
  // ============================================================================

  describe("POST /api/company/escalations", () => {
    it("should create escalation with valid data", async () => {
      const mockConversation = {
        id: "conversation-123",
        companyId: "company-123",
        status: "active",
      };

      const mockFromChain = vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([mockConversation])),
        })),
      }));
      vi.mocked(db.select).mockImplementation(() => ({
        from: mockFromChain,
      }) as never);

      vi.mocked(getEscalationService).mockReturnValue({
        createEscalation: vi.fn().mockResolvedValue({
          escalationId: "escalation-123",
          routingResult: { assigned: true, agentId: "agent-123" },
        }),
      } as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: "conversation-123",
            reason: "Customer needs immediate help",
            priority: "high",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.escalationId).toBeDefined();
    });

    it("should return 400 when conversationId is missing", async () => {
      const request = new NextRequest(
        "http://localhost/api/company/escalations",
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Customer needs help",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("conversationId is required");
    });

    it("should return 404 when conversation not found", async () => {
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }) as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: "nonexistent-123",
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Conversation not found");
    });

    it("should require company admin authorization", async () => {
      vi.mocked(requireCompanyAdmin).mockRejectedValue(
        new Error("Unauthorized")
      );

      const request = new NextRequest(
        "http://localhost/api/company/escalations",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: "conversation-123",
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it("should use default priority when not provided", async () => {
      const mockConversation = {
        id: "conversation-123",
        companyId: "company-123",
      };

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockConversation])),
          })),
        })),
      }) as never);

      const mockCreateEscalation = vi.fn().mockResolvedValue({
        escalationId: "escalation-123",
        routingResult: {},
      });

      vi.mocked(getEscalationService).mockReturnValue({
        createEscalation: mockCreateEscalation,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: "conversation-123",
          }),
        }
      );

      await POST(request);

      expect(mockCreateEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "medium",
        })
      );
    });

    it("should use default reason when not provided", async () => {
      const mockConversation = {
        id: "conversation-123",
        companyId: "company-123",
      };

      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockConversation])),
          })),
        })),
      }) as never);

      const mockCreateEscalation = vi.fn().mockResolvedValue({
        escalationId: "escalation-123",
        routingResult: {},
      });

      vi.mocked(getEscalationService).mockReturnValue({
        createEscalation: mockCreateEscalation,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/company/escalations",
        {
          method: "POST",
          body: JSON.stringify({
            conversationId: "conversation-123",
          }),
        }
      );

      await POST(request);

      expect(mockCreateEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "Manually escalated by admin",
        })
      );
    });
  });
});
