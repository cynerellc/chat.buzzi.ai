/**
 * Package Loading Module
 *
 * Provides dynamic loading of chatbot packages from Supabase storage
 * with multi-level caching (memory + disk).
 *
 * Usage:
 *   import { loadPackage, invalidatePackage } from "@/lib/packages";
 *
 *   // Load a package (uses cache if available)
 *   const pkg = await loadPackage("package-uuid");
 *
 *   // Invalidate cache when package is updated
 *   await invalidatePackage("package-uuid");
 */

// Main loader functions
export {
  loadPackage,
  invalidatePackage,
  clearPackageCache,
  preloadPackages,
  getCachedPackageIds,
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
