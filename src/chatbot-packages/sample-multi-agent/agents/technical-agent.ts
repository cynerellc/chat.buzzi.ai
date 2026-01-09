import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { ticketCreateTool, knowledgeBaseTool } from "../tools";

/**
 * Technical Agent Configuration
 *
 * Specialized worker agent for handling technical support:
 * - Troubleshooting product issues
 * - Technical documentation lookup
 * - Bug reporting and ticket creation
 * - Integration and API questions
 *
 * Agent ID: 9c1d3e5f
 */
export const technicalAgentConfig: BuzziAgentConfig = {
  agentId: "9c1d3e5f",
  type: AgentTypes.Worker,
  supervisor: "5a7b9c1d",
  tools: [knowledgeBaseTool, ticketCreateTool],
};

export const technicalAgent = createBuzziAgent(technicalAgentConfig);
