/**
 * Chatbot Package: Sales Assistant
 * Package ID: 1c33f609-ae08-4340-9dbb-e82cebed608a
 *
 * A multi-agent sales assistant package with orchestration capabilities.
 * Routes inquiries to specialized agents for sales and quotation handling.
 *
 * Package Structure:
 * - index.ts (this file) - Entry point
 * - agents/ - Agent definitions
 *   - orchestrator.ts - Supervisor agent for routing
 *   - salesman.ts - Sales representative worker
 *   - accounts.ts - Accounts/quotation specialist worker
 * - tools/ - Custom tool implementations
 *   - save-lead-info.ts - Lead capture tool
 *   - generate-quotation.ts - Quotation generation tool (AUTH REQUIRED)
 * - auth-guard.ts - Authentication guard for phone/OTP login
 *
 * Agents:
 * 1. Sales Orchestrator (supervisor) - Routes inquiries to appropriate specialist
 * 2. Sales Representative (worker) - Handles product inquiries and lead qualification (AUTH REQUIRED)
 * 3. Accounts Specialist (worker) - Generates quotations and handles pricing
 *
 * Authentication:
 * - Salesman agent requires authentication (entire agent)
 * - generate_quotation tool requires authentication (used by accounts agent)
 * - Customer name and email auto-loaded from authenticated session
 * - Uses phone/OTP two-step verification
 * - Demo credentials: Phone +911111111111, OTP 222222
 *
 * Package Variables:
 * - COMPANY_NAME (variable, required): Company name for personalized interactions
 * - SALES_EMAIL (variable, optional): Email for qualified leads to contact
 * - CRM_API_KEY (secured_variable, optional): API key for CRM integration to save leads
 * - CALENDAR_LINK (variable, optional): Link for scheduling demos or meetings
 */

import { createAgentPackage } from "@buzzi-ai/agent-sdk";
import { orchestratorAgent } from "./agents/orchestrator";
import { salesmanAgent } from "./agents/salesman";
import { accountsAgent } from "./agents/accounts";
import { authGuard } from "./auth-guard";

// Package ID: 1c33f609-ae08-4340-9dbb-e82cebed608a
// Multi-agent package with supervisor orchestration and authentication
export default createAgentPackage(
  "1c33f609-ae08-4340-9dbb-e82cebed608a",
  orchestratorAgent, // Supervisor agent (entry point)
  [salesmanAgent, accountsAgent], // Worker agents
  {
    authGuard, // Auth guard for phone/OTP authentication
    // Agents that require authentication
    requireAuthForAgents: ["salesman"],
    // Tools that require authentication (generate_quotation checks auth in its execute function)
    requireAuthForTools: ["generate_quotation"],
  }
);
