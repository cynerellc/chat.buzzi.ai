/**
 * Dynamic Package Loader
 *
 * Loads chatbot packages dynamically from storage with multi-level caching:
 * 1. Check memory cache (fastest)
 * 2. Check disk cache (survives restarts)
 * 3. Download from Supabase storage (source of truth)
 *
 * Packages are pre-compiled JavaScript bundles that can be loaded via dynamic import().
 */

import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { chatbotPackages } from "@/lib/db/schema/chatbots";
import { eq } from "drizzle-orm";
import type { BuzziAgentPackage } from "@buzzi-ai/agent-sdk";
import { getPackageCache } from "./cache";
import type { CacheLevel, PackageLoaderStats } from "./types";

/**
 * Statistics for monitoring loader performance
 */
const stats: PackageLoaderStats = {
  memoryCacheHits: 0,
  memoryCacheMisses: 0,
  diskCacheHits: 0,
  diskCacheMisses: 0,
  remoteLoads: 0,
  errors: 0,
  averageLoadTime: 0,
};

let totalLoadTime = 0;
let totalLoads = 0;

/**
 * Download a package bundle from a URL
 */
async function downloadBundle(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download bundle: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Load a package from a JavaScript module file
 * Uses dynamic import() for ESM modules
 */
async function loadPackageFromFile(filePath: string): Promise<BuzziAgentPackage> {
  // Use file:// URL for dynamic import on local files
  const fileUrl = `file://${filePath}`;

  // Dynamic import the module
  const loadedModule = await import(/* webpackIgnore: true */ fileUrl);

  // The package should be the default export
  const pkg = loadedModule.default as BuzziAgentPackage;

  if (!pkg || typeof pkg.getMetadata !== "function") {
    throw new Error(`Invalid package: missing getMetadata() method`);
  }

  return pkg;
}

/**
 * Load a package from bundle code (for remote/in-memory loading)
 * Creates a temporary file in the project's node_modules/.cache directory
 * so that external dependencies (@buzzi-ai/agent-sdk, zod) can be resolved
 */
async function loadPackageFromCode(code: string, packageId: string): Promise<BuzziAgentPackage> {
  // Create temp file in node_modules/.cache so dependencies can be resolved
  // This works because Node.js walks up the directory tree to find node_modules
  const tempDir = path.join(process.cwd(), "node_modules", ".cache", "buzzi-packages", "temp");
  await fs.mkdir(tempDir, { recursive: true });

  const tempFile = path.join(tempDir, `${packageId}-${Date.now()}.mjs`);

  try {
    // Write the bundle to temp file
    await fs.writeFile(tempFile, code);

    // Import the module
    const pkg = await loadPackageFromFile(tempFile);

    return pkg;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get package metadata from database by slug
 */
async function getPackageMetadata(packageSlug: string): Promise<{
  bundlePath: string;
  checksum: string | null;
} | null> {
  const results = await db
    .select({
      bundlePath: chatbotPackages.bundlePath,
      bundleChecksum: chatbotPackages.bundleChecksum,
    })
    .from(chatbotPackages)
    .where(eq(chatbotPackages.slug, packageSlug))
    .limit(1);

  const pkg = results[0];
  if (!pkg || !pkg.bundlePath) {
    return null;
  }

  return {
    bundlePath: pkg.bundlePath,
    checksum: pkg.bundleChecksum,
  };
}

/**
 * Load a package by slug with multi-level caching
 *
 * Loading order:
 * 1. Memory cache (instant)
 * 2. Disk cache (fast)
 * 3. Remote storage (slow but source of truth)
 */
export async function loadPackage(packageSlug: string): Promise<BuzziAgentPackage | null> {
  const startTime = performance.now();
  const cache = getPackageCache();
  // Track where package was loaded from for debugging
  let _loadedFrom: CacheLevel = "remote";

  try {
    // Step 1: Check memory cache
    const memoryEntry = cache.getFromMemoryWithChecksum(packageSlug);
    if (memoryEntry) {
      stats.memoryCacheHits++;
      recordLoadTime(startTime);
      return memoryEntry.pkg;
    }
    stats.memoryCacheMisses++;

    // Step 2: Get metadata from database to get checksum
    const metadata = await getPackageMetadata(packageSlug);
    if (!metadata) {
      console.error(`[PackageLoader] Package "${packageSlug}" not found in database`);
      stats.errors++;
      return null;
    }

    // Step 3: Check disk cache (with checksum validation)
    const diskCachePath = await cache.getDiskCachePath(packageSlug);
    if (diskCachePath) {
      // Validate checksum if available
      const diskEntry = await cache.getDiskCacheEntry(packageSlug);
      if (diskEntry && (!metadata.checksum || diskEntry.checksum === metadata.checksum)) {
        try {
          const pkg = await loadPackageFromFile(diskCachePath);

          // Store in memory cache
          cache.setInMemory(packageSlug, pkg, diskEntry.checksum);

          stats.diskCacheHits++;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _loadedFrom = "disk";
          recordLoadTime(startTime);
          console.log(`[PackageLoader] Loaded "${packageSlug}" from disk cache`);
          return pkg;
        } catch (error) {
          console.error(`[PackageLoader] Failed to load from disk cache: ${error}`);
          // Fall through to remote load
        }
      }
    }
    stats.diskCacheMisses++;

    // Step 4: Download from remote storage
    console.log(`[PackageLoader] Downloading package "${packageSlug}" from storage...`);
    const bundleCode = await downloadBundle(metadata.bundlePath);

    // Load the package
    const pkg = await loadPackageFromCode(bundleCode, packageSlug);

    // Store in both caches
    const checksum = metadata.checksum || generateChecksum(bundleCode);
    cache.setInMemory(packageSlug, pkg, checksum);
    await cache.setInDisk(packageSlug, bundleCode, checksum);

    stats.remoteLoads++;
    recordLoadTime(startTime);
    console.log(`[PackageLoader] Loaded "${packageSlug}" from remote storage`);
    return pkg;
  } catch (error) {
    console.error(`[PackageLoader] Failed to load package "${packageSlug}":`, error);
    stats.errors++;
    return null;
  }
}

/**
 * Invalidate a package from all caches
 * Call this when a package is updated
 */
export async function invalidatePackage(packageSlug: string): Promise<void> {
  const cache = getPackageCache();
  await cache.delete(packageSlug);
  console.log(`[PackageLoader] Invalidated cache for package "${packageSlug}"`);
}

/**
 * Clear all cached packages
 */
export async function clearPackageCache(): Promise<void> {
  const cache = getPackageCache();
  await cache.clear();
  console.log(`[PackageLoader] Cleared all package caches`);
}

/**
 * Get loader statistics
 */
export function getLoaderStats(): PackageLoaderStats {
  return { ...stats };
}

/**
 * Reset loader statistics
 */
export function resetLoaderStats(): void {
  stats.memoryCacheHits = 0;
  stats.memoryCacheMisses = 0;
  stats.diskCacheHits = 0;
  stats.diskCacheMisses = 0;
  stats.remoteLoads = 0;
  stats.errors = 0;
  stats.averageLoadTime = 0;
  totalLoadTime = 0;
  totalLoads = 0;
}

/**
 * Record load time for statistics
 */
function recordLoadTime(startTime: number): void {
  const loadTime = performance.now() - startTime;
  totalLoadTime += loadTime;
  totalLoads++;
  stats.averageLoadTime = totalLoadTime / totalLoads;
}

/**
 * Generate a simple checksum for fallback
 */
function generateChecksum(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Preload packages into memory cache
 * Useful for warming up frequently used packages
 */
export async function preloadPackages(packageSlugs: string[]): Promise<void> {
  console.log(`[PackageLoader] Preloading ${packageSlugs.length} packages...`);

  const results = await Promise.allSettled(
    packageSlugs.map((slug) => loadPackage(slug))
  );

  const loaded = results.filter((r) => r.status === "fulfilled" && r.value !== null).length;
  const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && r.value === null)).length;

  console.log(`[PackageLoader] Preloaded ${loaded} packages, ${failed} failed`);
}

/**
 * Get cached package slugs (for debugging/monitoring)
 */
export function getCachedPackageSlugs(): string[] {
  return getPackageCache().getMemoryCacheKeys();
}

/**
 * Get memory cache size
 */
export function getMemoryCacheSize(): number {
  return getPackageCache().getMemoryCacheSize();
}
