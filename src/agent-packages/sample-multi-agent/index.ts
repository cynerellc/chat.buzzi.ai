/**
 * Agent Package: a8b3c4d5-6e7f-8901-2345-67890abcdef1
 *
 * This is a multi-agent package demonstrating a supervisor pattern
 * with specialized worker agents for different domains:
 * - Sales Agent: Handles product inquiries, pricing, and orders
 * - Technical Agent: Handles technical issues and troubleshooting
 * - Billing Agent: Handles billing inquiries and account management
 *
 * The Supervisor Agent routes customer requests to the appropriate
 * specialist based on the nature of the inquiry.
 *
 * Package Structure:
 * - index.ts (this file) - Entry point
 * - agents/ - Agent definitions (supervisor + workers)
 * - tools/ - Custom tool implementations
 */

import { createAgentPackage } from "@buzzi/base-agent";
import { supervisorAgent } from "./agents/supervisor-agent";
import { salesAgent } from "./agents/sales-agent";
import { technicalAgent } from "./agents/technical-agent";
import { billingAgent } from "./agents/billing-agent";

// Package ID: a8b3c4d5-6e7f-8901-2345-67890abcdef1
// Supervisor Agent ID: 5a7b9c1d
// Sales Agent ID: 2e4f6a8b
// Technical Agent ID: 9c1d3e5f
// Billing Agent ID: 7a9b1c3d
export default createAgentPackage(
  "a8b3c4d5-6e7f-8901-2345-67890abcdef1",
  supervisorAgent,
  [salesAgent, technicalAgent, billingAgent]
);
