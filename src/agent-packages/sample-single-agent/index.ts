/**
 * Agent Package: c2709628-4cef-4ebd-b55c-0708e298c167
 *
 * This is a single-agent package containing a support agent
 * that can handle customer inquiries using knowledge base
 * lookups and web search capabilities.
 *
 * Package Structure:
 * - index.ts (this file) - Entry point
 * - agents/ - Agent definitions
 * - tools/ - Custom tool implementations
 */

import { createAgentPackage } from "@buzzi/base-agent";
import { supportAgent } from "./agents/support-agent";

// Package ID: c2709628-4cef-4ebd-b55c-0708e298c167
// Agent ID: 3ce439a6
export default createAgentPackage(
  "c2709628-4cef-4ebd-b55c-0708e298c167",
  supportAgent
);
