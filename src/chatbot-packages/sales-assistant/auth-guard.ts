/**
 * Sales Assistant Auth Guard
 *
 * Example implementation of an auth guard for the sales assistant package.
 * This demonstrates how to implement multi-step authentication flows.
 *
 * Package Variables Required:
 * - AUTH_API_URL (secured_variable): URL of the customer's auth API
 * - AUTH_API_KEY (secured_variable): API key for authentication
 *
 * Example Login Flows:
 * 1. Email/Password: Single step with email and password fields
 * 2. Phone/OTP: Two steps - phone number, then OTP verification
 */

import type {
  AuthGuard,
  LoginStep,
  StepResult,
  AuthContext,
  AuthSession,
} from "@buzzi-ai/agent-sdk";

/**
 * Auth guard implementation for the sales assistant
 *
 * This example shows a two-step phone/OTP authentication flow.
 * Customize this for your specific authentication requirements.
 */
export const authGuard: AuthGuard = {
  /**
   * Define the login steps
   * This example uses phone + OTP verification
   */
  getLoginSteps(): LoginStep[] {
    return [
      {
        id: "phone",
        name: "Phone Verification",
        description: "Enter your phone number to receive a verification code",
        fields: [
          {
            name: "phone",
            label: "Phone Number",
            type: "phone",
            required: true,
            placeholder: "+1 (555) 000-0000",
            validation: {
              pattern: "^\\+?[1-9]\\d{1,14}$",
              minLength: 10,
              maxLength: 15,
            },
          },
        ],
        aiPrompt:
          "To access your account information, I need to verify your identity. What is your phone number?",
      },
      {
        id: "otp",
        name: "Verification Code",
        description: "Enter the 6-digit code sent to your phone",
        fields: [
          {
            name: "code",
            label: "Verification Code",
            type: "otp",
            required: true,
            placeholder: "000000",
            validation: {
              pattern: "^\\d{6}$",
              minLength: 6,
              maxLength: 6,
            },
          },
        ],
        aiPrompt:
          "I've sent a 6-digit verification code to your phone. Please enter the code to continue.",
      },
    ];
  },

  /**
   * Process each step of the authentication flow
   */
  async onStepComplete(
    stepId: string,
    values: Record<string, string>,
    context: AuthContext
  ): Promise<StepResult> {
    // Get auth API configuration from secured variables
    const authApiUrl = context.securedVariables.get("AUTH_API_URL");
    const authApiKey = context.securedVariables.get("AUTH_API_KEY");

    // If no auth API configured, use mock authentication for demo
    if (!authApiUrl) {
      return mockAuthentication(stepId, values);
    }

    try {
      if (stepId === "phone") {
        // Step 1: Send OTP to phone number
        const response = await fetch(`${authApiUrl}/auth/send-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authApiKey}`,
          },
          body: JSON.stringify({
            phone: values.phone,
            chatbotId: context.chatbotId,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return {
            success: false,
            error: error.message || "Failed to send verification code",
          };
        }

        // OTP sent successfully - move to next step
        return {
          success: true,
          nextStep: "otp",
        };
      }

      if (stepId === "otp") {
        // Step 2: Verify OTP and get session
        const response = await fetch(`${authApiUrl}/auth/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authApiKey}`,
          },
          body: JSON.stringify({
            phone: values.phone, // From previous step
            code: values.code,
            chatbotId: context.chatbotId,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return {
            success: false,
            error: error.message || "Invalid verification code",
          };
        }

        const data = await response.json();

        // Return authenticated session
        return {
          success: true,
          session: {
            userId: data.userId,
            email: data.email,
            name: data.name,
            roles: data.roles || ["user"],
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            metadata: {
              phone: values.phone,
              customerId: data.customerId,
            },
          },
        };
      }

      return { success: false, error: "Unknown step" };
    } catch (error) {
      console.error("Auth step error:", error);
      return {
        success: false,
        error: "Authentication service unavailable",
      };
    }
  },

  /**
   * Optional: Validate session on each request
   * Return false to force re-authentication
   */
  async validateSession(session: AuthSession): Promise<boolean> {
    // Check if session has expired
    if (session.expiresAt < Date.now()) {
      return false;
    }

    // Add any additional validation logic here
    // For example, check with auth API if session is still valid

    return true;
  },

  /**
   * Optional: Handle logout
   * Called when user explicitly logs out
   */
  async onLogout(session: AuthSession, context: AuthContext): Promise<void> {
    const authApiUrl = context.securedVariables.get("AUTH_API_URL");
    const authApiKey = context.securedVariables.get("AUTH_API_KEY");

    if (authApiUrl && authApiKey) {
      try {
        await fetch(`${authApiUrl}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authApiKey}`,
          },
          body: JSON.stringify({
            userId: session.userId,
            chatbotId: context.chatbotId,
          }),
        });
      } catch {
        // Ignore logout errors - session will be cleared anyway
      }
    }
  },
};

// ============================================================================
// Hardcoded Test Credentials
// ============================================================================
const HARDCODED_PHONE = "+911111111111";
const HARDCODED_OTP = "222222";

// Hardcoded session returned on successful authentication
const HARDCODED_SESSION: AuthSession = {
  userId: "demo-customer-001",
  email: "john.doe@example.com",
  name: "John Doe",
  roles: ["user", "customer"],
  expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  metadata: {
    phone: HARDCODED_PHONE,
    customerId: "CUST-001",
    company: "Acme Corp",
  },
};

/**
 * Mock authentication for demo/testing
 * Uses hardcoded phone number and OTP
 */
function mockAuthentication(
  stepId: string,
  values: Record<string, string>
): StepResult {
  if (stepId === "phone") {
    // Only accept the hardcoded phone number
    if (values.phone !== HARDCODED_PHONE) {
      return {
        success: false,
        error: `Invalid phone number. For demo, use: ${HARDCODED_PHONE}`,
      };
    }

    console.log(`[Mock Auth] OTP sent to ${values.phone}: ${HARDCODED_OTP}`);
    return {
      success: true,
      nextStep: "otp",
    };
  }

  if (stepId === "otp") {
    // Only accept the hardcoded OTP
    if (values.code !== HARDCODED_OTP) {
      return {
        success: false,
        error: `Invalid code. For demo, use: ${HARDCODED_OTP}`,
      };
    }

    // Return hardcoded session
    return {
      success: true,
      session: HARDCODED_SESSION,
    };
  }

  return { success: false, error: "Unknown step" };
}
