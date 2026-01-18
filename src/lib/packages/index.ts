/**
 * Package Loading Module
 *
 * Provides dynamic loading of chatbot packages from Supabase storage
 * with multi-level caching (memory + disk).
 *
 * Usage:
 *   import { loadPackage, invalidatePackage } from "@/lib/packages";
 *
 *   // Load a package by slug (uses cache if available)
 *   const pkg = await loadPackage("sales-assistant");
 *
 *   // Invalidate cache when package is updated
 *   await invalidatePackage("sales-assistant");
 */

// Main loader functions
export {
  loadPackage,
  invalidatePackage,
  clearPackageCache,
  preloadPackages,
  getCachedPackageSlugs,
  getMemoryCacheSize,
  getLoaderStats,
  resetLoaderStats,
} from "./loader";

// Cache utilities
export { PackageCache, getPackageCache } from "./cache";

// Types
export type {
  CacheLevel,
  PackageMetadata,
  CachedPackage,
  PackageLoaderConfig,
  PackageLoaderStats,
} from "./types";

export { DEFAULT_CONFIG } from "./types";
