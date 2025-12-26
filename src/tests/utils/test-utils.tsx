/**
 * Test Utilities
 *
 * Custom render function with providers and common test helpers.
 */

import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";

import { TooltipProvider } from "@/components/ui";

// ============================================================================
// Providers
// ============================================================================

interface AllProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

// ============================================================================
// Custom Render
// ============================================================================

function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// ============================================================================
// User Event Setup
// ============================================================================

function setup(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return {
    user: userEvent.setup(),
    ...customRender(ui, options),
  };
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Wait for a specified amount of time
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the next tick
 */
function tick(): Promise<void> {
  return wait(0);
}

// ============================================================================
// Mock Data Generators
// ============================================================================

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    image: null,
    role: "chatapp.user",
    ...overrides,
  };
}

export function createMockCompany(overrides?: Partial<MockCompany>): MockCompany {
  return {
    id: "company-123",
    name: "Test Company",
    slug: "test-company",
    planId: "plan-123",
    status: "active",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockAgent(overrides?: Partial<MockAgent>): MockAgent {
  return {
    id: "agent-123",
    companyId: "company-123",
    name: "Test Agent",
    status: "active",
    packageId: "package-123",
    systemPrompt: "You are a helpful assistant.",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockConversation(overrides?: Partial<MockConversation>): MockConversation {
  return {
    id: "conversation-123",
    agentId: "agent-123",
    sessionId: "session-123",
    status: "active",
    channel: "widget",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  return {
    id: "message-123",
    conversationId: "conversation-123",
    role: "user",
    content: "Hello, world!",
    createdAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface MockUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "chatapp.master_admin" | "chatapp.user";
}

export interface MockCompanyPermission {
  userId: string;
  companyId: string;
  role: "chatapp.company_admin" | "chatapp.support_agent";
}

export interface MockCompany {
  id: string;
  name: string;
  slug: string;
  planId: string;
  status: "active" | "suspended" | "trial";
  createdAt: Date;
}

export interface MockAgent {
  id: string;
  companyId: string;
  name: string;
  status: "active" | "inactive" | "draft";
  packageId: string;
  systemPrompt: string;
  createdAt: Date;
}

export interface MockConversation {
  id: string;
  agentId: string;
  sessionId: string;
  status: "active" | "closed" | "escalated";
  channel: "widget" | "whatsapp" | "telegram" | "slack" | "messenger" | "instagram";
  createdAt: Date;
}

export interface MockMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

// ============================================================================
// Exports
// ============================================================================

// Re-export everything from testing-library
export * from "@testing-library/react";

// Export custom utilities
export { customRender as render, setup, wait, tick };
