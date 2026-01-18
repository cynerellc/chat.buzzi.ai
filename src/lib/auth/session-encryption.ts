/**
 * Session Encryption Service
 *
 * Provides AES-256-GCM encryption/decryption for auth session data.
 * Session data is encrypted before storing in the database.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variable
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.AUTH_SESSION_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "AUTH_SESSION_ENCRYPTION_KEY environment variable is required"
    );
  }

  if (key.length !== 64) {
    throw new Error(
      "AUTH_SESSION_ENCRYPTION_KEY must be 32 bytes (64 hex characters)"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Encrypted session data format
 */
export interface EncryptedData {
  /** Encrypted data (hex encoded) */
  encrypted: string;
  /** Initialization vector (hex encoded) */
  iv: string;
  /** Authentication tag (hex encoded) */
  authTag: string;
}

/**
 * Encrypt session data using AES-256-GCM
 *
 * @param data - Data to encrypt (any JSON-serializable object)
 * @returns Encrypted data with IV and auth tag
 */
export function encryptSessionData(data: unknown): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt session data using AES-256-GCM
 *
 * @param encryptedData - Encrypted data with IV and auth tag
 * @returns Decrypted data
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptSessionData<T>(encryptedData: EncryptedData): T {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, "hex");
  const authTag = Buffer.from(encryptedData.authTag, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted) as T;
}

/**
 * Pack encrypted data into a single string for storage
 * Format: iv:authTag:encrypted
 */
export function packEncryptedData(data: EncryptedData): string {
  return `${data.iv}:${data.authTag}:${data.encrypted}`;
}

/**
 * Unpack encrypted data from storage string
 */
export function unpackEncryptedData(packed: string): EncryptedData {
  const parts = packed.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [iv, authTag, encrypted] = parts;
  if (!iv || !authTag || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }

  return { iv, authTag, encrypted };
}

/**
 * Generate a new encryption key (for setup)
 * Run this once to generate a key for AUTH_SESSION_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
