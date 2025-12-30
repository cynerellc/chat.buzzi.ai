import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { billingInfoTool, paymentHistoryTool, createPaymentGatewayTool } from "../tools";

/**
 * Billing Agent Configuration
 *
 * Specialized worker agent for handling billing and account inquiries:
 * - Invoice and payment questions
 * - Subscription management
 * - Account balance inquiries
 * - Payment method updates
 * - Refund processing via payment gateway
 *
 * Agent ID: 7a9b1c3d
 *
 * Required Package Variables:
 * - PAYMENT_GATEWAY_URL (variable): Payment gateway API URL
 * - PAYMENT_GATEWAY_MERCHANT_ID (variable): Merchant account ID
 * - PAYMENT_GATEWAY_API_KEY (secured_variable): API key for authentication
 * - PAYMENT_GATEWAY_SECRET (secured_variable): API secret for signing requests
 *
 * These variables are configured per-agent when deploying the package.
 * Access them in tools via:
 *   context.variables.get("PAYMENT_GATEWAY_URL")
 *   context.securedVariables.get("PAYMENT_GATEWAY_API_KEY")
 */
export const billingAgentConfig: BuzziAgentConfig = {
  agentId: "7a9b1c3d",
  type: AgentTypes.Worker,
  supervisor: "5a7b9c1d",
  // Static tools (no context needed)
  tools: [billingInfoTool, paymentHistoryTool],
  // Context-aware tools (factory functions that receive AgentContext)
  contextAwareTools: [createPaymentGatewayTool],
  specialization: "billing",
};

export const billingAgent = createBuzziAgent(billingAgentConfig);
