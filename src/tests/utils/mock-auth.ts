/**
 * Auth Mocks
 *
 * Mock implementations for authentication and authorization.
 */

import { vi } from "vitest";
import type { MockUser, MockCompany } from "./test-utils";

// ============================================================================
// Mock Auth State
// ============================================================================

let currentUser: MockUser | null = null;
let currentCompany: MockCompany | null = null;

// ============================================================================
// Mock Auth Functions
// ============================================================================

export const mockRequireMasterAdmin = vi.fn(async () => {
  if (!currentUser || currentUser.role !== "master_admin") {
    throw new Error("Unauthorized");
  }
  return currentUser;
});

export const mockRequireCompanyAdmin = vi.fn(async () => {
  if (!currentUser || currentUser.role !== "company_admin") {
    throw new Error("Unauthorized");
  }
  return currentUser;
});

export const mockRequireSupportAgent = vi.fn(async () => {
  if (!currentUser || currentUser.role !== "support_agent") {
    throw new Error("Unauthorized");
  }
  return currentUser;
});

export const mockGetCurrentUser = vi.fn(async () => currentUser);

export const mockGetCurrentCompany = vi.fn(async () => currentCompany);

// ============================================================================
// Setup and Cleanup
// ============================================================================

export function setMockUser(user: MockUser | null) {
  currentUser = user;
}

export function setMockCompany(company: MockCompany | null) {
  currentCompany = company;
}

export function setupAuthMock() {
  vi.mock("@/lib/auth/guards", () => ({
    requireMasterAdmin: mockRequireMasterAdmin,
    requireCompanyAdmin: mockRequireCompanyAdmin,
    requireSupportAgent: mockRequireSupportAgent,
    getCurrentUser: mockGetCurrentUser,
  }));

  vi.mock("@/lib/auth/tenant", () => ({
    getCurrentCompany: mockGetCurrentCompany,
  }));
}

export function resetAuthMock() {
  currentUser = null;
  currentCompany = null;
  mockRequireMasterAdmin.mockClear();
  mockRequireCompanyAdmin.mockClear();
  mockRequireSupportAgent.mockClear();
  mockGetCurrentUser.mockClear();
  mockGetCurrentCompany.mockClear();
}

// ============================================================================
// Session Mock
// ============================================================================

export const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export function setupSessionMock() {
  vi.mock("next-auth/react", () => ({
    useSession: () => ({
      data: mockSession,
      status: "authenticated",
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(() => Promise.resolve(mockSession)),
  }));
}
