/**
 * Support Agent (Worker)
 *
 * A worker agent specialized in handling customer support inquiries.
 * Provides helpful, empathetic assistance with knowledge base integration.
 *
 * Agent ID: support-main
 * Type: Worker
 *
 * Tools:
 * - knowledge_lookup: Search the knowledge base for relevant information
 * - save_lead_info: Capture customer contact information for follow-up
 *
 * Responsibilities:
 * - Answer customer questions accurately
 * - Provide information from the knowledge base
 * - Escalate complex issues to human agents
 * - Collect contact information when needed
 * - Maintain a friendly, professional tone
 */

import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { knowledgeLookupTool, saveLeadInfoTool } from "../tools";

/**
 * Agent Configuration
 */
export const supportAgentConfig: BuzziAgentConfig = {
  agentId: "support-main",
  type: AgentTypes.Worker,
  tools: [knowledgeLookupTool, saveLeadInfoTool],
  specialization: "customer-support",
};

/**
 * Create the support agent
 */
export const supportAgent = createBuzziAgent(supportAgentConfig);
