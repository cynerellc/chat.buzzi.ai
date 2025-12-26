import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi/base-agent";

/**
 * Supervisor Agent Configuration
 *
 * This is the main coordinator agent that receives all incoming
 * customer requests and routes them to the appropriate specialist:
 * - Sales inquiries → Sales Agent
 * - Technical issues → Technical Agent
 * - Billing questions → Billing Agent
 *
 * The supervisor can also handle general inquiries directly or
 * escalate complex issues to human support.
 *
 * Agent ID: 5a7b9c1d
 */
export const supervisorAgentConfig: BuzziAgentConfig = {
  agentId: "5a7b9c1d",
  type: AgentTypes.Supervisor,
  workers: ["2e4f6a8b", "9c1d3e5f", "7a9b1c3d"], // Sales, Technical, Billing
  routingStrategy: "intent-based",
  fallbackBehavior: "handle-directly",
};

export const supervisorAgent = createBuzziAgent(supervisorAgentConfig);
