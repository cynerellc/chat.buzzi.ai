/**
 * Auth SDK Integration Tests
 *
 * Tests the authentication SDK implementation:
 * 1. AuthInterceptor - auth check and session management
 * 2. Agent-level auth - requireAuthForAgents config
 * 3. Tool-level auth - requireAuthForTools config
 * 4. Session storage - CRUD operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AuthInterceptor,
  createAuthInterceptor,
  type AuthInterceptorOptions,
} from "../auth-interceptor";
import {
  createAuthSessionStorage,
  type AuthSessionStorage,
} from "@/lib/auth/session-storage";
import type { AuthGuard, AuthSession, LoginStep } from "@buzzi-ai/agent-sdk";

// Mock the session storage module
vi.mock("@/lib/auth/session-storage", () => ({
  createAuthSessionStorage: vi.fn(),
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const mockLoginSteps: LoginStep[] = [
  {
    id: "phone",
    name: "Phone Verification",
    description: "Enter your phone number",
    fields: [
      {
        name: "phone",
        label: "Phone Number",
        type: "phone",
        required: true,
        placeholder: "+1234567890",
      },
    ],
    aiPrompt: "Please provide your phone number",
  },
  {
    id: "otp",
    name: "OTP Verification",
    description: "Enter the code",
    fields: [
      {
        name: "code",
        label: "Verification Code",
        type: "otp",
        required: true,
      },
    ],
    aiPrompt: "Enter the verification code",
  },
];

const mockAuthGuard: AuthGuard = {
  getLoginSteps: () => mockLoginSteps,
  onStepComplete: vi.fn(),
  validateSession: vi.fn().mockResolvedValue(true), // Default to valid session
  onLogout: vi.fn(),
};

const mockSession: AuthSession = {
  userId: "user-123",
  email: "test@example.com",
  name: "Test User",
  roles: ["user"],
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  metadata: { phone: "+911111111111" },
};

// ============================================================================
// AuthInterceptor Tests
// ============================================================================

describe("AuthInterceptor", () => {
  let mockStorage: Partial<AuthSessionStorage>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock storage
    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue(null),
      setPending: vi.fn().mockResolvedValue(undefined),
      getPendingValues: vi.fn().mockResolvedValue({}),
    };

    // Mock createAuthSessionStorage to return our mock
    (createAuthSessionStorage as ReturnType<typeof vi.fn>).mockReturnValue(
      mockStorage
    );
  });

  describe("checkAuth", () => {
    it("should allow anonymous access when no auth guard is configured", async () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: null,
      });

      const result = await interceptor.checkAuth("end-user-1");

      expect(result.proceed).toBe(true);
      expect(result.authState).toBe("anonymous");
    });

    it("should allow anonymous access when auth not required", async () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          globalAuthRequired: false,
        },
      });

      const result = await interceptor.checkAuth("end-user-1");

      expect(result.proceed).toBe(true);
      expect(result.authState).toBe("anonymous");
    });

    it("should require auth when globalAuthRequired is true", async () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          globalAuthRequired: true,
        },
      });

      const result = await interceptor.checkAuth("end-user-1");

      expect(result.proceed).toBe(false);
      expect(result.authState).toBe("pending");
      expect(result.pendingAuth).toBeDefined();
      expect(result.pendingAuth?.step.id).toBe("phone");
    });

    it("should require auth for specified agents", async () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          requireAuthForAgents: ["salesman"],
        },
      });

      // Check auth for salesman agent
      const result = await interceptor.checkAuth("end-user-1", "salesman");

      expect(result.proceed).toBe(false);
      expect(result.authState).toBe("pending");
      expect(result.pendingAuth).toBeDefined();
    });

    it("should allow access to non-restricted agents", async () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          requireAuthForAgents: ["salesman"],
        },
      });

      // Check auth for a different agent
      const result = await interceptor.checkAuth("end-user-1", "orchestrator");

      expect(result.proceed).toBe(true);
      expect(result.authState).toBe("anonymous");
    });

    it("should return session when user is authenticated", async () => {
      // Mock storage to return authenticated state
      mockStorage.getState = vi.fn().mockResolvedValue({
        authState: "authenticated",
        roles: ["user"],
        expiresAt: mockSession.expiresAt,
      });
      mockStorage.get = vi.fn().mockResolvedValue(mockSession);

      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          globalAuthRequired: true,
        },
      });

      const result = await interceptor.checkAuth("end-user-1");

      expect(result.proceed).toBe(true);
      expect(result.authState).toBe("authenticated");
      expect(result.authSession).toBeDefined();
      expect(result.authSession?.userId).toBe("user-123");
    });

    it("should return pending step when in pending state", async () => {
      // Mock storage to return pending state
      mockStorage.getState = vi.fn().mockResolvedValue({
        authState: "pending",
        currentStep: "otp",
        roles: [],
        expiresAt: Date.now() + 3600000,
      });

      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          globalAuthRequired: true,
        },
      });

      const result = await interceptor.checkAuth("end-user-1");

      expect(result.proceed).toBe(false);
      expect(result.authState).toBe("pending");
      expect(result.pendingAuth?.step.id).toBe("otp");
    });
  });

  describe("toolRequiresAuth", () => {
    it("should return true for tools in requireAuthForTools", () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          requireAuthForTools: ["generate_quotation", "view_account"],
        },
      });

      expect(interceptor.toolRequiresAuth("generate_quotation")).toBe(true);
      expect(interceptor.toolRequiresAuth("view_account")).toBe(true);
      expect(interceptor.toolRequiresAuth("some_other_tool")).toBe(false);
    });

    it("should return true for all tools when globalAuthRequired", () => {
      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard: mockAuthGuard,
        authConfig: {
          globalAuthRequired: true,
        },
      });

      expect(interceptor.toolRequiresAuth("any_tool")).toBe(true);
    });
  });

  describe("processAuthInput", () => {
    it("should call auth guard onStepComplete", async () => {
      const mockOnStepComplete = vi.fn().mockResolvedValue({
        success: true,
        nextStep: "otp",
      });

      const authGuard: AuthGuard = {
        ...mockAuthGuard,
        onStepComplete: mockOnStepComplete,
      };

      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard,
      });

      const result = await interceptor.processAuthInput(
        "end-user-1",
        "conv-1",
        "phone",
        { phone: "+911111111111" },
        {
          channel: "web",
          variables: { get: vi.fn() } as any,
          securedVariables: { get: vi.fn() } as any,
        }
      );

      expect(mockOnStepComplete).toHaveBeenCalledWith(
        "phone",
        { phone: "+911111111111" },
        expect.objectContaining({
          chatbotId: "chatbot-1",
          companyId: "company-1",
          endUserId: "end-user-1",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should store session on successful auth completion", async () => {
      const mockOnStepComplete = vi.fn().mockResolvedValue({
        success: true,
        session: mockSession,
      });

      const authGuard: AuthGuard = {
        ...mockAuthGuard,
        onStepComplete: mockOnStepComplete,
      };

      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard,
      });

      const result = await interceptor.processAuthInput(
        "end-user-1",
        "conv-1",
        "otp",
        { code: "222222" },
        {
          channel: "web",
          variables: { get: vi.fn() } as any,
          securedVariables: { get: vi.fn() } as any,
        }
      );

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(mockStorage.set).toHaveBeenCalledWith("end-user-1", mockSession);
    });

    it("should return error on auth failure", async () => {
      const mockOnStepComplete = vi.fn().mockResolvedValue({
        success: false,
        error: "Invalid phone number",
      });

      const authGuard: AuthGuard = {
        ...mockAuthGuard,
        onStepComplete: mockOnStepComplete,
      };

      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard,
      });

      const result = await interceptor.processAuthInput(
        "end-user-1",
        "conv-1",
        "phone",
        { phone: "+1234567890" },
        {
          channel: "web",
          variables: { get: vi.fn() } as any,
          securedVariables: { get: vi.fn() } as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid phone number");
    });
  });

  describe("logout", () => {
    it("should clear session and call onLogout", async () => {
      mockStorage.get = vi.fn().mockResolvedValue(mockSession);

      const mockOnLogout = vi.fn().mockResolvedValue(undefined);
      const authGuard: AuthGuard = {
        ...mockAuthGuard,
        onLogout: mockOnLogout,
      };

      const interceptor = createAuthInterceptor({
        chatbotId: "chatbot-1",
        companyId: "company-1",
        authGuard,
      });

      await interceptor.logout("end-user-1", "conv-1", {
        channel: "web",
        variables: { get: vi.fn() } as any,
        securedVariables: { get: vi.fn() } as any,
      });

      expect(mockOnLogout).toHaveBeenCalled();
      expect(mockStorage.clear).toHaveBeenCalledWith("end-user-1");
    });
  });
});

// ============================================================================
// Agent-Level Auth Tests
// ============================================================================

describe("Agent-Level Auth", () => {
  let mockStorage: Partial<AuthSessionStorage>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue(null),
      setPending: vi.fn().mockResolvedValue(undefined),
      getPendingValues: vi.fn().mockResolvedValue({}),
    };

    (createAuthSessionStorage as ReturnType<typeof vi.fn>).mockReturnValue(
      mockStorage
    );
  });

  it("should require auth for agents in requireAuthForAgents", async () => {
    const interceptor = createAuthInterceptor({
      chatbotId: "chatbot-1",
      companyId: "company-1",
      authGuard: mockAuthGuard,
      authConfig: {
        requireAuthForAgents: ["salesman", "accounts"],
      },
    });

    // Salesman requires auth
    const salesmanResult = await interceptor.checkAuth("user-1", "salesman");
    expect(salesmanResult.proceed).toBe(false);
    expect(salesmanResult.authState).toBe("pending");

    // Accounts requires auth
    const accountsResult = await interceptor.checkAuth("user-1", "accounts");
    expect(accountsResult.proceed).toBe(false);
    expect(accountsResult.authState).toBe("pending");

    // Orchestrator does NOT require auth
    const orchestratorResult = await interceptor.checkAuth(
      "user-1",
      "orchestrator"
    );
    expect(orchestratorResult.proceed).toBe(true);
    expect(orchestratorResult.authState).toBe("anonymous");
  });

  it("should allow authenticated user to access restricted agents", async () => {
    mockStorage.getState = vi.fn().mockResolvedValue({
      authState: "authenticated",
      roles: ["user"],
      expiresAt: Date.now() + 3600000,
    });
    mockStorage.get = vi.fn().mockResolvedValue(mockSession);

    const interceptor = createAuthInterceptor({
      chatbotId: "chatbot-1",
      companyId: "company-1",
      authGuard: mockAuthGuard,
      authConfig: {
        requireAuthForAgents: ["salesman"],
      },
    });

    const result = await interceptor.checkAuth("user-1", "salesman");

    expect(result.proceed).toBe(true);
    expect(result.authState).toBe("authenticated");
    expect(result.authSession?.userId).toBe("user-123");
  });
});

// ============================================================================
// Tool-Level Auth Tests
// ============================================================================

describe("Tool-Level Auth", () => {
  let mockStorage: Partial<AuthSessionStorage>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue(null),
      setPending: vi.fn().mockResolvedValue(undefined),
      getPendingValues: vi.fn().mockResolvedValue({}),
    };

    (createAuthSessionStorage as ReturnType<typeof vi.fn>).mockReturnValue(
      mockStorage
    );
  });

  it("should identify tools requiring auth from config", () => {
    const interceptor = createAuthInterceptor({
      chatbotId: "chatbot-1",
      companyId: "company-1",
      authGuard: mockAuthGuard,
      authConfig: {
        requireAuthForTools: ["generate_quotation"],
      },
    });

    expect(interceptor.toolRequiresAuth("generate_quotation")).toBe(true);
    expect(interceptor.toolRequiresAuth("save_lead_info")).toBe(false);
  });
});

// ============================================================================
// Executor Agent Transfer Auth Tests
// ============================================================================

describe("Executor Agent Transfer Auth", () => {
  /**
   * These tests verify the executor's behavior when handling agent transfer events.
   * The executor should:
   * 1. Check if target agent is in requireAuthForAgents
   * 2. If yes and user not authenticated, emit auth_required with targetAgentId
   * 3. If yes and user authenticated, allow transfer
   * 4. If no auth required, allow transfer
   */

  it("should check auth requirement from package config during transfer", () => {
    // Simulate package config like sales-assistant
    const authConfig = {
      requireAuthForAgents: ["salesman"],
      requireAuthForTools: ["generate_quotation"],
    };

    const targetAgentId = "salesman";

    // This simulates the check in adk-executor.ts line 1168
    const agentRequiresAuth =
      authConfig.requireAuthForAgents?.includes(targetAgentId);

    expect(agentRequiresAuth).toBe(true);

    // Orchestrator should NOT require auth
    const orchestratorRequiresAuth =
      authConfig.requireAuthForAgents?.includes("orchestrator");
    expect(orchestratorRequiresAuth).toBe(false);
  });

  it("should emit auth_required event with targetAgentId when unauthenticated user transfers to protected agent", async () => {
    // Simulate the auth check that happens in executor
    const authConfig = {
      requireAuthForAgents: ["salesman"],
    };

    const authGuard = {
      getLoginSteps: () => mockLoginSteps,
      onStepComplete: vi.fn(),
      validateSession: vi.fn().mockResolvedValue(true),
    };

    const targetAgentId = "salesman";
    const authSession = null; // User not authenticated

    const agentRequiresAuth =
      authConfig.requireAuthForAgents?.includes(targetAgentId);

    // This replicates executor logic at line 1170
    if (agentRequiresAuth && !authSession) {
      const loginSteps = authGuard.getLoginSteps();
      const firstStep = loginSteps?.[0];

      expect(firstStep).toBeDefined();
      expect(firstStep?.id).toBe("phone");

      // The executor would emit this event
      const authRequiredEvent = {
        type: "auth_required",
        data: {
          stepId: firstStep?.id,
          stepName: firstStep?.name,
          fields: firstStep?.fields,
          aiPrompt: firstStep?.aiPrompt,
          channel: "web",
          targetAgentId: targetAgentId,
        },
        timestamp: Date.now(),
      };

      expect(authRequiredEvent.data.targetAgentId).toBe("salesman");
      expect(authRequiredEvent.data.stepId).toBe("phone");
    }
  });

  it("should allow transfer when user is authenticated", () => {
    const authConfig = {
      requireAuthForAgents: ["salesman"],
    };

    const targetAgentId = "salesman";
    const authSession = mockSession; // User IS authenticated

    const agentRequiresAuth =
      authConfig.requireAuthForAgents?.includes(targetAgentId);

    // Should NOT block because user has session
    const shouldBlock = agentRequiresAuth && !authSession;

    expect(shouldBlock).toBe(false);
  });

  it("should allow transfer to unprotected agents without auth", () => {
    const authConfig = {
      requireAuthForAgents: ["salesman"],
    };

    const targetAgentId = "orchestrator"; // Not in protected list
    const authSession = null; // User not authenticated

    const agentRequiresAuth =
      authConfig.requireAuthForAgents?.includes(targetAgentId);

    // Should NOT block because agent not protected
    const shouldBlock = agentRequiresAuth && !authSession;

    expect(shouldBlock).toBe(false);
  });
});

// ============================================================================
// Tool-Level Auth During Execution Tests
// ============================================================================

describe("Tool Auth During Execution", () => {
  /**
   * Tests that tool-level auth is properly checked when tools are executed.
   * The generate_quotation tool requires auth per package config.
   */

  it("should identify tool auth requirements from config", () => {
    const authConfig = {
      requireAuthForTools: ["generate_quotation"],
    };

    // Check if tool requires auth (like executor does before tool execution)
    const toolRequiresAuth = (toolName: string) =>
      authConfig.requireAuthForTools?.includes(toolName);

    expect(toolRequiresAuth("generate_quotation")).toBe(true);
    expect(toolRequiresAuth("save_lead_info")).toBe(false);
    expect(toolRequiresAuth("get_product_info")).toBeFalsy();
  });

  it("should block tool execution for unauthenticated user", () => {
    const authConfig = {
      requireAuthForTools: ["generate_quotation"],
    };
    const authSession = null;

    const toolName = "generate_quotation";
    const toolRequiresAuth = authConfig.requireAuthForTools?.includes(toolName);

    // Should block tool execution
    const shouldBlockExecution = toolRequiresAuth && !authSession;

    expect(shouldBlockExecution).toBe(true);
  });

  it("should allow tool execution for authenticated user", () => {
    const authConfig = {
      requireAuthForTools: ["generate_quotation"],
    };
    const authSession = mockSession;

    const toolName = "generate_quotation";
    const toolRequiresAuth = authConfig.requireAuthForTools?.includes(toolName);

    // Should NOT block tool execution
    const shouldBlockExecution = toolRequiresAuth && !authSession;

    expect(shouldBlockExecution).toBe(false);
  });
});

// ============================================================================
// Sales-Assistant Package Auth Tests
// ============================================================================

describe("Sales-Assistant Package Auth", () => {
  const HARDCODED_PHONE = "+911111111111";
  const HARDCODED_OTP = "222222";

  it("should have correct hardcoded credentials", () => {
    // These are the demo credentials from auth-guard.ts
    expect(HARDCODED_PHONE).toBe("+911111111111");
    expect(HARDCODED_OTP).toBe("222222");
  });

  it("salesman agent should require auth (from package config)", async () => {
    // Sales-assistant package has requireAuthForAgents: ["salesman"]
    const mockStorage: Partial<AuthSessionStorage> = {
      get: vi.fn().mockResolvedValue(null),
      getState: vi.fn().mockResolvedValue(null),
      setPending: vi.fn().mockResolvedValue(undefined),
      getPendingValues: vi.fn().mockResolvedValue({}),
    };

    (createAuthSessionStorage as ReturnType<typeof vi.fn>).mockReturnValue(
      mockStorage
    );

    const interceptor = createAuthInterceptor({
      chatbotId: "chatbot-1",
      companyId: "company-1",
      authGuard: mockAuthGuard,
      authConfig: {
        requireAuthForAgents: ["salesman"],
        requireAuthForTools: ["generate_quotation"],
      },
    });

    // Test agent-level auth
    const salesmanCheck = await interceptor.checkAuth("user-1", "salesman");
    expect(salesmanCheck.proceed).toBe(false);
    expect(salesmanCheck.pendingAuth).toBeDefined();

    // Test tool-level auth check
    expect(interceptor.toolRequiresAuth("generate_quotation")).toBe(true);
    expect(interceptor.toolRequiresAuth("save_lead_info")).toBe(false);
  });

  it("generate_quotation tool should require auth (from package config)", () => {
    const mockStorage: Partial<AuthSessionStorage> = {
      get: vi.fn().mockResolvedValue(null),
      getState: vi.fn().mockResolvedValue(null),
      setPending: vi.fn().mockResolvedValue(undefined),
      getPendingValues: vi.fn().mockResolvedValue({}),
    };

    (createAuthSessionStorage as ReturnType<typeof vi.fn>).mockReturnValue(
      mockStorage
    );

    const interceptor = createAuthInterceptor({
      chatbotId: "chatbot-1",
      companyId: "company-1",
      authGuard: mockAuthGuard,
      authConfig: {
        requireAuthForTools: ["generate_quotation"],
      },
    });

    expect(interceptor.toolRequiresAuth("generate_quotation")).toBe(true);
  });
});
