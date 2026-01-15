/**
 * Call Session Manager
 *
 * Manages active call sessions in memory, including:
 * - Session creation and tracking
 * - Status updates
 * - Activity monitoring
 * - Silence timeout handling
 * - Session cleanup
 *
 * Note: Also supports database fallback lookup for cross-module session access
 * when in-memory session isn't found (e.g., Next.js API routes vs custom server)
 */

import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema/calls";
import { sql } from "drizzle-orm";

import type { CallSession, CallStatus } from "../types";

const SILENCE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class CallSessionManager {
  private sessions: Map<string, CallSession> = new Map();
  private timeoutHandlers: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupMonitoring();
  }

  /**
   * Create a new call session
   */
  async createSession(params: {
    sessionId: string;
    callId: string;
    chatbotId: string;
    companyId: string;
    endUserId?: string;
    source: "web" | "whatsapp" | "twilio" | "vonage";
  }): Promise<CallSession> {
    const session: CallSession = {
      sessionId: params.sessionId,
      callId: params.callId,
      chatbotId: params.chatbotId,
      companyId: params.companyId,
      endUserId: params.endUserId,
      source: params.source,
      status: "pending",
      startedAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(params.sessionId, session);

    // Start silence monitoring
    this.startSilenceMonitoring(params.sessionId);

    return session;
  }

  /**
   * Get a session by ID
   * Falls back to database lookup if not found in memory (cross-module access)
   */
  async getSession(sessionId: string): Promise<CallSession | null> {
    // First check in-memory cache
    const session = this.sessions.get(sessionId);
    if (session) {
      return session;
    }

    // Fallback: Look up from database using sessionId stored in external_refs
    try {
      const callResult = await db
        .select({
          id: calls.id,
          chatbotId: calls.chatbotId,
          companyId: calls.companyId,
          endUserId: calls.endUserId,
          source: calls.source,
          status: calls.status,
          aiProvider: calls.aiProvider,
          startedAt: calls.startedAt,
          externalRefs: calls.externalRefs,
        })
        .from(calls)
        .where(sql`${calls.externalRefs}->>'sessionId' = ${sessionId}`)
        .limit(1);

      if (callResult.length > 0 && callResult[0]) {
        const call = callResult[0];
        // Reconstruct session from database
        const dbSession: CallSession = {
          sessionId,
          callId: call.id,
          chatbotId: call.chatbotId,
          companyId: call.companyId,
          endUserId: call.endUserId ?? undefined,
          source: call.source as "web" | "whatsapp" | "twilio" | "vonage",
          status: call.status as CallStatus,
          aiProvider: call.aiProvider,
          startedAt: call.startedAt || new Date(),
          lastActivity: new Date(),
        };

        // Cache it for future lookups
        this.sessions.set(sessionId, dbSession);
        this.startSilenceMonitoring(sessionId);

        console.log(`[CallSessionManager] Recovered session ${sessionId} from database`);
        return dbSession;
      }
    } catch (error) {
      console.error(`[CallSessionManager] Error looking up session from DB:`, error);
    }

    return null;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: CallStatus
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastActivity = new Date();
    }
  }

  /**
   * Update last activity timestamp (called on audio send/receive)
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();

      // Reset silence timeout
      this.resetSilenceTimeout(sessionId);
    }
  }

  /**
   * End a session (remove from tracking)
   */
  async endSession(sessionId: string): Promise<void> {
    // Clear timeout
    const timeout = this.timeoutHandlers.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutHandlers.delete(sessionId);
    }

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Get sessions for a specific company
   */
  getCompanySessions(companyId: string): CallSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.companyId === companyId
    );
  }

  /**
   * Get sessions for a specific chatbot
   */
  getChatbotSessions(chatbotId: string): CallSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.chatbotId === chatbotId
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Start monitoring for silence timeout (3 minutes of inactivity)
   */
  private startSilenceMonitoring(sessionId: string): void {
    const timeout = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.status === "in_progress") {
        // Call timed out due to inactivity
        this.handleSilenceTimeout(sessionId);
      }
    }, SILENCE_TIMEOUT_MS);

    this.timeoutHandlers.set(sessionId, timeout);
  }

  /**
   * Reset silence timeout (called when activity detected)
   */
  private resetSilenceTimeout(sessionId: string): void {
    // Clear existing timeout
    const existingTimeout = this.timeoutHandlers.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Start new timeout
    this.startSilenceMonitoring(sessionId);
  }

  /**
   * Handle silence timeout
   */
  private async handleSilenceTimeout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.warn(`Call session ${sessionId} timed out due to inactivity`);

    // Update status
    session.status = "timeout";

    // Note: The CallRunnerService should handle the actual call termination
    // This just updates the session state
  }

  /**
   * Start periodic cleanup of stale sessions
   */
  private startCleanupMonitoring(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up sessions that are in terminal states for too long
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      const isTerminalState = ["completed", "failed", "timeout", "cancelled"].includes(
        session.status
      );

      if (isTerminalState) {
        const timeSinceLastActivity = now - session.lastActivity.getTime();
        if (timeSinceLastActivity > STALE_THRESHOLD_MS) {
          console.log(`Cleaning up stale session: ${sessionId}`);
          this.endSession(sessionId);
        }
      }
    }
  }

  /**
   * Shutdown the session manager (clear all intervals)
   */
  async shutdown(): Promise<void> {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all timeout handlers
    for (const timeout of this.timeoutHandlers.values()) {
      clearTimeout(timeout);
    }
    this.timeoutHandlers.clear();

    // Clear all sessions
    this.sessions.clear();
  }
}

// Singleton instance
let sessionManagerInstance: CallSessionManager | null = null;

/**
 * Get the singleton CallSessionManager instance
 */
export function getCallSessionManager(): CallSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new CallSessionManager();
  }
  return sessionManagerInstance;
}

/**
 * Create a new CallSessionManager instance (for testing)
 */
export function createCallSessionManager(): CallSessionManager {
  return new CallSessionManager();
}
