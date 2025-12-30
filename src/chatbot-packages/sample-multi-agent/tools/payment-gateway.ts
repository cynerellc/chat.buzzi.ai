import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/lib/ai/types";

/**
 * Payment Gateway Tool
 *
 * This tool demonstrates how to use package variables to configure
 * external payment gateway integrations. The credentials are stored
 * as package variables (some secured) and accessed at runtime.
 *
 * Required Package Variables:
 * - PAYMENT_GATEWAY_URL (variable): Payment gateway API URL
 * - PAYMENT_GATEWAY_MERCHANT_ID (variable): Merchant account ID
 * - PAYMENT_GATEWAY_API_KEY (secured_variable): API key for authentication
 * - PAYMENT_GATEWAY_SECRET (secured_variable): API secret for signing requests
 */
export const createPaymentGatewayTool = (context: AgentContext) =>
  tool(
    async ({ customerId, action, amount }) => {
      // Access package variables for payment gateway configuration
      const gatewayUrl = context.variables.get("PAYMENT_GATEWAY_URL");
      const merchantId = context.variables.get("PAYMENT_GATEWAY_MERCHANT_ID");
      const apiKey = context.securedVariables.get("PAYMENT_GATEWAY_API_KEY");
      const apiSecret = context.securedVariables.get("PAYMENT_GATEWAY_SECRET");

      // Validate required variables
      if (!gatewayUrl || !merchantId || !apiKey || !apiSecret) {
        return JSON.stringify({
          success: false,
          error: "Payment gateway configuration is incomplete. Please contact the administrator.",
          missingVariables: [
            !gatewayUrl && "PAYMENT_GATEWAY_URL",
            !merchantId && "PAYMENT_GATEWAY_MERCHANT_ID",
            !apiKey && "PAYMENT_GATEWAY_API_KEY",
            !apiSecret && "PAYMENT_GATEWAY_SECRET",
          ].filter(Boolean),
        });
      }

      // Log configuration (for demonstration - don't log secrets in production!)
      console.log("Payment gateway configuration loaded from package variables:");
      console.log("- Gateway URL:", gatewayUrl);
      console.log("- Merchant ID:", merchantId);
      console.log("- API Key:", apiKey ? "[CONFIGURED]" : "[MISSING]");

      // Simulate payment gateway operations
      switch (action) {
        case "check_balance":
          return JSON.stringify({
            success: true,
            customerId,
            balance: {
              available: 1250.0,
              pending: 150.0,
              currency: "USD",
            },
            lastUpdated: new Date().toISOString(),
          });

        case "process_refund":
          if (!amount) {
            return JSON.stringify({
              success: false,
              error: "Amount is required for refund processing",
            });
          }
          return JSON.stringify({
            success: true,
            refund: {
              id: `REF-${Date.now()}`,
              customerId,
              amount,
              status: "processing",
              estimatedCompletion: "3-5 business days",
            },
          });

        case "get_payment_methods":
          return JSON.stringify({
            success: true,
            customerId,
            paymentMethods: [
              {
                id: "pm_1",
                type: "card",
                brand: "visa",
                last4: "4242",
                expiryMonth: 12,
                expiryYear: 2026,
                isDefault: true,
              },
              {
                id: "pm_2",
                type: "card",
                brand: "mastercard",
                last4: "5555",
                expiryMonth: 8,
                expiryYear: 2025,
                isDefault: false,
              },
            ],
          });

        case "get_transactions":
          return JSON.stringify({
            success: true,
            customerId,
            transactions: [
              {
                id: "txn_001",
                amount: 99.99,
                status: "completed",
                date: "2025-01-15",
                description: "Monthly subscription",
              },
              {
                id: "txn_002",
                amount: 49.99,
                status: "completed",
                date: "2024-12-15",
                description: "Monthly subscription",
              },
            ],
          });

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown action: ${action}`,
          });
      }
    },
    {
      name: "payment_gateway",
      description:
        "Interact with the payment gateway to check customer balance, process refunds, view payment methods, and retrieve transaction history. Requires proper configuration.",
      schema: z.object({
        customerId: z.string().describe("The customer ID in the payment system"),
        action: z
          .enum(["check_balance", "process_refund", "get_payment_methods", "get_transactions"])
          .describe("The action to perform"),
        amount: z
          .number()
          .optional()
          .describe("Amount for refund processing (required for process_refund action)"),
      }),
    }
  );
