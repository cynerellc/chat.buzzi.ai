/**
 * Escalation Trigger Detection Tests
 *
 * Tests for the trigger detection service that identifies when conversations
 * should be escalated to human agents.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TriggerDetector,
  detectEscalationTriggers,
  shouldEscalate,
  type ConversationContext,
  type TriggerConfig,
} from "@/lib/escalation/triggers";

describe("TriggerDetector", () => {
  let detector: TriggerDetector;

  beforeEach(() => {
    detector = new TriggerDetector();
  });

  // ============================================================================
  // Sentiment Trigger
  // ============================================================================

  describe("sentiment trigger", () => {
    it("should trigger when sentiment is below threshold", () => {
      const context: ConversationContext = {
        sentiment: -0.6,
        turnCount: 3,
        lastMessages: ["I hate this!"],
      };

      const triggers = detector.analyze(context);
      const sentimentTrigger = triggers.find((t) => t.type === "sentiment");

      expect(sentimentTrigger).toBeDefined();
      expect(sentimentTrigger?.triggered).toBe(true);
      expect(sentimentTrigger?.reason).toContain("Negative sentiment");
    });

    it("should not trigger when sentiment is above threshold", () => {
      const context: ConversationContext = {
        sentiment: 0.5,
        turnCount: 3,
        lastMessages: ["This is great!"],
      };

      const triggers = detector.analyze(context);
      const sentimentTrigger = triggers.find((t) => t.type === "sentiment");

      expect(sentimentTrigger).toBeUndefined();
    });

    it("should not trigger when sentiment is undefined", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["Hello"],
      };

      const triggers = detector.analyze(context);
      const sentimentTrigger = triggers.find((t) => t.type === "sentiment");

      expect(sentimentTrigger).toBeUndefined();
    });

    it("should respect custom sentiment threshold", () => {
      const customDetector = new TriggerDetector({
        sentimentThreshold: -0.3,
      });

      const context: ConversationContext = {
        sentiment: -0.4,
        turnCount: 3,
        lastMessages: ["Not great"],
      };

      const triggers = customDetector.analyze(context);
      const sentimentTrigger = triggers.find((t) => t.type === "sentiment");

      expect(sentimentTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Turn Limit Trigger
  // ============================================================================

  describe("turn limit trigger", () => {
    it("should trigger when turn count exceeds limit", () => {
      const context: ConversationContext = {
        turnCount: 10,
        lastMessages: ["Still not resolved"],
      };

      const triggers = detector.analyze(context);
      const turnsTrigger = triggers.find((t) => t.type === "turns");

      expect(turnsTrigger).toBeDefined();
      expect(turnsTrigger?.triggered).toBe(true);
      expect(turnsTrigger?.reason).toContain("exceeded");
    });

    it("should not trigger when turn count is below limit", () => {
      const context: ConversationContext = {
        turnCount: 5,
        lastMessages: ["Hello"],
      };

      const triggers = detector.analyze(context);
      const turnsTrigger = triggers.find((t) => t.type === "turns");

      expect(turnsTrigger).toBeUndefined();
    });

    it("should respect custom turn limit", () => {
      const customDetector = new TriggerDetector({
        maxTurns: 5,
      });

      const context: ConversationContext = {
        turnCount: 5,
        lastMessages: ["Hello"],
      };

      const triggers = customDetector.analyze(context);
      const turnsTrigger = triggers.find((t) => t.type === "turns");

      expect(turnsTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Explicit Request Trigger
  // ============================================================================

  describe("explicit request trigger", () => {
    it("should trigger for 'talk to a human'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want to talk to a human please"],
      };

      const triggers = detector.analyze(context);
      const explicitTrigger = triggers.find((t) => t.type === "explicit_request");

      expect(explicitTrigger).toBeDefined();
      expect(explicitTrigger?.triggered).toBe(true);
      expect(explicitTrigger?.confidence).toBe(1.0);
    });

    it("should trigger for 'speak to a real person'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["Can I speak to a real person?"],
      };

      const triggers = detector.analyze(context);
      const explicitTrigger = triggers.find((t) => t.type === "explicit_request");

      expect(explicitTrigger?.triggered).toBe(true);
    });

    it("should trigger for 'transfer me'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["Please transfer me to someone who can help"],
      };

      const triggers = detector.analyze(context);
      const explicitTrigger = triggers.find((t) => t.type === "explicit_request");

      expect(explicitTrigger?.triggered).toBe(true);
    });

    it("should trigger for 'live agent'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I need a live agent now"],
      };

      const triggers = detector.analyze(context);
      const explicitTrigger = triggers.find((t) => t.type === "explicit_request");

      expect(explicitTrigger?.triggered).toBe(true);
    });

    it("should not trigger for regular messages", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["What are your business hours?"],
      };

      const triggers = detector.analyze(context);
      const explicitTrigger = triggers.find((t) => t.type === "explicit_request");

      expect(explicitTrigger).toBeUndefined();
    });

    it("should be case insensitive", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I WANT TO TALK TO A HUMAN!"],
      };

      const triggers = detector.analyze(context);
      const explicitTrigger = triggers.find((t) => t.type === "explicit_request");

      expect(explicitTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Keyword Trigger
  // ============================================================================

  describe("keyword trigger", () => {
    it("should trigger for 'refund'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want a refund for this purchase"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");

      expect(keywordTrigger).toBeDefined();
      expect(keywordTrigger?.triggered).toBe(true);
      expect(keywordTrigger?.metadata?.matchedKeywords).toContain("refund");
    });

    it("should trigger for 'cancel'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want to cancel my subscription"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");

      expect(keywordTrigger?.triggered).toBe(true);
      expect(keywordTrigger?.metadata?.matchedKeywords).toContain("cancel");
    });

    it("should trigger for 'lawyer'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I will contact my lawyer about this"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");

      expect(keywordTrigger?.triggered).toBe(true);
    });

    it("should trigger for phrases like 'this is unacceptable'", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["This is unacceptable service!"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");

      expect(keywordTrigger?.triggered).toBe(true);
      expect(keywordTrigger?.metadata?.matchedPhrases).toContain("this is unacceptable");
    });

    it("should detect multiple keywords", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want an urgent refund or I'll contact my lawyer"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");

      expect(keywordTrigger?.triggered).toBe(true);
      expect(keywordTrigger?.metadata?.matchedKeywords).toContain("urgent");
      expect(keywordTrigger?.metadata?.matchedKeywords).toContain("refund");
      expect(keywordTrigger?.metadata?.matchedKeywords).toContain("lawyer");
    });

    it("should respect custom keywords", () => {
      const customDetector = new TriggerDetector({
        keywords: ["custom_keyword"],
      });

      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["This contains custom_keyword"],
      };

      const triggers = customDetector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");

      expect(keywordTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Frustration Trigger
  // ============================================================================

  describe("frustration trigger", () => {
    it("should trigger when multiple frustration indicators present", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I am frustrated and angry with this service!"],
      };

      const triggers = detector.analyze(context);
      const frustrationTrigger = triggers.find((t) => t.type === "frustration");

      expect(frustrationTrigger).toBeDefined();
      expect(frustrationTrigger?.triggered).toBe(true);
      expect(frustrationTrigger?.reason).toContain("frustrated");
    });

    it("should not trigger for single frustration word", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I am frustrated"],
      };

      const triggers = detector.analyze(context);
      const frustrationTrigger = triggers.find((t) => t.type === "frustration");

      // Only one indicator, needs at least 2
      expect(frustrationTrigger).toBeUndefined();
    });

    it("should detect various frustration expressions", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["This is ridiculous and absurd!"],
      };

      const triggers = detector.analyze(context);
      const frustrationTrigger = triggers.find((t) => t.type === "frustration");

      expect(frustrationTrigger?.triggered).toBe(true);
    });

    it("should detect 'fed up' and 'sick of' expressions", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I am fed up and sick of waiting!"],
      };

      const triggers = detector.analyze(context);
      const frustrationTrigger = triggers.find((t) => t.type === "frustration");

      expect(frustrationTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Multiple Triggers
  // ============================================================================

  describe("multiple triggers", () => {
    it("should detect multiple triggers simultaneously", () => {
      const context: ConversationContext = {
        sentiment: -0.7,
        turnCount: 15,
        lastMessages: [
          "I hate this! I want to cancel and get a refund! Talk to a human now!",
        ],
      };

      const triggers = detector.analyze(context);

      expect(triggers.length).toBeGreaterThan(2);

      const types = triggers.map((t) => t.type);
      expect(types).toContain("sentiment");
      expect(types).toContain("turns");
      expect(types).toContain("explicit_request");
      expect(types).toContain("keyword");
    });
  });

  // ============================================================================
  // shouldEscalate
  // ============================================================================

  describe("shouldEscalate", () => {
    it("should return true when any trigger is active", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want to talk to a human"],
      };

      expect(detector.shouldEscalate(context)).toBe(true);
    });

    it("should return false when no triggers are active", () => {
      const context: ConversationContext = {
        sentiment: 0.5,
        turnCount: 3,
        lastMessages: ["Hello, how can you help me?"],
      };

      expect(detector.shouldEscalate(context)).toBe(false);
    });
  });

  // ============================================================================
  // getEscalationReason
  // ============================================================================

  describe("getEscalationReason", () => {
    it("should return null when no triggers", () => {
      const context: ConversationContext = {
        sentiment: 0.5,
        turnCount: 3,
        lastMessages: ["Hello"],
      };

      expect(detector.getEscalationReason(context)).toBeNull();
    });

    it("should prioritize explicit_request over other triggers", () => {
      const context: ConversationContext = {
        sentiment: -0.7,
        turnCount: 3,
        lastMessages: ["I hate this! Talk to a human now!"],
      };

      const reason = detector.getEscalationReason(context);
      expect(reason).toContain("human");
    });

    it("should return sentiment reason when no explicit request", () => {
      const context: ConversationContext = {
        sentiment: -0.7,
        turnCount: 3,
        lastMessages: ["This is terrible!"],
      };

      const reason = detector.getEscalationReason(context);
      expect(reason).toContain("sentiment");
    });
  });

  // ============================================================================
  // Configuration Updates
  // ============================================================================

  describe("updateConfig", () => {
    it("should update configuration", () => {
      detector.updateConfig({ maxTurns: 3 });

      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["Hello"],
      };

      const triggers = detector.analyze(context);
      const turnsTrigger = triggers.find((t) => t.type === "turns");

      expect(turnsTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Convenience Functions
  // ============================================================================

  describe("convenience functions", () => {
    it("detectEscalationTriggers should work", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want a refund"],
      };

      const triggers = detectEscalationTriggers(context);
      expect(triggers.length).toBeGreaterThan(0);
    });

    it("shouldEscalate convenience function should work", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["Talk to a human please"],
      };

      expect(shouldEscalate(context)).toBe(true);
    });

    it("convenience functions should accept config", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["custom_trigger_word"],
      };

      const triggers = detectEscalationTriggers(context, {
        keywords: ["custom_trigger_word"],
      });

      const keywordTrigger = triggers.find((t) => t.type === "keyword");
      expect(keywordTrigger?.triggered).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty messages array", () => {
      const context: ConversationContext = {
        turnCount: 0,
        lastMessages: [],
      };

      const triggers = detector.analyze(context);
      // Should not crash, may return no triggers
      expect(Array.isArray(triggers)).toBe(true);
    });

    it("should handle very long messages", () => {
      const longMessage = "This is a very long message. ".repeat(100);
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: [longMessage + "I want a refund"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");
      expect(keywordTrigger?.triggered).toBe(true);
    });

    it("should handle unicode and special characters", () => {
      const context: ConversationContext = {
        turnCount: 3,
        lastMessages: ["I want a refund! 😡💢"],
      };

      const triggers = detector.analyze(context);
      const keywordTrigger = triggers.find((t) => t.type === "keyword");
      expect(keywordTrigger?.triggered).toBe(true);
    });
  });
});
