import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { productCatalogTool, orderLookupTool } from "../tools";

/**
 * Sales Agent Configuration
 *
 * Specialized worker agent for handling sales-related inquiries:
 * - Product information and comparisons
 * - Pricing questions
 * - Order status and tracking
 * - Upselling and cross-selling recommendations
 *
 * Agent ID: 2e4f6a8b
 */
export const salesAgentConfig: BuzziAgentConfig = {
  agentId: "2e4f6a8b",
  type: AgentTypes.Worker,
  supervisor: "5a7b9c1d",
  tools: [productCatalogTool, orderLookupTool],
};

export const salesAgent = createBuzziAgent(salesAgentConfig);
