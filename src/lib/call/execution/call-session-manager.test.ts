/**
 * Call Session Manager Unit Tests
 *
 * Tests for session lifecycle, status management, and cleanup.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { createCallSessionManager, CallSessionManager } from "./call-session-manager";

// ============================================================================
// Test Setup
// ============================================================================

describe("CallSessionManager", () => {
  let manager: CallSessionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = createCallSessionManager();
  });

  afterEach(async () => {
    await manager.shutdown();
    vi.useRealTimers();
  });

  // ============================================================================
  // Session Creation Tests
  // ============================================================================

  describe("createSession", () => {
    it("should create a new session with correct initial values", async () => {
      const session = await manager.createSession({
        sessionId: "test-session-1",
        callId: "call-123",
        chatbotId: "chatbot-456",
        companyId: "company-789",
        source: "web",
      });

      expect(session).toMatchObject({
        sessionId: "test-session-1",
        callId: "call-123",
        chatbotId: "chatbot-456",
        companyId: "company-789",
        source: "web",
        status: "pending",
      });
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it("should create sessions with optional endUserId", async () => {
      const session = await manager.createSession({
        sessionId: "test-session-2",
        callId: "call-234",
        chatbotId: "chatbot-567",
        companyId: "company-890",
        endUserId: "user-111",
        source: "whatsapp",
      });

      expect(session.endUserId).toBe("user-111");
    });

    it("should increment session count", async () => {
      expect(manager.getActiveSessionsCount()).toBe(0);

      await manager.createSession({
        sessionId: "session-1",
        callId: "call-1",
        chatbotId: "chatbot-1",
        companyId: "company-1",
        source: "web",
      });

      expect(manager.getActiveSessionsCount()).toBe(1);

      await manager.createSession({
        sessionId: "session-2",
        callId: "call-2",
        chatbotId: "chatbot-2",
        companyId: "company-2",
        source: "twilio",
      });

      expect(manager.getActiveSessionsCount()).toBe(2);
    });
  });

  // ============================================================================
  // Session Retrieval Tests
  // ============================================================================

  describe("getSession", () => {
    it("should retrieve an existing session", async () => {
      await manager.createSession({
        sessionId: "retrieve-test",
        callId: "call-retrieve",
        chatbotId: "chatbot-retrieve",
        companyId: "company-retrieve",
        source: "web",
      });

      const session = await manager.getSession("retrieve-test");

      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe("retrieve-test");
    });

    it("should return null for non-existent session", async () => {
      const session = await manager.getSession("non-existent");
      expect(session).toBeNull();
    });
  });

  describe("getActiveSessionIds", () => {
    it("should return empty array when no sessions", () => {
      expect(manager.getActiveSessionIds()).toEqual([]);
    });

    it("should return all session IDs", async () => {
      await manager.createSession({
        sessionId: "id-1",
        callId: "call-1",
        chatbotId: "chatbot-1",
        companyId: "company-1",
        source: "web",
      });

      await manager.createSession({
        sessionId: "id-2",
        callId: "call-2",
        chatbotId: "chatbot-2",
        companyId: "company-2",
        source: "whatsapp",
      });

      const ids = manager.getActiveSessionIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain("id-1");
      expect(ids).toContain("id-2");
    });
  });

  describe("getCompanySessions", () => {
    it("should filter sessions by company", async () => {
      await manager.createSession({
        sessionId: "company-a-1",
        callId: "call-a1",
        chatbotId: "chatbot-a1",
        companyId: "company-a",
        source: "web",
      });

      await manager.createSession({
        sessionId: "company-b-1",
        callId: "call-b1",
        chatbotId: "chatbot-b1",
        companyId: "company-b",
        source: "web",
      });

      await manager.createSession({
        sessionId: "company-a-2",
        callId: "call-a2",
        chatbotId: "chatbot-a2",
        companyId: "company-a",
        source: "twilio",
      });

      const companyASessions = manager.getCompanySessions("company-a");
      const companyBSessions = manager.getCompanySessions("company-b");
      const companyCsessions = manager.getCompanySessions("company-c");

      expect(companyASessions).toHaveLength(2);
      expect(companyBSessions).toHaveLength(1);
      expect(companyCsessions).toHaveLength(0);
    });
  });

  describe("getChatbotSessions", () => {
    it("should filter sessions by chatbot", async () => {
      await manager.createSession({
        sessionId: "bot-1-session-1",
        callId: "call-1",
        chatbotId: "chatbot-1",
        companyId: "company-1",
        source: "web",
      });

      await manager.createSession({
        sessionId: "bot-2-session-1",
        callId: "call-2",
        chatbotId: "chatbot-2",
        companyId: "company-1",
        source: "web",
      });

      const chatbot1Sessions = manager.getChatbotSessions("chatbot-1");
      const chatbot2Sessions = manager.getChatbotSessions("chatbot-2");

      expect(chatbot1Sessions).toHaveLength(1);
      expect(chatbot2Sessions).toHaveLength(1);
    });
  });

  // ============================================================================
  // Status Update Tests
  // ============================================================================

  describe("updateSessionStatus", () => {
    it("should update session status", async () => {
      await manager.createSession({
        sessionId: "status-test",
        callId: "call-status",
        chatbotId: "chatbot-status",
        companyId: "company-status",
        source: "web",
      });

      await manager.updateSessionStatus("status-test", "connecting");
      let session = await manager.getSession("status-test");
      expect(session?.status).toBe("connecting");

      await manager.updateSessionStatus("status-test", "in_progress");
      session = await manager.getSession("status-test");
      expect(session?.status).toBe("in_progress");

      await manager.updateSessionStatus("status-test", "completed");
      session = await manager.getSession("status-test");
      expect(session?.status).toBe("completed");
    });

    it("should update lastActivity when status changes", async () => {
      await manager.createSession({
        sessionId: "activity-test",
        callId: "call-activity",
        chatbotId: "chatbot-activity",
        companyId: "company-activity",
        source: "web",
      });

      const sessionBefore = await manager.getSession("activity-test");
      const timeBefore = sessionBefore?.lastActivity.getTime();

      // Advance time
      vi.advanceTimersByTime(1000);

      await manager.updateSessionStatus("activity-test", "in_progress");
      const sessionAfter = await manager.getSession("activity-test");
      const timeAfter = sessionAfter?.lastActivity.getTime();

      expect(timeAfter).toBeGreaterThan(timeBefore!);
    });

    it("should handle updating non-existent session gracefully", async () => {
      // Should not throw
      await expect(
        manager.updateSessionStatus("non-existent", "in_progress")
      ).resolves.not.toThrow();
    });
  });

  describe("updateLastActivity", () => {
    it("should update lastActivity timestamp", async () => {
      await manager.createSession({
        sessionId: "last-activity-test",
        callId: "call-la",
        chatbotId: "chatbot-la",
        companyId: "company-la",
        source: "web",
      });

      const sessionBefore = await manager.getSession("last-activity-test");
      const timeBefore = sessionBefore?.lastActivity.getTime();

      vi.advanceTimersByTime(5000);

      await manager.updateLastActivity("last-activity-test");
      const sessionAfter = await manager.getSession("last-activity-test");
      const timeAfter = sessionAfter?.lastActivity.getTime();

      expect(timeAfter! - timeBefore!).toBe(5000);
    });
  });

  // ============================================================================
  // Session End Tests
  // ============================================================================

  describe("endSession", () => {
    it("should remove session from tracking", async () => {
      await manager.createSession({
        sessionId: "end-test",
        callId: "call-end",
        chatbotId: "chatbot-end",
        companyId: "company-end",
        source: "web",
      });

      expect(manager.getActiveSessionsCount()).toBe(1);

      await manager.endSession("end-test");

      expect(manager.getActiveSessionsCount()).toBe(0);
      expect(await manager.getSession("end-test")).toBeNull();
    });

    it("should handle ending non-existent session gracefully", async () => {
      // Should not throw
      await expect(manager.endSession("non-existent")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Silence Timeout Tests
  // ============================================================================

  describe("silence timeout", () => {
    it("should timeout session after 3 minutes of inactivity", async () => {
      await manager.createSession({
        sessionId: "timeout-test",
        callId: "call-timeout",
        chatbotId: "chatbot-timeout",
        companyId: "company-timeout",
        source: "web",
      });

      // Update to in_progress status (timeout only triggers for in_progress)
      await manager.updateSessionStatus("timeout-test", "in_progress");

      // Advance time by 3 minutes
      vi.advanceTimersByTime(3 * 60 * 1000);

      const session = await manager.getSession("timeout-test");
      expect(session?.status).toBe("timeout");
    });

    it("should reset timeout on activity update", async () => {
      await manager.createSession({
        sessionId: "reset-timeout-test",
        callId: "call-reset",
        chatbotId: "chatbot-reset",
        companyId: "company-reset",
        source: "web",
      });

      await manager.updateSessionStatus("reset-timeout-test", "in_progress");

      // Advance 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Update activity (should reset timeout)
      await manager.updateLastActivity("reset-timeout-test");

      // Advance another 2 minutes (total 4 minutes, but timeout was reset)
      vi.advanceTimersByTime(2 * 60 * 1000);

      // Should still be in_progress (not timed out)
      let session = await manager.getSession("reset-timeout-test");
      expect(session?.status).toBe("in_progress");

      // Advance 1 more minute (total 3 minutes since last activity)
      vi.advanceTimersByTime(1 * 60 * 1000);

      // Now should be timed out
      session = await manager.getSession("reset-timeout-test");
      expect(session?.status).toBe("timeout");
    });

    it("should not timeout pending sessions", async () => {
      await manager.createSession({
        sessionId: "pending-timeout-test",
        callId: "call-pending",
        chatbotId: "chatbot-pending",
        companyId: "company-pending",
        source: "web",
      });

      // Keep status as pending (don't change to in_progress)

      // Advance time by 3 minutes
      vi.advanceTimersByTime(3 * 60 * 1000);

      const session = await manager.getSession("pending-timeout-test");
      expect(session?.status).toBe("pending");
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe("stale session cleanup", () => {
    it("should clean up sessions in terminal state after 10 minutes", async () => {
      await manager.createSession({
        sessionId: "cleanup-test",
        callId: "call-cleanup",
        chatbotId: "chatbot-cleanup",
        companyId: "company-cleanup",
        source: "web",
      });

      // Update to completed status
      await manager.updateSessionStatus("cleanup-test", "completed");

      expect(manager.getActiveSessionsCount()).toBe(1);

      // Advance time by 10 minutes (stale threshold)
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Trigger cleanup (happens every minute)
      vi.advanceTimersByTime(60 * 1000);

      expect(manager.getActiveSessionsCount()).toBe(0);
    });

    it("should not clean up sessions that are still actively updating", async () => {
      await manager.createSession({
        sessionId: "active-cleanup-test",
        callId: "call-active",
        chatbotId: "chatbot-active",
        companyId: "company-active",
        source: "web",
      });

      await manager.updateSessionStatus("active-cleanup-test", "in_progress");

      // Advance time but keep activity up (every 2 minutes)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(2 * 60 * 1000);
        await manager.updateLastActivity("active-cleanup-test");
      }

      // Session should still exist because activity is being updated
      const session = await manager.getSession("active-cleanup-test");
      expect(session).not.toBeNull();
      expect(session?.status).toBe("in_progress");
    });
  });

  // ============================================================================
  // Shutdown Tests
  // ============================================================================

  describe("shutdown", () => {
    it("should clear all sessions", async () => {
      await manager.createSession({
        sessionId: "shutdown-1",
        callId: "call-1",
        chatbotId: "chatbot-1",
        companyId: "company-1",
        source: "web",
      });

      await manager.createSession({
        sessionId: "shutdown-2",
        callId: "call-2",
        chatbotId: "chatbot-2",
        companyId: "company-2",
        source: "whatsapp",
      });

      expect(manager.getActiveSessionsCount()).toBe(2);

      await manager.shutdown();

      expect(manager.getActiveSessionsCount()).toBe(0);
    });

    it("should stop timers", async () => {
      await manager.createSession({
        sessionId: "timer-test",
        callId: "call-timer",
        chatbotId: "chatbot-timer",
        companyId: "company-timer",
        source: "web",
      });

      await manager.shutdown();

      // Advance time - should not cause issues
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Session should be cleared
      expect(manager.getActiveSessionsCount()).toBe(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle rapid session creation and deletion", async () => {
      for (let i = 0; i < 100; i++) {
        await manager.createSession({
          sessionId: `rapid-${i}`,
          callId: `call-${i}`,
          chatbotId: `chatbot-${i}`,
          companyId: "company-rapid",
          source: "web",
        });
      }

      expect(manager.getActiveSessionsCount()).toBe(100);

      for (let i = 0; i < 100; i++) {
        await manager.endSession(`rapid-${i}`);
      }

      expect(manager.getActiveSessionsCount()).toBe(0);
    });

    it("should handle multiple status updates", async () => {
      await manager.createSession({
        sessionId: "multi-status",
        callId: "call-multi",
        chatbotId: "chatbot-multi",
        companyId: "company-multi",
        source: "web",
      });

      const statuses = [
        "pending",
        "connecting",
        "in_progress",
        "in_progress",
        "completed",
      ] as const;

      for (const status of statuses) {
        await manager.updateSessionStatus("multi-status", status);
      }

      const session = await manager.getSession("multi-status");
      expect(session?.status).toBe("completed");
    });
  });
});
