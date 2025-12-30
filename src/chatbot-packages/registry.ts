/**
 * Chatbot Package Registry
 *
 * This module provides a registry of all available chatbot packages.
 * Packages are statically imported to work with Next.js bundling.
 *
 * When adding a new package:
 * 1. Create the package in src/chatbot-packages/{packageId}/
 * 2. Import the package in this file
 * 3. Add the package to the PACKAGE_REGISTRY map
 */

import type { BuzziAgentPackage } from "@buzzi-ai/agent-sdk";

// Import all packages statically
// This ensures Next.js can bundle them correctly
import salesAssistantPackage from "./1c33f609-ae08-4340-9dbb-e82cebed608a";
import customerSupportPackage from "./9f62b375-d70d-48a2-a9cd-8b6a8abe8e77";
import sampleSingleAgentPackage from "./sample-single-agent";
import sampleMultiAgentPackage from "./sample-multi-agent";

/**
 * Registry of all available packages
 * Key: Package ID (UUID)
 * Value: The package object
 */
const PACKAGE_REGISTRY: Map<string, BuzziAgentPackage> = new Map([
  // Sales Assistant - Multi-agent with orchestrator
  ["1c33f609-ae08-4340-9dbb-e82cebed608a", salesAssistantPackage],

  // Customer Support - Single-agent
  ["9f62b375-d70d-48a2-a9cd-8b6a8abe8e77", customerSupportPackage],

  // Sample packages
  ["c2709628-4cef-4ebd-b55c-0708e298c167", sampleSingleAgentPackage],
  ["a8b3c4d5-6e7f-8901-2345-67890abcdef1", sampleMultiAgentPackage],
]);

/**
 * Get a package by its ID
 * @param packageId - The package UUID
 * @returns The package or null if not found
 */
export function getPackage(packageId: string): BuzziAgentPackage | null {
  return PACKAGE_REGISTRY.get(packageId) ?? null;
}

/**
 * Check if a package exists in the registry
 * @param packageId - The package UUID
 * @returns true if the package exists
 */
export function hasPackage(packageId: string): boolean {
  return PACKAGE_REGISTRY.has(packageId);
}

/**
 * Get all registered package IDs
 * @returns Array of package IDs
 */
export function getPackageIds(): string[] {
  return Array.from(PACKAGE_REGISTRY.keys());
}

/**
 * Get all registered packages
 * @returns Array of packages
 */
export function getAllPackages(): BuzziAgentPackage[] {
  return Array.from(PACKAGE_REGISTRY.values());
}

/**
 * Get package metadata for all registered packages
 * @returns Array of package metadata
 */
export function getPackageMetadata(): Array<{
  packageId: string;
  packageType: string;
  agentCount: number;
}> {
  return getAllPackages().map((pkg) => pkg.getMetadata());
}
