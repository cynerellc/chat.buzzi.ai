/**
 * Auth Interceptor
 *
 * Intercepts message processing to check authentication requirements
 * and manage the auth flow for packages with auth guards.
 */

import type {
  AuthGuard,
  AuthSession,
  AuthContext,
  AuthRequirement,
  LoginStep,
  ChannelType,
  VariableAccessor,
} from "@buzzi-ai/agent-sdk";
import { checkAuthRequirement } from "@buzzi-ai/agent-sdk";
import {
  AuthSessionStorage,
  createAuthSessionStorage,
  type AuthState,
} from "@/lib/auth/session-storage";

/**
 * Result of auth check
 */
export interface AuthCheckResult {
  /** Whether to proceed with message processing */
  proceed: boolean;
  /** Auth session (if authenticated) */
  authSession?: AuthSession;
  /** Pending auth info (if auth required but not authenticated) */
  pendingAuth?: {
    step: LoginStep;
    aiPrompt: string;
  };
  /** Permission denied info */
  permissionDenied?: {
    reason: string;
    requiredRoles?: string[];
  };
  /** Current auth state */
  authState: AuthState;
}

/**
 * Result of processing auth input
 */
export interface AuthInputResult {
  /** Whether step completed successfully */
  success: boolean;
  /** Next login step (if more steps needed) */
  nextStep?: LoginStep;
  /** Error message */
  error?: string;
  /** Completed session */
  session?: AuthSession;
}

/**
 * Auth interceptor options
 */
export interface AuthInterceptorOptions {
  /** Chatbot ID */
  chatbotId: string;
  /** Company ID */
  companyId: string;
  /** Auth guard from package */
  authGuard: AuthGuard | null;
  /** Package auth config */
  authConfig?: {
    sessionDurationHours?: number;
    requireAuthForAgents?: string[];
    requireAuthForTools?: string[];
    globalAuthRequired?: boolean;
  };
}

/**
 * Auth Interceptor
 *
 * Handles authentication flow for packages with auth guards:
 * - Checks if user is authenticated
 * - Returns pending auth step if auth required but not logged in
 * - Processes auth input from users
 * - Manages session storage
 */
export class AuthInterceptor {
  private storage: AuthSessionStorage;
  private authGuard: AuthGuard | null;
  private chatbotId: string;
  private companyId: string;
  private authConfig: AuthInterceptorOptions["authConfig"];

  constructor(options: AuthInterceptorOptions) {
    this.chatbotId = options.chatbotId;
    this.companyId = options.companyId;
    this.authGuard = options.authGuard;
    this.authConfig = options.authConfig;
    this.storage = createAuthSessionStorage(options.chatbotId);
  }

  /**
   * Check auth before processing a message
   * Called BEFORE message goes to AI
   *
   * @param endUserId - End user ID
   * @param agentId - Target agent ID (for agent-level auth checks)
   * @param agentAuth - Agent's auth requirement (if any)
   */
  async checkAuth(
    endUserId: string,
    agentId?: string,
    agentAuth?: AuthRequirement
  ): Promise<AuthCheckResult> {
    // No auth guard = no auth required
    if (!this.authGuard) {
      return { proceed: true, authState: "anonymous" };
    }

    // Get current session state
    const state = await this.storage.getState(endUserId);

    // Determine auth requirement
    const requirement = this.getAuthRequirement(agentId, agentAuth);

    // If in pending state, return current step
    if (state?.authState === "pending" && state.currentStep) {
      const steps = this.authGuard.getLoginSteps();
      const step = steps.find((s) => s.id === state.currentStep);

      if (step) {
        return {
          proceed: false,
          authState: "pending",
          pendingAuth: {
            step,
            aiPrompt: step.aiPrompt,
          },
        };
      }
    }

    // Check if authenticated
    if (state?.authState === "authenticated") {
      // Get full session for permission checks
      const session = await this.storage.get(endUserId);

      if (session) {
        // Validate session with auth guard if it has validator
        if (this.authGuard.validateSession) {
          const isValid = await this.authGuard.validateSession(session);
          if (!isValid) {
            // Session invalidated by auth guard
            await this.storage.clear(endUserId);
            return this.startAuthFlow(endUserId, requirement);
          }
        }

        // Check permission requirements
        const permCheck = checkAuthRequirement(session, requirement ?? undefined);
        if (!permCheck.pass) {
          return {
            proceed: false,
            authState: "authenticated",
            authSession: session,
            permissionDenied: {
              reason: permCheck.error || "Permission denied",
              requiredRoles: requirement?.roles,
            },
          };
        }

        // Authenticated and has permissions
        return {
          proceed: true,
          authState: "authenticated",
          authSession: session,
        };
      }
    }

    // Not authenticated - check if auth is required
    if (!requirement?.required) {
      return { proceed: true, authState: "anonymous" };
    }

    // Auth required but not logged in - start auth flow
    return this.startAuthFlow(endUserId, requirement);
  }

  /**
   * Start the auth flow by returning the first step
   */
  private async startAuthFlow(
    endUserId: string,
    _requirement?: AuthRequirement | null
  ): Promise<AuthCheckResult> {
    if (!this.authGuard) {
      return { proceed: true, authState: "anonymous" };
    }

    const steps = this.authGuard.getLoginSteps();
    if (steps.length === 0) {
      return { proceed: true, authState: "anonymous" };
    }

    const firstStep = steps[0];
    if (!firstStep) {
      return { proceed: true, authState: "anonymous" };
    }

    // Set pending state
    await this.storage.setPending(endUserId, firstStep.id);

    return {
      proceed: false,
      authState: "pending",
      pendingAuth: {
        step: firstStep,
        aiPrompt: firstStep.aiPrompt,
      },
    };
  }

  /**
   * Process auth input from user
   *
   * @param endUserId - End user ID
   * @param conversationId - Conversation ID
   * @param stepId - Current step ID
   * @param values - Field values from user
   * @param contextData - Additional context data
   */
  async processAuthInput(
    endUserId: string,
    conversationId: string,
    stepId: string,
    values: Record<string, string>,
    contextData: {
      channel: ChannelType;
      variables: VariableAccessor;
      securedVariables: VariableAccessor;
    }
  ): Promise<AuthInputResult> {
    if (!this.authGuard) {
      return { success: false, error: "No auth guard configured" };
    }

    // Get any pending values from previous steps
    const pendingValues = await this.storage.getPendingValues(endUserId);
    const allValues = { ...pendingValues, ...values };

    // Build auth context (no message access!)
    const authContext: AuthContext = {
      conversationId,
      companyId: this.companyId,
      chatbotId: this.chatbotId,
      endUserId,
      channel: contextData.channel,
      variables: contextData.variables,
      securedVariables: contextData.securedVariables,
    };

    // Call package auth guard
    const result = await this.authGuard.onStepComplete(
      stepId,
      allValues,
      authContext
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Login complete - store session
    if (result.session) {
      await this.storage.set(endUserId, result.session);
      return { success: true, session: result.session };
    }

    // Move to next step
    if (result.nextStep) {
      const steps = this.authGuard.getLoginSteps();
      const nextStep = steps.find((s) => s.id === result.nextStep);

      if (!nextStep) {
        return { success: false, error: "Invalid next step" };
      }

      // Store pending state with accumulated values
      await this.storage.setPending(endUserId, result.nextStep, allValues);

      return { success: true, nextStep };
    }

    return { success: false, error: "Unexpected auth result" };
  }

  /**
   * Logout - clear session
   */
  async logout(
    endUserId: string,
    conversationId: string,
    contextData?: {
      channel: ChannelType;
      variables: VariableAccessor;
      securedVariables: VariableAccessor;
    }
  ): Promise<void> {
    // Get session before clearing for onLogout callback
    const session = await this.storage.get(endUserId);

    if (session && this.authGuard?.onLogout && contextData) {
      const authContext: AuthContext = {
        conversationId,
        companyId: this.companyId,
        chatbotId: this.chatbotId,
        endUserId,
        channel: contextData.channel,
        variables: contextData.variables,
        securedVariables: contextData.securedVariables,
      };

      await this.authGuard.onLogout(session, authContext);
    }

    await this.storage.clear(endUserId);
  }

  /**
   * Get current auth session (if authenticated)
   */
  async getSession(endUserId: string): Promise<AuthSession | null> {
    return this.storage.get(endUserId);
  }

  /**
   * Get current auth state
   */
  async getAuthState(endUserId: string): Promise<{
    authState: AuthState;
    currentStep?: string;
    roles: string[];
    expiresAt: number;
  } | null> {
    return this.storage.getState(endUserId);
  }

  /**
   * Determine auth requirement based on package config and agent-level config
   */
  private getAuthRequirement(
    agentId?: string,
    agentAuth?: AuthRequirement
  ): AuthRequirement | null {
    // Global auth required
    if (this.authConfig?.globalAuthRequired) {
      return { required: true };
    }

    // Agent-level auth from package config
    if (agentId && this.authConfig?.requireAuthForAgents?.includes(agentId)) {
      return { required: true };
    }

    // Agent-level auth from agent definition
    if (agentAuth) {
      return agentAuth;
    }

    return null;
  }

  /**
   * Check if a tool requires auth
   */
  toolRequiresAuth(toolName: string): boolean {
    if (this.authConfig?.globalAuthRequired) {
      return true;
    }

    return this.authConfig?.requireAuthForTools?.includes(toolName) ?? false;
  }
}

/**
 * Create an auth interceptor instance
 */
export function createAuthInterceptor(
  options: AuthInterceptorOptions
): AuthInterceptor {
  return new AuthInterceptor(options);
}
