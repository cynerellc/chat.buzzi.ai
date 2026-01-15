/**
 * Sales Orchestrator Agent (Supervisor)
 *
 * A supervisor agent that routes sales inquiries to the appropriate specialist.
 * Analyzes customer questions and delegates to either the Sales Representative
 * or Accounts Specialist based on the nature of the inquiry.
 *
 * Agent ID: orchestrator
 * Type: Supervisor
 *
 * Managed Agents:
 * - salesman: Sales Representative for product inquiries and lead qualification
 * - accounts: Accounts Specialist for pricing and quotation requests
 */

import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";

/**
 * Agent Configuration
 */
export const orchestratorConfig: BuzziAgentConfig = {
  agentId: "orchestrator",
  type: AgentTypes.Supervisor,
  workers: ["salesman", "accounts"],
  routingStrategy: "intent-based",
  fallbackBehavior: "handle-directly",
};

/**
 * Create the orchestrator agent
 */
export const orchestratorAgent = createBuzziAgent(orchestratorConfig);
