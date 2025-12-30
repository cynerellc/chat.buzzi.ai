/**
 * Sales Representative Agent (Worker)
 *
 * A worker agent specialized in handling product inquiries, understanding
 * customer needs, and qualifying leads. Works under the Sales Orchestrator.
 *
 * Agent ID: salesman
 * Type: Worker
 *
 * Tools:
 * - save_lead_info: Capture and store lead information for follow-up
 *
 * Responsibilities:
 * - Answer product and service questions
 * - Understand customer requirements
 * - Qualify leads (budget, timeline, needs)
 * - Collect contact information
 * - Highlight relevant features and benefits
 */

import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { saveLeadInfoTool } from "../tools";

/**
 * Agent Configuration
 */
export const salesmanConfig: BuzziAgentConfig = {
  agentId: "salesman",
  type: AgentTypes.Worker,
  supervisor: "orchestrator",
  tools: [saveLeadInfoTool],
  specialization: "sales-representative",
};

/**
 * Create the salesman agent
 */
export const salesmanAgent = createBuzziAgent(salesmanConfig);
