/**
 * Sentiment Analysis Service
 *
 * Analyzes customer messages to determine sentiment scores.
 * Uses a combination of lexicon-based and heuristic approaches.
 * Can be extended to use ML-based analysis via OpenAI.
 */

// Types
export interface SentimentResult {
  score: number; // -1 (very negative) to 1 (very positive)
  magnitude: number; // 0 to 1, strength of sentiment
  label: SentimentLabel;
  confidence: number;
  details: SentimentDetails;
}

export type SentimentLabel = "very_negative" | "negative" | "neutral" | "positive" | "very_positive";

export interface SentimentDetails {
  positiveWords: string[];
  negativeWords: string[];
  intensifiers: string[];
  negations: string[];
  emoticons: string[];
}

// Sentiment lexicons
const POSITIVE_WORDS = new Set([
  "good", "great", "excellent", "amazing", "wonderful", "fantastic", "awesome",
  "perfect", "love", "like", "happy", "pleased", "satisfied", "helpful", "thank",
  "thanks", "appreciate", "brilliant", "superb", "nice", "best", "beautiful",
  "delighted", "thrilled", "excited", "grateful", "impressive", "outstanding",
  "remarkable", "terrific", "marvelous", "pleasant", "enjoy", "enjoyed", "loving",
  "glad", "cheerful", "joyful", "wonderful", "fabulous", "splendid", "magnificent",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "horrible", "poor", "worst", "hate", "angry",
  "frustrated", "annoyed", "disappointed", "upset", "unhappy", "dissatisfied",
  "problem", "issue", "broken", "error", "fail", "failed", "failure", "wrong",
  "useless", "stupid", "ridiculous", "absurd", "incompetent", "pathetic",
  "unacceptable", "disgusting", "disgusted", "furious", "outraged", "appalled",
  "dreadful", "atrocious", "abysmal", "inferior", "defective", "faulty",
  "inadequate", "hopeless", "miserable", "deplorable", "waste", "wasted",
]);

const INTENSIFIERS = new Set([
  "very", "really", "extremely", "incredibly", "absolutely", "totally",
  "completely", "utterly", "highly", "deeply", "so", "such", "particularly",
  "especially", "exceptionally", "remarkably", "extraordinarily",
]);

const NEGATIONS = new Set([
  "not", "no", "never", "neither", "nobody", "nothing", "nowhere", "none",
  "hardly", "barely", "scarcely", "doesn't", "don't", "didn't", "isn't",
  "aren't", "wasn't", "weren't", "won't", "wouldn't", "couldn't", "shouldn't",
  "can't", "cannot",
]);

const POSITIVE_EMOTICONS = [":)", ":-)", ":D", ":-D", ";)", ";-)", ":P", ":-P", "❤", "👍", "😊", "😀", "🎉", "💯"];
const NEGATIVE_EMOTICONS = [":(", ":-(", ":/", ":-/", "😢", "😞", "😠", "👎", "😡", "😤", "🙁"];

/**
 * Sentiment Analyzer Class
 */
export class SentimentAnalyzer {
  private useLLM: boolean;

  constructor(options: { useLLM?: boolean } = {}) {
    this.useLLM = options.useLLM ?? false;
  }

  /**
   * Analyze sentiment of a single message
   */
  analyze(text: string): SentimentResult {
    const words = this.tokenize(text);
    const details = this.extractDetails(text, words);

    // Calculate base sentiment score
    let positiveScore = 0;
    let negativeScore = 0;
    let intensifierMultiplier = 1;
    let negationActive = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!.toLowerCase();
      const prevWord = i > 0 ? words[i - 1]!.toLowerCase() : "";

      // Check for negation
      if (NEGATIONS.has(word)) {
        negationActive = true;
        continue;
      }

      // Check for intensifier
      if (INTENSIFIERS.has(word)) {
        intensifierMultiplier = 1.5;
        continue;
      }

      // Check for positive word
      if (POSITIVE_WORDS.has(word)) {
        const score = intensifierMultiplier * (negationActive ? -1 : 1);
        if (score > 0) positiveScore += score;
        else negativeScore += Math.abs(score);
      }

      // Check for negative word
      if (NEGATIVE_WORDS.has(word)) {
        const score = intensifierMultiplier * (negationActive ? 1 : -1);
        if (score > 0) positiveScore += score;
        else negativeScore += Math.abs(score);
      }

      // Reset modifiers after sentiment word
      if (POSITIVE_WORDS.has(word) || NEGATIVE_WORDS.has(word)) {
        intensifierMultiplier = 1;
        negationActive = false;
      }

      // Check for negation in previous word (e.g., "not good")
      if (NEGATIONS.has(prevWord) && (POSITIVE_WORDS.has(word) || NEGATIVE_WORDS.has(word))) {
        // Flip the sentiment
        const temp = positiveScore;
        positiveScore = negativeScore;
        negativeScore = temp;
      }
    }

    // Add emoticon influence
    for (const emo of POSITIVE_EMOTICONS) {
      if (text.includes(emo)) positiveScore += 0.5;
    }
    for (const emo of NEGATIVE_EMOTICONS) {
      if (text.includes(emo)) negativeScore += 0.5;
    }

    // Calculate final score (-1 to 1)
    const total = positiveScore + negativeScore;
    let score = 0;
    if (total > 0) {
      score = (positiveScore - negativeScore) / total;
    }

    // Calculate magnitude (strength of sentiment)
    const magnitude = Math.min(1, total / 5);

    // Determine label
    const label = this.getLabel(score);

    // Calculate confidence based on evidence
    const confidence = Math.min(1, (details.positiveWords.length + details.negativeWords.length) * 0.2 + 0.3);

    return {
      score,
      magnitude,
      label,
      confidence,
      details,
    };
  }

  /**
   * Analyze sentiment across multiple messages
   */
  analyzeConversation(messages: string[]): SentimentResult {
    if (messages.length === 0) {
      return {
        score: 0,
        magnitude: 0,
        label: "neutral",
        confidence: 0,
        details: {
          positiveWords: [],
          negativeWords: [],
          intensifiers: [],
          negations: [],
          emoticons: [],
        },
      };
    }

    // Weight recent messages more heavily
    const weights = messages.map((_, i) => Math.pow(1.5, i));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let weightedScore = 0;
    let weightedMagnitude = 0;
    const allDetails: SentimentDetails = {
      positiveWords: [],
      negativeWords: [],
      intensifiers: [],
      negations: [],
      emoticons: [],
    };

    for (let i = 0; i < messages.length; i++) {
      const result = this.analyze(messages[i]!);
      const weight = weights[i]! / totalWeight;

      weightedScore += result.score * weight;
      weightedMagnitude += result.magnitude * weight;

      // Combine details
      allDetails.positiveWords.push(...result.details.positiveWords);
      allDetails.negativeWords.push(...result.details.negativeWords);
      allDetails.intensifiers.push(...result.details.intensifiers);
      allDetails.negations.push(...result.details.negations);
      allDetails.emoticons.push(...result.details.emoticons);
    }

    // Deduplicate details
    allDetails.positiveWords = [...new Set(allDetails.positiveWords)];
    allDetails.negativeWords = [...new Set(allDetails.negativeWords)];
    allDetails.intensifiers = [...new Set(allDetails.intensifiers)];
    allDetails.negations = [...new Set(allDetails.negations)];
    allDetails.emoticons = [...new Set(allDetails.emoticons)];

    return {
      score: weightedScore,
      magnitude: weightedMagnitude,
      label: this.getLabel(weightedScore),
      confidence: Math.min(1, messages.length * 0.15 + 0.3),
      details: allDetails,
    };
  }

  /**
   * Detect sentiment trend (improving, declining, stable)
   */
  detectTrend(messages: string[]): "improving" | "declining" | "stable" {
    if (messages.length < 3) return "stable";

    const scores = messages.map((m) => this.analyze(m).score);

    // Simple linear regression
    const n = scores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 0.1) return "improving";
    if (slope < -0.1) return "declining";
    return "stable";
  }

  /**
   * Check if sentiment indicates escalation need
   */
  needsEscalation(text: string | string[], threshold: number = -0.5): boolean {
    const result = Array.isArray(text)
      ? this.analyzeConversation(text)
      : this.analyze(text);

    return result.score <= threshold;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  /**
   * Extract sentiment-relevant details from text
   */
  private extractDetails(text: string, words: string[]): SentimentDetails {
    const lowerText = text.toLowerCase();
    const lowerWords = words.map((w) => w.toLowerCase());

    return {
      positiveWords: lowerWords.filter((w) => POSITIVE_WORDS.has(w)),
      negativeWords: lowerWords.filter((w) => NEGATIVE_WORDS.has(w)),
      intensifiers: lowerWords.filter((w) => INTENSIFIERS.has(w)),
      negations: lowerWords.filter((w) => NEGATIONS.has(w)),
      emoticons: [
        ...POSITIVE_EMOTICONS.filter((e) => lowerText.includes(e.toLowerCase())),
        ...NEGATIVE_EMOTICONS.filter((e) => lowerText.includes(e.toLowerCase())),
      ],
    };
  }

  /**
   * Get sentiment label from score
   */
  private getLabel(score: number): SentimentLabel {
    if (score <= -0.6) return "very_negative";
    if (score <= -0.2) return "negative";
    if (score <= 0.2) return "neutral";
    if (score <= 0.6) return "positive";
    return "very_positive";
  }
}

// Singleton instance
let analyzerInstance: SentimentAnalyzer | null = null;

export function getSentimentAnalyzer(options?: { useLLM?: boolean }): SentimentAnalyzer {
  if (!analyzerInstance || options) {
    analyzerInstance = new SentimentAnalyzer(options);
  }
  return analyzerInstance;
}

// Convenience functions
export function analyzeSentiment(text: string): SentimentResult {
  return getSentimentAnalyzer().analyze(text);
}

export function analyzeConversationSentiment(messages: string[]): SentimentResult {
  return getSentimentAnalyzer().analyzeConversation(messages);
}

export function needsEscalation(text: string | string[], threshold?: number): boolean {
  return getSentimentAnalyzer().needsEscalation(text, threshold);
}
