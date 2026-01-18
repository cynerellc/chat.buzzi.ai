/**
 * Chatbot Package: Customer Support Agent
 * Package ID: 9f62b375-d70d-48a2-a9cd-8b6a8abe8e77
 *
 * A single-agent customer support package for handling general inquiries.
 * Provides helpful, empathetic support with knowledge base integration.
 *
 * Package Structure:
 * - index.ts (this file) - Entry point
 * - agents/ - Agent definitions
 *   - support-agent.ts - Main support worker agent
 * - tools/ - Custom tool implementations
 *   - knowledge-lookup.ts - Knowledge base search tool
 *   - save-lead-info.ts - Lead/contact capture tool
 *
 * Agents:
 * 1. Support Agent (worker) - Handles customer inquiries and issues
 *
 * Package Variables:
 * - COMPANY_NAME (variable, required): Company name for greetings and responses
 * - SUPPORT_EMAIL (variable, optional): Email for escalated support requests
 */

import { createAgentPackage } from "@buzzi-ai/agent-sdk";
import { supportAgent } from "./agents/support-agent";

// Package ID: 9f62b375-d70d-48a2-a9cd-8b6a8abe8e77
// Single-agent package
export default createAgentPackage(
  "9f62b375-d70d-48a2-a9cd-8b6a8abe8e77",
  supportAgent
);
