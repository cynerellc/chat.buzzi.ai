/**
 * Session Manager
 *
 * Handles device session tracking, validation, and management.
 */

import { eq, and, gt, lt, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { db } from "@/lib/db";
import { deviceSessions, type NewDeviceSession } from "@/lib/db/schema";

// ============================================================================
// Types
// ============================================================================

export interface DeviceInfo {
  deviceName?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  isTrusted: boolean;
  lastActivity: Date;
  createdAt: Date;
  isCurrent: boolean;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a new device session
 */
export async function createDeviceSession(
  userId: string,
  deviceInfo: DeviceInfo,
  expiresInDays = 30
): Promise<string> {
  const sessionToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const newSession: NewDeviceSession = {
    userId,
    sessionToken,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    ipAddress: deviceInfo.ipAddress,
    location: deviceInfo.location,
    isTrusted: false,
    expiresAt,
  };

  await db.insert(deviceSessions).values(newSession);

  return sessionToken;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  userId: string,
  currentSessionToken?: string
): Promise<SessionInfo[]> {
  const sessions = await db.query.deviceSessions.findMany({
    where: and(
      eq(deviceSessions.userId, userId),
      // Only get non-expired sessions
      gt(deviceSessions.expiresAt, new Date())
    ),
    orderBy: (deviceSessions, { desc }) => [desc(deviceSessions.lastActivity)],
  });

  return sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    deviceType: session.deviceType,
    browser: session.browser,
    os: session.os,
    ipAddress: session.ipAddress,
    location: session.location,
    isTrusted: session.isTrusted,
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
    isCurrent: session.sessionToken === currentSessionToken,
  }));
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  await db
    .update(deviceSessions)
    .set({ lastActivity: new Date() })
    .where(eq(deviceSessions.sessionToken, sessionToken));
}

/**
 * Trust a device session (remember device)
 */
export async function trustDeviceSession(sessionId: string, userId: string): Promise<void> {
  await db
    .update(deviceSessions)
    .set({ isTrusted: true })
    .where(and(eq(deviceSessions.id, sessionId), eq(deviceSessions.userId, userId)));
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(deviceSessions)
    .where(and(eq(deviceSessions.id, sessionId), eq(deviceSessions.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Revoke all sessions except the current one
 */
export async function revokeAllOtherSessions(
  userId: string,
  currentSessionToken: string
): Promise<number> {
  const result = await db
    .delete(deviceSessions)
    .where(
      and(
        eq(deviceSessions.userId, userId),
        // Keep the current session, delete all others
        ne(deviceSessions.sessionToken, currentSessionToken)
      )
    )
    .returning();

  return result.length;
}

/**
 * Revoke all sessions for a user (force logout everywhere)
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await db
    .delete(deviceSessions)
    .where(eq(deviceSessions.userId, userId))
    .returning();

  return result.length;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(deviceSessions)
    .where(lt(deviceSessions.expiresAt, new Date()))
    .returning();

  return result.length;
}

/**
 * Validate a session token
 */
export async function validateSessionToken(sessionToken: string): Promise<{
  valid: boolean;
  userId?: string;
  isTrusted?: boolean;
}> {
  const session = await db.query.deviceSessions.findFirst({
    where: eq(deviceSessions.sessionToken, sessionToken),
  });

  if (!session) {
    return { valid: false };
  }

  // Check if expired
  if (new Date() > session.expiresAt) {
    await db.delete(deviceSessions).where(eq(deviceSessions.id, session.id));
    return { valid: false };
  }

  return {
    valid: true,
    userId: session.userId,
    isTrusted: session.isTrusted,
  };
}

// ============================================================================
// User Agent Parsing Helpers
// ============================================================================

/**
 * Parse user agent to extract device info
 */
export function parseUserAgent(userAgent: string): Partial<DeviceInfo> {
  const result: Partial<DeviceInfo> = {};

  // Detect device type
  if (/mobile/i.test(userAgent)) {
    result.deviceType = "mobile";
  } else if (/tablet|ipad/i.test(userAgent)) {
    result.deviceType = "tablet";
  } else {
    result.deviceType = "desktop";
  }

  // Detect browser
  if (/firefox/i.test(userAgent)) {
    result.browser = "Firefox";
  } else if (/edg/i.test(userAgent)) {
    result.browser = "Edge";
  } else if (/chrome/i.test(userAgent)) {
    result.browser = "Chrome";
  } else if (/safari/i.test(userAgent)) {
    result.browser = "Safari";
  } else if (/opera|opr/i.test(userAgent)) {
    result.browser = "Opera";
  } else {
    result.browser = "Unknown";
  }

  // Detect OS
  if (/windows/i.test(userAgent)) {
    result.os = "Windows";
  } else if (/macintosh|mac os/i.test(userAgent)) {
    result.os = "macOS";
  } else if (/linux/i.test(userAgent)) {
    result.os = "Linux";
  } else if (/android/i.test(userAgent)) {
    result.os = "Android";
  } else if (/iphone|ipad|ipod/i.test(userAgent)) {
    result.os = "iOS";
  } else {
    result.os = "Unknown";
  }

  // Generate device name
  result.deviceName = `${result.browser} on ${result.os}`;

  return result;
}
