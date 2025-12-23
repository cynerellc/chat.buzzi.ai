/**
 * Webhook Security Module
 *
 * Handles security features for webhook endpoints:
 * - IP allowlisting/blocklisting
 * - Rate limiting
 * - Signature verification
 * - Request validation
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { createHmac } from "crypto";

// Types
export interface IPAllowlistEntry {
  id: string;
  companyId: string;
  ipAddress: string;
  cidr?: number;
  description?: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookSecurityConfig {
  companyId: string;
  ipAllowlistEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitPerMinute: number;
  signatureRequired: boolean;
  signatureSecret?: string;
  allowedMethods: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: "IP_NOT_ALLOWED" | "RATE_LIMIT_EXCEEDED" | "INVALID_SIGNATURE" | "INVALID_METHOD";
}

// IP parsing and matching utilities
function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;

  return nums;
}

function parseIPv6(ip: string): number[] | null {
  // Expand :: notation
  let expanded = ip;
  if (ip.includes("::")) {
    const parts = ip.split("::");
    if (parts.length > 2) return null;

    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];
    const missing = 8 - left.length - right.length;

    if (missing < 0) return null;

    const middle = Array(missing).fill("0");
    expanded = [...left, ...middle, ...right].join(":");
  }

  const parts = expanded.split(":");
  if (parts.length !== 8) return null;

  const nums = parts.map((p) => parseInt(p || "0", 16));
  if (nums.some((n) => isNaN(n) || n < 0 || n > 0xffff)) return null;

  return nums;
}

function ipMatchesCIDR(ip: string, allowedIP: string, cidr?: number): boolean {
  // Check if both are IPv4 or both are IPv6
  const isIPv4 = !ip.includes(":");
  const isAllowedIPv4 = !allowedIP.includes(":");

  if (isIPv4 !== isAllowedIPv4) return false;

  if (isIPv4) {
    const ipParts = parseIPv4(ip);
    const allowedParts = parseIPv4(allowedIP);

    if (!ipParts || !allowedParts) return false;

    // No CIDR means exact match
    if (cidr === undefined || cidr === 32) {
      return ipParts.every((part, i) => part === allowedParts[i]);
    }

    // Convert to 32-bit integer for CIDR comparison
    const ipNum =
      (ipParts[0]! << 24) | (ipParts[1]! << 16) | (ipParts[2]! << 8) | ipParts[3]!;
    const allowedNum =
      (allowedParts[0]! << 24) |
      (allowedParts[1]! << 16) |
      (allowedParts[2]! << 8) |
      allowedParts[3]!;

    // Create mask
    const mask = cidr === 0 ? 0 : ~((1 << (32 - cidr)) - 1);

    return (ipNum & mask) === (allowedNum & mask);
  } else {
    // IPv6
    const ipParts = parseIPv6(ip);
    const allowedParts = parseIPv6(allowedIP);

    if (!ipParts || !allowedParts) return false;

    const effectiveCidr = cidr ?? 128;

    if (effectiveCidr === 128) {
      return ipParts.every((part, i) => part === allowedParts[i]);
    }

    // Compare bit by bit up to CIDR
    let bitsRemaining = effectiveCidr;
    for (let i = 0; i < 8 && bitsRemaining > 0; i++) {
      const bitsInThisSegment = Math.min(16, bitsRemaining);
      const mask =
        bitsInThisSegment === 16 ? 0xffff : ~((1 << (16 - bitsInThisSegment)) - 1) & 0xffff;

      if ((ipParts[i]! & mask) !== (allowedParts[i]! & mask)) {
        return false;
      }

      bitsRemaining -= 16;
    }

    return true;
  }
}

/**
 * Webhook Security Service
 */
export class WebhookSecurityService {
  private rateLimitCache: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Get security configuration for a company
   */
  async getConfig(companyId: string): Promise<WebhookSecurityConfig | null> {
    const result = await db.execute<{
      company_id: string;
      ip_allowlist_enabled: boolean;
      rate_limit_enabled: boolean;
      rate_limit_per_minute: number;
      signature_required: boolean;
      signature_secret: string | null;
      allowed_methods: string[];
    }>(sql`
      SELECT * FROM chatapp_webhook_security_config
      WHERE company_id = ${companyId}
    `);

    if (result.length === 0) return null;

    const row = result[0]!;
    return {
      companyId: row.company_id,
      ipAllowlistEnabled: row.ip_allowlist_enabled,
      rateLimitEnabled: row.rate_limit_enabled,
      rateLimitPerMinute: row.rate_limit_per_minute,
      signatureRequired: row.signature_required,
      signatureSecret: row.signature_secret ?? undefined,
      allowedMethods: row.allowed_methods,
    };
  }

  /**
   * Update security configuration
   */
  async updateConfig(
    companyId: string,
    config: Partial<Omit<WebhookSecurityConfig, "companyId">>
  ): Promise<WebhookSecurityConfig> {
    const now = new Date();

    await db.execute(sql`
      INSERT INTO chatapp_webhook_security_config
      (company_id, ip_allowlist_enabled, rate_limit_enabled, rate_limit_per_minute,
       signature_required, signature_secret, allowed_methods, created_at, updated_at)
      VALUES (
        ${companyId},
        ${config.ipAllowlistEnabled ?? false},
        ${config.rateLimitEnabled ?? true},
        ${config.rateLimitPerMinute ?? 60},
        ${config.signatureRequired ?? false},
        ${config.signatureSecret ?? null},
        ${config.allowedMethods ?? ["POST"]}::text[],
        ${now},
        ${now}
      )
      ON CONFLICT (company_id) DO UPDATE SET
        ip_allowlist_enabled = COALESCE(${config.ipAllowlistEnabled ?? null}, chatapp_webhook_security_config.ip_allowlist_enabled),
        rate_limit_enabled = COALESCE(${config.rateLimitEnabled ?? null}, chatapp_webhook_security_config.rate_limit_enabled),
        rate_limit_per_minute = COALESCE(${config.rateLimitPerMinute ?? null}, chatapp_webhook_security_config.rate_limit_per_minute),
        signature_required = COALESCE(${config.signatureRequired ?? null}, chatapp_webhook_security_config.signature_required),
        signature_secret = COALESCE(${config.signatureSecret ?? null}, chatapp_webhook_security_config.signature_secret),
        allowed_methods = COALESCE(${config.allowedMethods ?? null}::text[], chatapp_webhook_security_config.allowed_methods),
        updated_at = ${now}
    `);

    return (await this.getConfig(companyId))!;
  }

  /**
   * Get IP allowlist for a company
   */
  async getIPAllowlist(companyId: string): Promise<IPAllowlistEntry[]> {
    const result = await db.execute<{
      id: string;
      company_id: string;
      ip_address: string;
      cidr: number | null;
      description: string | null;
      is_enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      SELECT * FROM chatapp_ip_allowlist
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
    `);

    return result.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      ipAddress: row.ip_address,
      cidr: row.cidr ?? undefined,
      description: row.description ?? undefined,
      isEnabled: row.is_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Add an IP to the allowlist
   */
  async addIPToAllowlist(
    companyId: string,
    ipAddress: string,
    options?: { cidr?: number; description?: string }
  ): Promise<IPAllowlistEntry> {
    const now = new Date();

    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO chatapp_ip_allowlist
      (id, company_id, ip_address, cidr, description, is_enabled, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${companyId},
        ${ipAddress},
        ${options?.cidr ?? null},
        ${options?.description ?? null},
        true,
        ${now},
        ${now}
      )
      RETURNING id
    `);

    return {
      id: result[0]!.id,
      companyId,
      ipAddress,
      cidr: options?.cidr,
      description: options?.description,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Remove an IP from the allowlist
   */
  async removeIPFromAllowlist(companyId: string, entryId: string): Promise<boolean> {
    const result = await db.execute<{ id: string }>(sql`
      DELETE FROM chatapp_ip_allowlist
      WHERE id = ${entryId} AND company_id = ${companyId}
      RETURNING id
    `);

    return result.length > 0;
  }

  /**
   * Toggle an IP allowlist entry
   */
  async toggleIPEntry(companyId: string, entryId: string, isEnabled: boolean): Promise<boolean> {
    const result = await db.execute<{ id: string }>(sql`
      UPDATE chatapp_ip_allowlist
      SET is_enabled = ${isEnabled}, updated_at = NOW()
      WHERE id = ${entryId} AND company_id = ${companyId}
      RETURNING id
    `);

    return result.length > 0;
  }

  /**
   * Check if an IP is allowed
   */
  async isIPAllowed(companyId: string, ip: string): Promise<boolean> {
    const config = await this.getConfig(companyId);

    // If no config or allowlist not enabled, allow all
    if (!config?.ipAllowlistEnabled) return true;

    const allowlist = await this.getIPAllowlist(companyId);
    const enabledEntries = allowlist.filter((e) => e.isEnabled);

    // If allowlist is enabled but empty, deny all
    if (enabledEntries.length === 0) return false;

    // Check each entry
    return enabledEntries.some((entry) => ipMatchesCIDR(ip, entry.ipAddress, entry.cidr));
  }

  /**
   * Check rate limit
   */
  checkRateLimit(companyId: string, config: WebhookSecurityConfig): ValidationResult {
    if (!config.rateLimitEnabled) {
      return { isValid: true };
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const key = `webhook:${companyId}`;

    const entry = this.rateLimitCache.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      this.rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
      return { isValid: true };
    }

    if (entry.count >= config.rateLimitPerMinute) {
      return {
        isValid: false,
        error: `Rate limit exceeded. Max ${config.rateLimitPerMinute} requests per minute.`,
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    entry.count++;
    return { isValid: true };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: "sha1" | "sha256" = "sha256"
  ): boolean {
    const expectedSignature = createHmac(algorithm, secret).update(payload).digest("hex");

    // Constant-time comparison
    if (signature.length !== expectedSignature.length) return false;

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate a webhook request
   */
  async validateRequest(
    companyId: string,
    request: {
      ip: string;
      method: string;
      payload?: string;
      signature?: string;
    }
  ): Promise<ValidationResult> {
    const config = await this.getConfig(companyId);

    // Default config if none exists
    if (!config) {
      return { isValid: true };
    }

    // Check method
    if (!config.allowedMethods.includes(request.method.toUpperCase())) {
      return {
        isValid: false,
        error: `Method ${request.method} not allowed. Allowed: ${config.allowedMethods.join(", ")}`,
        errorCode: "INVALID_METHOD",
      };
    }

    // Check IP allowlist
    if (config.ipAllowlistEnabled) {
      const ipAllowed = await this.isIPAllowed(companyId, request.ip);
      if (!ipAllowed) {
        return {
          isValid: false,
          error: `IP ${request.ip} is not in the allowlist`,
          errorCode: "IP_NOT_ALLOWED",
        };
      }
    }

    // Check rate limit
    const rateLimitResult = this.checkRateLimit(companyId, config);
    if (!rateLimitResult.isValid) {
      return rateLimitResult;
    }

    // Check signature
    if (config.signatureRequired && config.signatureSecret) {
      if (!request.signature || !request.payload) {
        return {
          isValid: false,
          error: "Signature required but not provided",
          errorCode: "INVALID_SIGNATURE",
        };
      }

      const isValidSignature = this.verifySignature(
        request.payload,
        request.signature,
        config.signatureSecret
      );

      if (!isValidSignature) {
        return {
          isValid: false,
          error: "Invalid signature",
          errorCode: "INVALID_SIGNATURE",
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Generate a new signature secret
   */
  generateSignatureSecret(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Log a webhook request for auditing
   */
  async logRequest(
    companyId: string,
    request: {
      ip: string;
      method: string;
      path: string;
      isAllowed: boolean;
      errorCode?: string;
    }
  ): Promise<void> {
    await db.execute(sql`
      INSERT INTO chatapp_webhook_request_logs
      (id, company_id, ip_address, method, path, is_allowed, error_code, created_at)
      VALUES (
        gen_random_uuid(),
        ${companyId},
        ${request.ip},
        ${request.method},
        ${request.path},
        ${request.isAllowed},
        ${request.errorCode ?? null},
        NOW()
      )
    `);
  }
}

// Singleton instance
let serviceInstance: WebhookSecurityService | null = null;

export function getWebhookSecurityService(): WebhookSecurityService {
  if (!serviceInstance) {
    serviceInstance = new WebhookSecurityService();
  }
  return serviceInstance;
}

// Convenience functions
export async function validateWebhookRequest(
  companyId: string,
  request: {
    ip: string;
    method: string;
    payload?: string;
    signature?: string;
  }
): Promise<ValidationResult> {
  return getWebhookSecurityService().validateRequest(companyId, request);
}

export async function isIPAllowed(companyId: string, ip: string): Promise<boolean> {
  return getWebhookSecurityService().isIPAllowed(companyId, ip);
}
