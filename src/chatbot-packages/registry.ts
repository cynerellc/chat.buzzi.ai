/**
 * Chatbot Package Registry
 *
 * This module provides a registry of built-in/sample chatbot packages.
 * Packages are statically imported for fast access without network latency.
 *
 * For dynamically loaded packages from Supabase storage, use:
 *   import { loadPackage } from "@/lib/packages";
 *   const pkg = await loadPackage(packageId);
 *
 * The AdkExecutor automatically tries static registry first, then falls back
 * to the dynamic loader for packages stored in Supabase.
 *
 * When adding a new BUILT-IN package:
 * 1. Create the package in src/chatbot-packages/{packageId}/
 * 2. Import the package in this file
 * 3. Add the package to the PACKAGE_REGISTRY map
 *
 * When adding a DYNAMIC package (preferred):
 * 1. Upload via admin panel or scripts/upload-packages-to-storage.ts
 * 2. The package will be automatically loaded from Supabase storage
 */

import type { BuzziAgentPackage } from "@buzzi-ai/agent-sdk";
import { loadPackage } from "@/lib/packages";

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

/**
 * Get a package by ID, checking static registry first then dynamic loader
 * This is the recommended way to load packages - it handles both built-in
 * and dynamically uploaded packages seamlessly.
 *
 * @param packageId - The package UUID
 * @returns The package or null if not found in either registry or storage
 */
export async function getPackageAsync(packageId: string): Promise<BuzziAgentPackage | null> {
  // 1. Check static registry first (instant, no network)
  const staticPkg = PACKAGE_REGISTRY.get(packageId);
  if (staticPkg) {
    return staticPkg;
  }

  // 2. Fall back to dynamic loader (checks cache, then storage)
  return loadPackage(packageId);
}
