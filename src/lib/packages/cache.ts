/**
 * Multi-Level Package Cache
 *
 * Implements a two-level cache for chatbot packages:
 * - L1: In-memory cache (fastest, loses on restart)
 * - L2: Disk cache (survives restarts, configurable TTL)
 *
 * Cache invalidation is based on checksum comparison.
 */

import { promises as fs } from "fs";
import path from "path";
import type { BuzziAgentPackage } from "@buzzi-ai/agent-sdk";
import {
  type MemoryCacheEntry,
  type DiskCacheManifest,
  type DiskCacheEntry,
  type PackageLoaderConfig,
  DEFAULT_CONFIG,
} from "./types";

/**
 * In-memory package cache
 */
class MemoryCache {
  private cache: Map<string, MemoryCacheEntry> = new Map();
  private ttl: number;

  constructor(ttl: number) {
    this.ttl = ttl;
  }

  get(packageId: string): BuzziAgentPackage | null {
    const entry = this.cache.get(packageId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(packageId);
      return null;
    }

    return entry.pkg;
  }

  getWithChecksum(packageId: string): { pkg: BuzziAgentPackage; checksum: string } | null {
    const entry = this.cache.get(packageId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(packageId);
      return null;
    }

    return { pkg: entry.pkg, checksum: entry.checksum };
  }

  set(packageId: string, pkg: BuzziAgentPackage, checksum: string): void {
    this.cache.set(packageId, {
      pkg,
      checksum,
      timestamp: Date.now(),
    });
  }

  delete(packageId: string): boolean {
    return this.cache.delete(packageId);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached package IDs (for debugging/monitoring)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Disk-based package cache
 */
class DiskCache {
  private baseDir: string;
  private ttl: number;
  private maxSize: number;
  private enabled: boolean;
  private manifestPath: string;
  private initialized: boolean = false;

  constructor(config: Pick<PackageLoaderConfig, "diskCacheDir" | "diskCacheTTL" | "maxDiskCacheSize" | "enableDiskCache">) {
    this.baseDir = config.diskCacheDir;
    this.ttl = config.diskCacheTTL;
    this.maxSize = config.maxDiskCacheSize;
    this.enabled = config.enableDiskCache;
    this.manifestPath = path.join(this.baseDir, "manifest.json");
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    if (!this.enabled) return;

    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      console.error(`[DiskCache] Failed to create cache directory: ${error}`);
      this.enabled = false;
    }
  }

  /**
   * Load the manifest file
   */
  private async loadManifest(): Promise<DiskCacheManifest> {
    try {
      const content = await fs.readFile(this.manifestPath, "utf-8");
      return JSON.parse(content) as DiskCacheManifest;
    } catch {
      // Return empty manifest if file doesn't exist
      return {
        version: 1,
        entries: {},
        totalSize: 0,
        lastCleanup: Date.now(),
      };
    }
  }

  /**
   * Save the manifest file
   */
  private async saveManifest(manifest: DiskCacheManifest): Promise<void> {
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Get the file path for a cached package
   */
  private getPackagePath(packageId: string): string {
    return path.join(this.baseDir, `${packageId}.js`);
  }

  /**
   * Check if a package is in the disk cache and not expired
   */
  async has(packageId: string, expectedChecksum?: string): Promise<boolean> {
    if (!this.enabled) return false;
    await this.ensureDir();

    const manifest = await this.loadManifest();
    const entry = manifest.entries[packageId];

    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.cachedAt > this.ttl) {
      return false;
    }

    // Check checksum if provided
    if (expectedChecksum && entry.checksum !== expectedChecksum) {
      return false;
    }

    // Verify file exists
    try {
      await fs.access(entry.bundlePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the path to a cached package bundle (for dynamic import)
   */
  async getPath(packageId: string): Promise<string | null> {
    if (!this.enabled) return null;
    await this.ensureDir();

    const manifest = await this.loadManifest();
    const entry = manifest.entries[packageId];

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.cachedAt > this.ttl) {
      return null;
    }

    // Verify file exists
    try {
      await fs.access(entry.bundlePath);
      return entry.bundlePath;
    } catch {
      return null;
    }
  }

  /**
   * Get cache entry metadata
   */
  async getEntry(packageId: string): Promise<DiskCacheEntry | null> {
    if (!this.enabled) return null;
    await this.ensureDir();

    const manifest = await this.loadManifest();
    return manifest.entries[packageId] || null;
  }

  /**
   * Save a package bundle to disk cache
   */
  async set(packageId: string, bundleCode: string, checksum: string): Promise<string | null> {
    if (!this.enabled) return null;
    await this.ensureDir();

    const bundlePath = this.getPackagePath(packageId);
    const size = Buffer.byteLength(bundleCode, "utf-8");

    try {
      // Write the bundle file
      await fs.writeFile(bundlePath, bundleCode);

      // Update manifest
      const manifest = await this.loadManifest();
      manifest.entries[packageId] = {
        packageId,
        checksum,
        bundlePath,
        cachedAt: Date.now(),
        size,
      };
      manifest.totalSize += size;

      await this.saveManifest(manifest);

      // Cleanup if over size limit
      if (manifest.totalSize > this.maxSize) {
        await this.cleanup();
      }

      return bundlePath;
    } catch (error) {
      console.error(`[DiskCache] Failed to cache package ${packageId}: ${error}`);
      return null;
    }
  }

  /**
   * Delete a package from disk cache
   */
  async delete(packageId: string): Promise<boolean> {
    if (!this.enabled) return false;
    await this.ensureDir();

    const manifest = await this.loadManifest();
    const entry = manifest.entries[packageId];

    if (!entry) return false;

    try {
      await fs.unlink(entry.bundlePath);
      manifest.totalSize -= entry.size;
      delete manifest.entries[packageId];
      await this.saveManifest(manifest);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup expired and excess entries
   */
  async cleanup(): Promise<void> {
    if (!this.enabled) return;
    await this.ensureDir();

    const manifest = await this.loadManifest();
    const now = Date.now();
    const entries = Object.entries(manifest.entries);

    // Sort by age (oldest first)
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    let deletedSize = 0;
    const toDelete: string[] = [];

    for (const [packageId, entry] of entries) {
      // Delete if expired
      if (now - entry.cachedAt > this.ttl) {
        toDelete.push(packageId);
        deletedSize += entry.size;
        continue;
      }

      // Delete if over size limit
      if (manifest.totalSize - deletedSize > this.maxSize) {
        toDelete.push(packageId);
        deletedSize += entry.size;
      }
    }

    // Delete files
    for (const packageId of toDelete) {
      const entry = manifest.entries[packageId];
      if (entry) {
        try {
          await fs.unlink(entry.bundlePath);
        } catch {
          // Ignore errors
        }
        delete manifest.entries[packageId];
      }
    }

    manifest.totalSize -= deletedSize;
    manifest.lastCleanup = now;
    await this.saveManifest(manifest);

    if (toDelete.length > 0) {
      console.log(`[DiskCache] Cleaned up ${toDelete.length} entries, freed ${(deletedSize / 1024).toFixed(1)}KB`);
    }
  }

  /**
   * Clear all cached packages
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;
    await this.ensureDir();

    const manifest = await this.loadManifest();

    for (const entry of Object.values(manifest.entries)) {
      try {
        await fs.unlink(entry.bundlePath);
      } catch {
        // Ignore errors
      }
    }

    await this.saveManifest({
      version: 1,
      entries: {},
      totalSize: 0,
      lastCleanup: Date.now(),
    });
  }
}

/**
 * Combined multi-level cache manager
 */
export class PackageCache {
  private memoryCache: MemoryCache;
  private diskCache: DiskCache;

  constructor(config: Partial<PackageLoaderConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new MemoryCache(fullConfig.memoryCacheTTL);
    this.diskCache = new DiskCache(fullConfig);
  }

  /**
   * Get a package from cache (memory first, then disk)
   * Returns null if not found or expired
   */
  getFromMemory(packageId: string): BuzziAgentPackage | null {
    return this.memoryCache.get(packageId);
  }

  /**
   * Get package with checksum from memory
   */
  getFromMemoryWithChecksum(packageId: string): { pkg: BuzziAgentPackage; checksum: string } | null {
    return this.memoryCache.getWithChecksum(packageId);
  }

  /**
   * Check if package is in disk cache (and valid)
   */
  async isInDiskCache(packageId: string, expectedChecksum?: string): Promise<boolean> {
    return this.diskCache.has(packageId, expectedChecksum);
  }

  /**
   * Get path to disk-cached bundle for dynamic import
   */
  async getDiskCachePath(packageId: string): Promise<string | null> {
    return this.diskCache.getPath(packageId);
  }

  /**
   * Get disk cache entry metadata
   */
  async getDiskCacheEntry(packageId: string): Promise<DiskCacheEntry | null> {
    return this.diskCache.getEntry(packageId);
  }

  /**
   * Save package to memory cache
   */
  setInMemory(packageId: string, pkg: BuzziAgentPackage, checksum: string): void {
    this.memoryCache.set(packageId, pkg, checksum);
  }

  /**
   * Save bundle code to disk cache
   */
  async setInDisk(packageId: string, bundleCode: string, checksum: string): Promise<string | null> {
    return this.diskCache.set(packageId, bundleCode, checksum);
  }

  /**
   * Delete package from all cache levels
   */
  async delete(packageId: string): Promise<void> {
    this.memoryCache.delete(packageId);
    await this.diskCache.delete(packageId);
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.diskCache.clear();
  }

  /**
   * Get memory cache statistics
   */
  getMemoryCacheSize(): number {
    return this.memoryCache.size();
  }

  /**
   * Get all cached package IDs
   */
  getMemoryCacheKeys(): string[] {
    return this.memoryCache.keys();
  }

  /**
   * Run disk cache cleanup
   */
  async cleanupDiskCache(): Promise<void> {
    await this.diskCache.cleanup();
  }
}

// Export singleton instance with default config
let defaultCache: PackageCache | null = null;

export function getPackageCache(): PackageCache {
  if (!defaultCache) {
    defaultCache = new PackageCache();
  }
  return defaultCache;
}
