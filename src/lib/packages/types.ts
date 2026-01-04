/**
 * Package Loader Types
 *
 * Type definitions for the dynamic package loading system.
 */

import type { BuzziAgentPackage } from "@buzzi-ai/agent-sdk";

/**
 * Cache levels for package loading
 */
export type CacheLevel = "memory" | "disk" | "remote";

/**
 * Package metadata from database
 */
export interface PackageMetadata {
  id: string;
  slug: string;
  bundlePath: string;
  bundleChecksum: string | null;
  bundleVersion: string | null;
}

/**
 * Cached package entry with metadata
 */
export interface CachedPackage {
  /** The loaded package instance */
  package: BuzziAgentPackage;
  /** Package ID */
  packageId: string;
  /** Checksum for cache invalidation */
  checksum: string;
  /** Timestamp when cached */
  cachedAt: number;
  /** Cache level this was loaded from */
  loadedFrom: CacheLevel;
}

/**
 * Memory cache entry
 */
export interface MemoryCacheEntry {
  pkg: BuzziAgentPackage;
  checksum: string;
  timestamp: number;
}

/**
 * Disk cache manifest entry
 */
export interface DiskCacheEntry {
  packageId: string;
  checksum: string;
  bundlePath: string;
  cachedAt: number;
  size: number;
}

/**
 * Disk cache manifest
 */
export interface DiskCacheManifest {
  version: number;
  entries: Record<string, DiskCacheEntry>;
  totalSize: number;
  lastCleanup: number;
}

/**
 * Package loader configuration
 */
export interface PackageLoaderConfig {
  /** Memory cache TTL in milliseconds (default: 30 minutes) */
  memoryCacheTTL: number;
  /** Disk cache TTL in milliseconds (default: 7 days) */
  diskCacheTTL: number;
  /** Disk cache base directory */
  diskCacheDir: string;
  /** Maximum disk cache size in bytes (default: 500MB) */
  maxDiskCacheSize: number;
  /** Enable disk caching (default: true) */
  enableDiskCache: boolean;
}

/**
 * Get the disk cache directory
 * Uses node_modules/.cache so that external dependencies can be resolved
 * when dynamically importing cached packages
 */
function getDiskCacheDir(): string {
  // Prefer node_modules/.cache for dependency resolution
  // Falls back to project root if cwd() is available
  try {
    return `${process.cwd()}/node_modules/.cache/buzzi-packages`;
  } catch {
    // Fallback for edge cases
    return process.env.HOME
      ? `${process.env.HOME}/.cache/buzzi-packages`
      : "/tmp/buzzi-packages";
  }
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: PackageLoaderConfig = {
  memoryCacheTTL: 30 * 60 * 1000, // 30 minutes
  diskCacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  diskCacheDir: getDiskCacheDir(),
  maxDiskCacheSize: 500 * 1024 * 1024, // 500MB
  enableDiskCache: true,
};

/**
 * Package loader statistics
 */
export interface PackageLoaderStats {
  memoryCacheHits: number;
  memoryCacheMisses: number;
  diskCacheHits: number;
  diskCacheMisses: number;
  remoteLoads: number;
  errors: number;
  averageLoadTime: number;
}
