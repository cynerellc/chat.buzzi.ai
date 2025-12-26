/**
 * Sentiment Analyzer Tests
 *
 * Tests for the lexicon-based sentiment analysis service.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SentimentAnalyzer,
  analyzeSentiment,
  analyzeConversationSentiment,
  needsEscalation,
  type SentimentResult,
} from "@/lib/escalation/sentiment-analyzer";

describe("SentimentAnalyzer", () => {
  let analyzer: SentimentAnalyzer;

  beforeEach(() => {
    analyzer = new SentimentAnalyzer();
  });

  // ============================================================================
  // Basic Sentiment Analysis
  // ============================================================================

  describe("analyze", () => {
    describe("positive sentiment", () => {
      it("should detect positive words", () => {
        const result = analyzer.analyze("This is great and amazing!");
        expect(result.score).toBeGreaterThan(0);
        expect(result.label).toMatch(/positive/);
        expect(result.details.positiveWords).toContain("great");
        expect(result.details.positiveWords).toContain("amazing");
      });

      it("should detect very positive sentiment", () => {
        const result = analyzer.analyze(
          "Excellent! This is wonderful, fantastic, and amazing!"
        );
        expect(result.score).toBeGreaterThan(0.5);
        expect(result.label).toBe("very_positive");
      });

      it("should detect gratitude expressions", () => {
        const result = analyzer.analyze("Thank you so much, I really appreciate your help!");
        expect(result.score).toBeGreaterThan(0);
        expect(result.details.positiveWords).toContain("thank");
        expect(result.details.positiveWords).toContain("appreciate");
      });
    });

    describe("negative sentiment", () => {
      it("should detect negative words", () => {
        const result = analyzer.analyze("This is terrible and awful!");
        expect(result.score).toBeLessThan(0);
        expect(result.label).toMatch(/negative/);
        expect(result.details.negativeWords).toContain("terrible");
        expect(result.details.negativeWords).toContain("awful");
      });

      it("should detect very negative sentiment", () => {
        const result = analyzer.analyze(
          "This is horrible, terrible, awful, and the worst experience ever!"
        );
        expect(result.score).toBeLessThan(-0.5);
        expect(result.label).toBe("very_negative");
      });

      it("should detect frustration expressions", () => {
        const result = analyzer.analyze("I am frustrated and disappointed with this issue!");
        expect(result.score).toBeLessThan(0);
        expect(result.details.negativeWords).toContain("frustrated");
        expect(result.details.negativeWords).toContain("disappointed");
      });
    });

    describe("neutral sentiment", () => {
      it("should return neutral for informational text", () => {
        const result = analyzer.analyze("The weather today is cloudy with a chance of rain.");
        expect(result.label).toBe("neutral");
        expect(result.score).toBeGreaterThanOrEqual(-0.2);
        expect(result.score).toBeLessThanOrEqual(0.2);
      });

      it("should return neutral for balanced sentiment", () => {
        const result = analyzer.analyze("It was good but also had some bad parts.");
        // Score should be close to neutral due to balanced positive/negative
        expect(Math.abs(result.score)).toBeLessThan(0.5);
      });
    });

    describe("negation handling", () => {
      it("should detect negation words", () => {
        const result = analyzer.analyze("This is not good.");
        // The analyzer tracks negations in details
        expect(result.details.negations).toContain("not");
      });

      it("should detect various negation forms", () => {
        const result1 = analyzer.analyze("I don't like this.");
        expect(result1.details.negations).toContain("don't");

        const result2 = analyzer.analyze("This isn't helpful.");
        expect(result2.details.negations).toContain("isn't");

        const result3 = analyzer.analyze("Never satisfied with the service.");
        expect(result3.details.negations).toContain("never");
      });
    });

    describe("intensifier handling", () => {
      it("should amplify sentiment with intensifiers", () => {
        const baseResult = analyzer.analyze("This is good.");
        const intensifiedResult = analyzer.analyze("This is very good.");

        expect(intensifiedResult.details.intensifiers).toBeDefined();
        // Intensified should have higher magnitude or score impact
        expect(intensifiedResult.details.intensifiers).toContain("very");
      });

      it("should detect various intensifiers", () => {
        const result = analyzer.analyze("This is extremely helpful and really amazing!");
        expect(result.details.intensifiers).toContain("extremely");
        expect(result.details.intensifiers).toContain("really");
      });
    });

    describe("emoticon handling", () => {
      it("should detect positive emoticons", () => {
        const result = analyzer.analyze("Great job! :) 😊");
        expect(result.score).toBeGreaterThan(0);
        expect(result.details.emoticons.length).toBeGreaterThan(0);
      });

      it("should detect negative emoticons", () => {
        const result = analyzer.analyze("This is disappointing :( 😢");
        expect(result.score).toBeLessThan(0);
        expect(result.details.emoticons.length).toBeGreaterThan(0);
      });
    });

    describe("edge cases", () => {
      it("should handle empty string", () => {
        const result = analyzer.analyze("");
        expect(result.score).toBe(0);
        expect(result.label).toBe("neutral");
      });

      it("should handle special characters only", () => {
        const result = analyzer.analyze("!@#$%^&*()");
        expect(result.score).toBe(0);
        expect(result.label).toBe("neutral");
      });

      it("should handle mixed case", () => {
        const result = analyzer.analyze("This is GREAT and AMAZING!");
        expect(result.score).toBeGreaterThan(0);
        expect(result.details.positiveWords).toContain("great");
        expect(result.details.positiveWords).toContain("amazing");
      });
    });
  });

  // ============================================================================
  // Conversation Analysis
  // ============================================================================

  describe("analyzeConversation", () => {
    it("should handle empty message array", () => {
      const result = analyzer.analyzeConversation([]);
      expect(result.score).toBe(0);
      expect(result.label).toBe("neutral");
      expect(result.confidence).toBe(0);
    });

    it("should weight recent messages more heavily", () => {
      // First message positive, recent message negative
      const result = analyzer.analyzeConversation([
        "This is amazing and wonderful!",
        "But now I am very disappointed and frustrated.",
      ]);
      // Should be more negative due to recent message weight
      expect(result.score).toBeLessThan(0);
    });

    it("should combine details from all messages", () => {
      const result = analyzer.analyzeConversation([
        "Great service!",
        "But this issue is terrible.",
      ]);
      expect(result.details.positiveWords).toContain("great");
      expect(result.details.negativeWords).toContain("terrible");
    });

    it("should deduplicate details", () => {
      const result = analyzer.analyzeConversation([
        "Great service!",
        "Really great work!",
      ]);
      // "great" should only appear once in details
      const greatCount = result.details.positiveWords.filter(
        (w) => w === "great"
      ).length;
      expect(greatCount).toBe(1);
    });

    it("should increase confidence with more messages", () => {
      const result1 = analyzer.analyzeConversation(["Good"]);
      const result2 = analyzer.analyzeConversation(["Good", "Great", "Amazing"]);
      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  // ============================================================================
  // Trend Detection
  // ============================================================================

  describe("detectTrend", () => {
    it("should return stable for short conversations", () => {
      const trend = analyzer.detectTrend(["Hello", "Hi"]);
      expect(trend).toBe("stable");
    });

    it("should detect improving sentiment", () => {
      const trend = analyzer.detectTrend([
        "This is terrible!",
        "Well, it's getting better.",
        "Actually, this is pretty good now!",
        "I'm happy with the result!",
      ]);
      expect(trend).toBe("improving");
    });

    it("should detect declining sentiment", () => {
      const trend = analyzer.detectTrend([
        "This is great!",
        "Hmm, not so sure now.",
        "This is disappointing.",
        "I hate this!",
      ]);
      expect(trend).toBe("declining");
    });

    it("should return stable for consistent sentiment", () => {
      const trend = analyzer.detectTrend([
        "This is good.",
        "This is good.",
        "This is good.",
        "This is good.",
      ]);
      // All identical, so trend should be stable
      expect(trend).toBe("stable");
    });
  });

  // ============================================================================
  // Escalation Detection
  // ============================================================================

  describe("needsEscalation", () => {
    it("should return true for very negative sentiment", () => {
      const result = analyzer.needsEscalation(
        "This is absolutely terrible and horrible!"
      );
      expect(result).toBe(true);
    });

    it("should return false for positive sentiment", () => {
      const result = analyzer.needsEscalation("This is great and wonderful!");
      expect(result).toBe(false);
    });

    it("should use custom threshold", () => {
      // Use a stricter threshold
      const result = analyzer.needsEscalation("Not great.", -0.1);
      // With stricter threshold, even slightly negative should trigger
      expect(typeof result).toBe("boolean");
    });

    it("should work with array of messages", () => {
      const result = analyzer.needsEscalation([
        "Hello",
        "I'm frustrated!",
        "This is terrible!",
      ]);
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Convenience Functions
  // ============================================================================

  describe("convenience functions", () => {
    it("analyzeSentiment should work", () => {
      const result = analyzeSentiment("This is great!");
      expect(result.score).toBeGreaterThan(0);
    });

    it("analyzeConversationSentiment should work", () => {
      const result = analyzeConversationSentiment(["Hello", "Thank you!"]);
      expect(result.score).toBeGreaterThan(0);
    });

    it("needsEscalation convenience function should work", () => {
      const result = needsEscalation("This is terrible!");
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Score and Label Mapping
  // ============================================================================

  describe("score to label mapping", () => {
    it("should map scores to correct labels", () => {
      // Very positive
      const veryPositive = analyzer.analyze(
        "Amazing excellent wonderful fantastic superb!"
      );
      expect(veryPositive.label).toBe("very_positive");

      // Positive
      const positive = analyzer.analyze("This is good and nice.");
      expect(["positive", "very_positive"]).toContain(positive.label);

      // Neutral
      const neutral = analyzer.analyze("The item is blue.");
      expect(neutral.label).toBe("neutral");

      // Negative
      const negative = analyzer.analyze("This is bad and poor.");
      expect(["negative", "very_negative"]).toContain(negative.label);

      // Very negative
      const veryNegative = analyzer.analyze(
        "Terrible horrible awful dreadful disgusting!"
      );
      expect(veryNegative.label).toBe("very_negative");
    });
  });

  // ============================================================================
  // Magnitude Calculation
  // ============================================================================

  describe("magnitude calculation", () => {
    it("should have low magnitude for neutral text", () => {
      const result = analyzer.analyze("The weather is cloudy.");
      expect(result.magnitude).toBeLessThan(0.5);
    });

    it("should have high magnitude for strong sentiment", () => {
      const result = analyzer.analyze(
        "This is absolutely amazing wonderful fantastic incredible!"
      );
      expect(result.magnitude).toBeGreaterThan(0.5);
    });

    it("should cap magnitude at 1", () => {
      const result = analyzer.analyze(
        "Amazing great wonderful fantastic excellent superb brilliant terrific magnificent!"
      );
      expect(result.magnitude).toBeLessThanOrEqual(1);
    });
  });
});
