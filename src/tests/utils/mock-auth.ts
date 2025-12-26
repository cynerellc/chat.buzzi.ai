/**
 * Auth Mocks
 *
 * Mock implementations for authentication and authorization.
 */

import { vi } from "vitest";
import type { MockUser, MockCompany } from "./test-utils";
import type { CompanyPermissionRole } from "@/lib/auth/role-utils";

// ============================================================================
// Mock Auth State
// ============================================================================

let currentUser: MockUser | null = null;
let currentCompany: MockCompany | null = null;
let currentPermissionRole: CompanyPermissionRole | null = null;

// ============================================================================
// Mock Auth Functions
// ============================================================================

export const mockRequireMasterAdmin = vi.fn(async () => {
  if (!currentUser || currentUser.role !== "chatapp.master_admin") {
    throw new Error("Unauthorized");
  }
  return currentUser;
});

export const mockRequireCompanyAdmin = vi.fn(async () => {
  if (!currentUser) {
    throw new Error("Unauthorized");
  }
  // Master admin has access to everything
  if (currentUser.role === "chatapp.master_admin") {
    return {
      user: currentUser,
      company: currentCompany,
      permissionRole: "chatapp.company_admin" as CompanyPermissionRole,
    };
  }
  // Regular users need company_admin permission
  if (currentPermissionRole !== "chatapp.company_admin") {
    throw new Error("Unauthorized");
  }
  return {
    user: currentUser,
    company: currentCompany,
    permissionRole: currentPermissionRole,
  };
});

export const mockRequireSupportAgent = vi.fn(async () => {
  if (!currentUser) {
    throw new Error("Unauthorized");
  }
  // Master admin has access to everything
  if (currentUser.role === "chatapp.master_admin") {
    return {
      user: currentUser,
      company: currentCompany,
      permissionRole: "chatapp.company_admin" as CompanyPermissionRole,
    };
  }
  // Regular users need at least support_agent permission
  if (!currentPermissionRole) {
    throw new Error("Unauthorized");
  }
  return {
    user: currentUser,
    company: currentCompany,
    permissionRole: currentPermissionRole,
  };
});

export const mockGetCurrentUser = vi.fn(async () => currentUser);

export const mockGetActiveCompanyId = vi.fn(async () => currentCompany?.id ?? null);

// ============================================================================
// Setup and Cleanup
// ============================================================================

export function setMockUser(user: MockUser | null) {
  currentUser = user;
}

export function setMockCompany(company: MockCompany | null) {
  currentCompany = company;
}

export function setMockPermissionRole(role: CompanyPermissionRole | null) {
  currentPermissionRole = role;
}

export function setupAuthMock() {
  vi.mock("@/lib/auth/guards", () => ({
    requireMasterAdmin: mockRequireMasterAdmin,
    requireCompanyAdmin: mockRequireCompanyAdmin,
    requireSupportAgent: mockRequireSupportAgent,
    getCurrentUser: mockGetCurrentUser,
  }));

  vi.mock("@/lib/auth/tenant", () => ({
    getActiveCompanyId: mockGetActiveCompanyId,
  }));
}

export function resetAuthMock() {
  currentUser = null;
  currentCompany = null;
  currentPermissionRole = null;
  mockRequireMasterAdmin.mockClear();
  mockRequireCompanyAdmin.mockClear();
  mockRequireSupportAgent.mockClear();
  mockGetCurrentUser.mockClear();
  mockGetActiveCompanyId.mockClear();
}

// ============================================================================
// Session Mock
// ============================================================================

export const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "chatapp.user",
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
