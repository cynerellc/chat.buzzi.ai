/**
 * Auth Session Storage Service
 *
 * Stores and retrieves auth sessions from endUsers.metadata.authSessions
 * Sessions are encrypted and stored per-chatbot per-user.
 */

import { db } from "@/lib/db";
import { endUsers } from "@/lib/db/schema/conversations";
import { eq, sql } from "drizzle-orm";
import type { AuthSession } from "@buzzi-ai/agent-sdk";
import {
  encryptSessionData,
  decryptSessionData,
  packEncryptedData,
  unpackEncryptedData,
} from "./session-encryption";

/**
 * Auth state machine states
 */
export type AuthState = "anonymous" | "pending" | "authenticated";

/**
 * Stored session data structure in metadata
 */
export interface StoredAuthSession {
  /** Packed encrypted session data (iv:authTag:encrypted) */
  encrypted?: string;
  /** Auth state */
  authState: AuthState;
  /** User roles (queryable without decryption) */
  roles: string[];
  /** External user ID (queryable without decryption) */
  externalUserId?: string;
  /** Current login step ID (if pending) */
  currentStep?: string;
  /** Encrypted pending form values */
  pendingValuesEncrypted?: string;
  /** Session expiration (Unix ms) */
  expiresAt: number;
  /** When user authenticated (Unix ms) */
  authenticatedAt?: number;
}

/**
 * Auth session metadata structure in endUsers.metadata
 */
export interface AuthSessionsMetadata {
  authSessions?: Record<string, StoredAuthSession>;
}

/**
 * Auth Session Storage
 *
 * Handles CRUD operations for auth sessions stored in endUsers.metadata
 */
export class AuthSessionStorage {
  constructor(private readonly chatbotId: string) {}

  /**
   * Get auth session for an end user
   * Returns null if no session exists or session is expired
   */
  async get(endUserId: string): Promise<AuthSession | null> {
    const endUser = await db.query.endUsers.findFirst({
      where: eq(endUsers.id, endUserId),
      columns: { metadata: true },
    });

    if (!endUser?.metadata) {
      return null;
    }

    const metadata = endUser.metadata as AuthSessionsMetadata;
    const stored = metadata.authSessions?.[this.chatbotId];

    if (!stored || !stored.encrypted) {
      return null;
    }

    // Check expiration
    if (stored.expiresAt < Date.now()) {
      // Session expired - clear it
      await this.clear(endUserId);
      return null;
    }

    // Decrypt and return session
    try {
      const encryptedData = unpackEncryptedData(stored.encrypted);
      return decryptSessionData<AuthSession>(encryptedData);
    } catch {
      // Decryption failed - clear corrupted session
      await this.clear(endUserId);
      return null;
    }
  }

  /**
   * Get the stored session state (without decrypting)
   * Useful for checking auth state without full decryption
   */
  async getState(
    endUserId: string
  ): Promise<{
    authState: AuthState;
    currentStep?: string;
    roles: string[];
    expiresAt: number;
  } | null> {
    const endUser = await db.query.endUsers.findFirst({
      where: eq(endUsers.id, endUserId),
      columns: { metadata: true },
    });

    if (!endUser?.metadata) {
      return null;
    }

    const metadata = endUser.metadata as AuthSessionsMetadata;
    const stored = metadata.authSessions?.[this.chatbotId];

    if (!stored) {
      return null;
    }

    // Check expiration
    if (stored.expiresAt < Date.now()) {
      return null;
    }

    return {
      authState: stored.authState,
      currentStep: stored.currentStep,
      roles: stored.roles,
      expiresAt: stored.expiresAt,
    };
  }

  /**
   * Store an authenticated session
   */
  async set(endUserId: string, session: AuthSession): Promise<void> {
    const encrypted = encryptSessionData(session);
    const packed = packEncryptedData(encrypted);

    const stored: StoredAuthSession = {
      encrypted: packed,
      authState: "authenticated",
      roles: session.roles || [],
      externalUserId: session.userId,
      expiresAt: session.expiresAt,
      authenticatedAt: Date.now(),
    };

    await this.updateMetadata(endUserId, stored);
  }

  /**
   * Set session to pending state (during multi-step login)
   */
  async setPending(
    endUserId: string,
    stepId: string,
    pendingValues?: Record<string, string>
  ): Promise<void> {
    let pendingValuesEncrypted: string | undefined;

    if (pendingValues && Object.keys(pendingValues).length > 0) {
      const encrypted = encryptSessionData(pendingValues);
      pendingValuesEncrypted = packEncryptedData(encrypted);
    }

    const stored: StoredAuthSession = {
      authState: "pending",
      currentStep: stepId,
      pendingValuesEncrypted,
      roles: [],
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour for pending
    };

    await this.updateMetadata(endUserId, stored);
  }

  /**
   * Get pending form values (for multi-step login)
   */
  async getPendingValues(
    endUserId: string
  ): Promise<Record<string, string> | null> {
    const endUser = await db.query.endUsers.findFirst({
      where: eq(endUsers.id, endUserId),
      columns: { metadata: true },
    });

    if (!endUser?.metadata) {
      return null;
    }

    const metadata = endUser.metadata as AuthSessionsMetadata;
    const stored = metadata.authSessions?.[this.chatbotId];

    if (!stored?.pendingValuesEncrypted) {
      return null;
    }

    try {
      const encryptedData = unpackEncryptedData(stored.pendingValuesEncrypted);
      return decryptSessionData<Record<string, string>>(encryptedData);
    } catch {
      return null;
    }
  }

  /**
   * Clear auth session (logout)
   */
  async clear(endUserId: string): Promise<void> {
    // Use JSONB operator to remove the chatbot key from authSessions
    await db
      .update(endUsers)
      .set({
        metadata: sql`
          CASE
            WHEN metadata->'authSessions' IS NOT NULL
            THEN jsonb_set(
              metadata,
              '{authSessions}',
              COALESCE(metadata->'authSessions', '{}') - ${this.chatbotId}
            )
            ELSE metadata
          END
        `,
        updatedAt: new Date(),
      })
      .where(eq(endUsers.id, endUserId));
  }

  /**
   * Update metadata with new session data
   */
  private async updateMetadata(
    endUserId: string,
    data: StoredAuthSession
  ): Promise<void> {
    // Use JSONB set to update the specific chatbot's session
    await db
      .update(endUsers)
      .set({
        metadata: sql`
          jsonb_set(
            jsonb_set(
              COALESCE(metadata, '{}'),
              '{authSessions}',
              COALESCE(metadata->'authSessions', '{}')
            ),
            ${`{authSessions,${this.chatbotId}}`},
            ${JSON.stringify(data)}::jsonb
          )
        `,
        updatedAt: new Date(),
      })
      .where(eq(endUsers.id, endUserId));
  }
}

/**
 * Create an auth session storage instance for a chatbot
 */
export function createAuthSessionStorage(chatbotId: string): AuthSessionStorage {
  return new AuthSessionStorage(chatbotId);
}
