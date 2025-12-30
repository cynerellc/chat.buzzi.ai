/**
 * Accounts Specialist Agent (Worker)
 *
 * A worker agent specialized in generating quotations and handling pricing
 * inquiries. Uses knowledge base for accurate pricing information.
 *
 * Agent ID: accounts
 * Type: Worker
 *
 * Tools:
 * - generate_quotation: Generate formal quotations based on requirements
 *
 * Knowledge Categories:
 * - pricing: Access to pricing information
 * - products: Access to product details
 *
 * Responsibilities:
 * - Generate accurate quotations
 * - Provide pricing information
 * - Handle discount inquiries
 * - Create formal proposals
 */

import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { generateQuotationTool } from "../tools";

/**
 * Agent Configuration
 */
export const accountsConfig: BuzziAgentConfig = {
  agentId: "accounts",
  type: AgentTypes.Worker,
  supervisor: "orchestrator",
  tools: [generateQuotationTool],
  specialization: "accounts-quotations",
};

/**
 * Create the accounts agent
 */
export const accountsAgent = createBuzziAgent(accountsConfig);
