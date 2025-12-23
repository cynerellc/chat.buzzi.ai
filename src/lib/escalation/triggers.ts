/**
 * Escalation Trigger Detection
 *
 * Analyzes conversations to detect conditions that should trigger escalation:
 * - Sentiment drops below threshold
 * - Specific keywords/phrases detected
 * - Conversation exceeds turn limit
 * - Explicit escalation request
 */

// Types
export interface EscalationTrigger {
  type: TriggerType;
  triggered: boolean;
  reason?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export type TriggerType =
  | "sentiment"
  | "keyword"
  | "turns"
  | "explicit_request"
  | "frustration"
  | "unresolved";

export interface TriggerConfig {
  sentimentThreshold?: number; // -1 to 1, default -0.5
  maxTurns?: number; // Max conversation turns before escalation
  keywords?: string[]; // Keywords that trigger escalation
  phrases?: string[]; // Phrases that trigger escalation
  explicitRequests?: string[]; // Phrases for explicit agent requests
  frustrationIndicators?: string[]; // Frustration detection phrases
}

export interface ConversationContext {
  sentiment?: number; // -1 to 1
  turnCount: number;
  lastMessages: string[]; // Recent user messages for keyword detection
  hasUnresolvedIssue?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: Required<TriggerConfig> = {
  sentimentThreshold: -0.5,
  maxTurns: 10,
  keywords: [
    "cancel",
    "refund",
    "lawsuit",
    "lawyer",
    "attorney",
    "supervisor",
    "manager",
    "urgent",
    "emergency",
  ],
  phrases: [
    "this is unacceptable",
    "I want to speak",
    "escalate this",
    "file a complaint",
    "report this",
    "I demand",
    "I insist",
    "not good enough",
    "waste of time",
    "incompetent",
  ],
  explicitRequests: [
    "talk to a human",
    "speak to a human",
    "human agent",
    "real person",
    "live agent",
    "talk to someone",
    "speak to someone",
    "connect me to",
    "transfer me",
    "get me a person",
    "need a human",
    "want a human",
    "actual person",
    "real agent",
  ],
  frustrationIndicators: [
    "frustrated",
    "annoyed",
    "angry",
    "upset",
    "ridiculous",
    "absurd",
    "stupid",
    "useless",
    "terrible",
    "awful",
    "horrible",
    "worst",
    "hate",
    "disgusted",
    "fed up",
    "sick of",
    "tired of",
  ],
};

/**
 * Trigger Detection Service
 */
export class TriggerDetector {
  private config: Required<TriggerConfig>;

  constructor(config: TriggerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      keywords: config.keywords ?? DEFAULT_CONFIG.keywords,
      phrases: config.phrases ?? DEFAULT_CONFIG.phrases,
      explicitRequests: config.explicitRequests ?? DEFAULT_CONFIG.explicitRequests,
      frustrationIndicators:
        config.frustrationIndicators ?? DEFAULT_CONFIG.frustrationIndicators,
    };
  }

  /**
   * Analyze conversation for escalation triggers
   */
  analyze(context: ConversationContext): EscalationTrigger[] {
    const triggers: EscalationTrigger[] = [];

    // Check sentiment trigger
    const sentimentTrigger = this.checkSentiment(context);
    if (sentimentTrigger.triggered) {
      triggers.push(sentimentTrigger);
    }

    // Check turn limit trigger
    const turnsTrigger = this.checkTurnLimit(context);
    if (turnsTrigger.triggered) {
      triggers.push(turnsTrigger);
    }

    // Check for explicit escalation requests
    const explicitTrigger = this.checkExplicitRequest(context);
    if (explicitTrigger.triggered) {
      triggers.push(explicitTrigger);
    }

    // Check for keywords/phrases
    const keywordTrigger = this.checkKeywords(context);
    if (keywordTrigger.triggered) {
      triggers.push(keywordTrigger);
    }

    // Check for frustration indicators
    const frustrationTrigger = this.checkFrustration(context);
    if (frustrationTrigger.triggered) {
      triggers.push(frustrationTrigger);
    }

    return triggers;
  }

  /**
   * Quick check if any trigger is active
   */
  shouldEscalate(context: ConversationContext): boolean {
    const triggers = this.analyze(context);
    return triggers.some((t) => t.triggered);
  }

  /**
   * Get the primary reason for escalation
   */
  getEscalationReason(context: ConversationContext): string | null {
    const triggers = this.analyze(context);
    if (triggers.length === 0) return null;

    // Priority order: explicit > sentiment > frustration > keyword > turns
    const priority: TriggerType[] = [
      "explicit_request",
      "sentiment",
      "frustration",
      "keyword",
      "turns",
    ];

    for (const type of priority) {
      const trigger = triggers.find((t) => t.type === type);
      if (trigger) {
        return trigger.reason ?? `Triggered by ${type}`;
      }
    }

    return triggers[0]?.reason ?? "Unknown trigger";
  }

  /**
   * Check sentiment threshold
   */
  private checkSentiment(context: ConversationContext): EscalationTrigger {
    if (context.sentiment === undefined) {
      return { type: "sentiment", triggered: false };
    }

    const triggered = context.sentiment <= this.config.sentimentThreshold;

    return {
      type: "sentiment",
      triggered,
      reason: triggered
        ? `Negative sentiment detected (${context.sentiment.toFixed(2)})`
        : undefined,
      confidence: triggered ? Math.abs(context.sentiment) : undefined,
      metadata: { sentiment: context.sentiment },
    };
  }

  /**
   * Check conversation turn limit
   */
  private checkTurnLimit(context: ConversationContext): EscalationTrigger {
    const triggered = context.turnCount >= this.config.maxTurns;

    return {
      type: "turns",
      triggered,
      reason: triggered
        ? `Conversation exceeded ${this.config.maxTurns} turns`
        : undefined,
      metadata: { turnCount: context.turnCount, maxTurns: this.config.maxTurns },
    };
  }

  /**
   * Check for explicit escalation requests
   */
  private checkExplicitRequest(context: ConversationContext): EscalationTrigger {
    const recentText = context.lastMessages.join(" ").toLowerCase();

    for (const phrase of this.config.explicitRequests) {
      if (recentText.includes(phrase.toLowerCase())) {
        return {
          type: "explicit_request",
          triggered: true,
          reason: "Customer requested to speak with a human agent",
          confidence: 1.0,
          metadata: { matchedPhrase: phrase },
        };
      }
    }

    return { type: "explicit_request", triggered: false };
  }

  /**
   * Check for escalation keywords and phrases
   */
  private checkKeywords(context: ConversationContext): EscalationTrigger {
    const recentText = context.lastMessages.join(" ").toLowerCase();
    const matchedKeywords: string[] = [];
    const matchedPhrases: string[] = [];

    // Check keywords
    for (const keyword of this.config.keywords) {
      if (recentText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    // Check phrases
    for (const phrase of this.config.phrases) {
      if (recentText.includes(phrase.toLowerCase())) {
        matchedPhrases.push(phrase);
      }
    }

    const hasMatches = matchedKeywords.length > 0 || matchedPhrases.length > 0;

    if (hasMatches) {
      const allMatches = [...matchedKeywords, ...matchedPhrases];
      return {
        type: "keyword",
        triggered: true,
        reason: `Keywords detected: ${allMatches.join(", ")}`,
        confidence: Math.min(1.0, allMatches.length * 0.3),
        metadata: { matchedKeywords, matchedPhrases },
      };
    }

    return { type: "keyword", triggered: false };
  }

  /**
   * Check for frustration indicators
   */
  private checkFrustration(context: ConversationContext): EscalationTrigger {
    const recentText = context.lastMessages.join(" ").toLowerCase();
    const matchedIndicators: string[] = [];

    for (const indicator of this.config.frustrationIndicators) {
      if (recentText.includes(indicator.toLowerCase())) {
        matchedIndicators.push(indicator);
      }
    }

    if (matchedIndicators.length >= 2) {
      return {
        type: "frustration",
        triggered: true,
        reason: "Customer appears frustrated",
        confidence: Math.min(1.0, matchedIndicators.length * 0.25),
        metadata: { matchedIndicators },
      };
    }

    return { type: "frustration", triggered: false };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TriggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton
let triggerDetectorInstance: TriggerDetector | null = null;

export function getTriggerDetector(config?: TriggerConfig): TriggerDetector {
  if (!triggerDetectorInstance || config) {
    triggerDetectorInstance = new TriggerDetector(config);
  }
  return triggerDetectorInstance;
}

// Export convenience function
export function detectEscalationTriggers(
  context: ConversationContext,
  config?: TriggerConfig
): EscalationTrigger[] {
  const detector = new TriggerDetector(config);
  return detector.analyze(context);
}

export function shouldEscalate(
  context: ConversationContext,
  config?: TriggerConfig
): boolean {
  const detector = new TriggerDetector(config);
  return detector.shouldEscalate(context);
}
