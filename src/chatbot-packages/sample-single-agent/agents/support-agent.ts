import {
  createBuzziAgent,
  AgentTypes,
  type BuzziAgentConfig,
} from "@buzzi-ai/agent-sdk";
import { webSearchTool, knowledgeLookupTool, createSendEmailTool } from "../tools";

/**
 * Support Agent Configuration
 *
 * This is a single worker agent designed to handle customer support queries.
 * It uses the knowledge base to find relevant information and can search
 * the web for current information when needed.
 *
 * Agent ID: 3ce439a6
 *
 * Required Package Variables:
 * - EMAIL_HOST (variable): SMTP server hostname (e.g., "smtp.gmail.com")
 * - EMAIL_PORT (variable): SMTP server port (e.g., "587")
 * - EMAIL_USERNAME (secured_variable): SMTP username
 * - EMAIL_PASSWORD (secured_variable): SMTP password
 * - EMAIL_FROM (variable): Default from address (e.g., "support@example.com")
 *
 * These variables are configured per-agent when deploying the package.
 * Access them in tools via:
 *   context.variables.get("EMAIL_HOST")
 *   context.securedVariables.get("EMAIL_PASSWORD")
 */
export const supportAgentConfig: BuzziAgentConfig = {
  agentId: "3ce439a6",
  type: AgentTypes.Worker,
  // Static tools (no context needed)
  tools: [knowledgeLookupTool, webSearchTool],
  // Context-aware tools (factory functions that receive AgentContext)
  contextAwareTools: [createSendEmailTool],
};

export const supportAgent = createBuzziAgent(supportAgentConfig);
