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
import salesAssistantPackage from "./sales-assistant";
import customerSupportPackage from "./customer-support";
 

/**
 * Registry of all available packages
 * Key: Package slug (e.g., "sales-assistant")
 * Value: The package object
 */
const PACKAGE_REGISTRY: Map<string, BuzziAgentPackage> = new Map([
  // Sales Assistant - Multi-agent with orchestrator
  ["sales-assistant", salesAssistantPackage],

  // Customer Support - Single-agent
  ["customer-support", customerSupportPackage],

]);

/**
 * Get a package by its slug
 * @param packageSlug - The package slug (e.g., "sales-assistant")
 * @returns The package or null if not found
 */
export function getPackage(packageSlug: string): BuzziAgentPackage | null {
  return PACKAGE_REGISTRY.get(packageSlug) ?? null;
}

/**
 * Check if a package exists in the registry
 * @param packageSlug - The package slug
 * @returns true if the package exists
 */
export function hasPackage(packageSlug: string): boolean {
  return PACKAGE_REGISTRY.has(packageSlug);
}

/**
 * Get all registered package slugs
 * @returns Array of package slugs
 */
export function getPackageSlugs(): string[] {
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
 * Get a package by slug, checking static registry first then dynamic loader
 * This is the recommended way to load packages - it handles both built-in
 * and dynamically uploaded packages seamlessly.
 *
 * @param packageSlug - The package slug (e.g., "sales-assistant")
 * @returns The package or null if not found in either registry or storage
 */
export async function getPackageAsync(packageSlug: string): Promise<BuzziAgentPackage | null> {
  // 1. Check static registry first (instant, no network)
  const staticPkg = PACKAGE_REGISTRY.get(packageSlug);
  if (staticPkg) {
    return staticPkg;
  }

  // 2. Fall back to dynamic loader (checks cache, then storage)
  return loadPackage(packageSlug);
}
