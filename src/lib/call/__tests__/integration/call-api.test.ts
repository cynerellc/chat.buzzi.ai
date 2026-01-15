/**
 * Call Feature Integration Tests
 *
 * Tests for call-related components working together.
 * Note: API route tests are handled in E2E tests.
 */

import { describe, expect, it } from "vitest";

// ============================================================================
// Call Session Manager Integration Tests
// ============================================================================

describe("CallSessionManager Integration", () => {
  it("should handle complete session lifecycle", async () => {
    const { createCallSessionManager } = await import(
      "@/lib/call/execution/call-session-manager"
    );

    const manager = createCallSessionManager();

    // Create session
    const session = await manager.createSession({
      sessionId: "integration-test-session",
      callId: "integration-test-call",
      chatbotId: "chatbot-123",
      companyId: "company-123",
      source: "web",
    });

    expect(session.status).toBe("pending");

    // Update to connecting
    await manager.updateSessionStatus("integration-test-session", "connecting");
    let updated = await manager.getSession("integration-test-session");
    expect(updated?.status).toBe("connecting");

    // Update to in_progress
    await manager.updateSessionStatus("integration-test-session", "in_progress");
    updated = await manager.getSession("integration-test-session");
    expect(updated?.status).toBe("in_progress");

    // Simulate activity updates
    for (let i = 0; i < 5; i++) {
      await manager.updateLastActivity("integration-test-session");
    }

    // Complete session
    await manager.updateSessionStatus("integration-test-session", "completed");
    updated = await manager.getSession("integration-test-session");
    expect(updated?.status).toBe("completed");

    // End session
    await manager.endSession("integration-test-session");
    const ended = await manager.getSession("integration-test-session");
    expect(ended).toBeNull();

    // Cleanup
    await manager.shutdown();
  });

  it("should track multiple concurrent sessions", async () => {
    const { createCallSessionManager } = await import(
      "@/lib/call/execution/call-session-manager"
    );

    const manager = createCallSessionManager();

    // Create multiple sessions
    const sessionIds = ["session-a", "session-b", "session-c"];
    for (const id of sessionIds) {
      await manager.createSession({
        sessionId: id,
        callId: `call-${id}`,
        chatbotId: "chatbot-123",
        companyId: "company-123",
        source: "web",
      });
    }

    expect(manager.getActiveSessionsCount()).toBe(3);
    expect(manager.getActiveSessionIds()).toHaveLength(3);

    // Update different sessions to different statuses
    await manager.updateSessionStatus("session-a", "in_progress");
    await manager.updateSessionStatus("session-b", "connecting");
    await manager.updateSessionStatus("session-c", "completed");

    // Verify each session has correct status
    const sessionA = await manager.getSession("session-a");
    const sessionB = await manager.getSession("session-b");
    const sessionC = await manager.getSession("session-c");

    expect(sessionA?.status).toBe("in_progress");
    expect(sessionB?.status).toBe("connecting");
    expect(sessionC?.status).toBe("completed");

    // Cleanup
    await manager.shutdown();
  });

  it("should filter sessions by company and chatbot", async () => {
    const { createCallSessionManager } = await import(
      "@/lib/call/execution/call-session-manager"
    );

    const manager = createCallSessionManager();

    // Create sessions for different companies and chatbots
    await manager.createSession({
      sessionId: "company-a-bot-1",
      callId: "call-1",
      chatbotId: "chatbot-1",
      companyId: "company-a",
      source: "web",
    });

    await manager.createSession({
      sessionId: "company-a-bot-2",
      callId: "call-2",
      chatbotId: "chatbot-2",
      companyId: "company-a",
      source: "whatsapp",
    });

    await manager.createSession({
      sessionId: "company-b-bot-1",
      callId: "call-3",
      chatbotId: "chatbot-1",
      companyId: "company-b",
      source: "web",
    });

    // Test company filter
    const companyASessions = manager.getCompanySessions("company-a");
    expect(companyASessions).toHaveLength(2);

    const companyBSessions = manager.getCompanySessions("company-b");
    expect(companyBSessions).toHaveLength(1);

    // Test chatbot filter
    const chatbot1Sessions = manager.getChatbotSessions("chatbot-1");
    expect(chatbot1Sessions).toHaveLength(2);

    const chatbot2Sessions = manager.getChatbotSessions("chatbot-2");
    expect(chatbot2Sessions).toHaveLength(1);

    // Cleanup
    await manager.shutdown();
  });
});

// ============================================================================
// Audio Converter Integration Tests
// ============================================================================

describe("Audio Converter Integration", () => {
  it("should handle full audio processing pipeline", async () => {
    const {
      mulawToPCM16,
      pcm16ToMulaw,
      resamplePCM16,
      monoToStereo,
      stereoToMono,
      calculateRMS,
    } = await import("@/lib/call/utils/audio-converter");

    // Simulate audio from telephony system (8kHz mulaw)
    const telephonyAudio = Buffer.alloc(800); // 100ms at 8kHz
    for (let i = 0; i < 800; i++) {
      // Generate a simple pattern
      telephonyAudio[i] = Math.floor(Math.sin(i / 10) * 50 + 128);
    }

    // Step 1: Decode mulaw to PCM16
    const pcm16 = mulawToPCM16(telephonyAudio);
    expect(pcm16.length).toBe(1600); // 2x size

    // Step 2: Upsample to 24kHz (for OpenAI)
    const upsampled = resamplePCM16(pcm16, 8000, 24000);
    expect(upsampled.length).toBeGreaterThan(pcm16.length);

    // Step 3: Verify audio quality preserved
    const originalRMS = calculateRMS(pcm16);
    const upsampledRMS = calculateRMS(upsampled);
    // RMS should be similar after resampling
    expect(Math.abs(originalRMS - upsampledRMS)).toBeLessThan(0.1);

    // Step 4: Convert to stereo (for WebRTC output)
    const stereo = monoToStereo(upsampled);
    expect(stereo.length).toBe(upsampled.length * 2);

    // Step 5: Convert back to mono
    const backToMono = stereoToMono(stereo);
    expect(backToMono.length).toBe(upsampled.length);

    // Step 6: Downsample back to 8kHz
    const downsampled = resamplePCM16(backToMono, 24000, 8000);

    // Step 7: Encode back to mulaw
    const backToMulaw = pcm16ToMulaw(downsampled);
    expect(backToMulaw.length).toBeGreaterThan(0);
  });

  it("should handle various sample rate conversions", async () => {
    const { resamplePCM16 } = await import("@/lib/call/utils/audio-converter");

    // Generate 100ms of 16kHz audio
    const samples = 1600; // 100ms at 16kHz
    const input = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
      const sample = Math.round(Math.sin(i * 0.1) * 10000);
      input.writeInt16LE(sample, i * 2);
    }

    // Test various conversions
    const conversions = [
      { from: 16000, to: 8000, expectedRatio: 0.5 },
      { from: 16000, to: 24000, expectedRatio: 1.5 },
      { from: 16000, to: 48000, expectedRatio: 3 },
      { from: 16000, to: 16000, expectedRatio: 1 }, // No conversion
    ];

    for (const { from, to, expectedRatio } of conversions) {
      const output = resamplePCM16(input, from, to);
      const actualRatio = output.length / input.length;
      // Allow some tolerance for rounding
      expect(actualRatio).toBeCloseTo(expectedRatio, 1);
    }
  });
});
