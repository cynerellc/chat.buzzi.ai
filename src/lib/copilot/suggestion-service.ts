/**
 * AI Co-pilot Suggestion Service
 *
 * Provides AI-powered response suggestions for support agents.
 * Features:
 * - Real-time response suggestions
 * - Context-aware recommendations
 * - Tone adjustment
 * - Knowledge base integration
 * - Canned response matching
 */

import { LLMClient, createLLMClient } from "@/lib/ai/llm/client";
import type { LLMConfig, LLMMessage } from "@/lib/ai/types";

// ============================================================================
// Types
// ============================================================================

export interface Message {
  role: "user" | "assistant" | "agent";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  conversationId: string;
  messages: Message[];
  customerName?: string;
  customerEmail?: string;
  topic?: string;
  sentiment?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SuggestionOptions {
  tone?: "professional" | "friendly" | "empathetic" | "formal";
  maxSuggestions?: number;
  includeKnowledgeBase?: boolean;
  includeCannedResponses?: boolean;
  maxLength?: number;
  language?: string;
}

export interface ResponseSuggestion {
  id: string;
  content: string;
  confidence: number;
  type: "ai_generated" | "canned_response" | "knowledge_based";
  tone: string;
  metadata?: Record<string, unknown>;
}

export interface SuggestionResult {
  suggestions: ResponseSuggestion[];
  context: {
    topic: string;
    sentiment: string;
    intent: string;
    urgency: "low" | "normal" | "high" | "urgent";
  };
  generatedAt: Date;
  latencyMs: number;
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  shortcut?: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary?: string;
  relevanceScore: number;
}

// ============================================================================
// Suggestion Service Class
// ============================================================================

export class SuggestionService {
  private llmClient: LLMClient;
  private cannedResponses: Map<string, CannedResponse> = new Map();
  private knowledgeArticles: Map<string, KnowledgeArticle> = new Map();

  constructor(config?: Partial<LLMConfig>) {
    const llmConfig: LLMConfig = {
      provider: config?.provider ?? "openai",
      model: config?.model ?? "gpt-4o-mini",
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 1024,
    };

    this.llmClient = createLLMClient(llmConfig);
  }

  /**
   * Generate response suggestions for a conversation
   */
  async generateSuggestions(
    context: ConversationContext,
    options?: SuggestionOptions
  ): Promise<SuggestionResult> {
    const startTime = performance.now();
    const suggestions: ResponseSuggestion[] = [];

    // Analyze conversation context
    const analysis = await this.analyzeConversation(context);

    // Get AI-generated suggestions
    const aiSuggestions = await this.generateAISuggestions(
      context,
      analysis,
      options
    );
    suggestions.push(...aiSuggestions);

    // Match canned responses if enabled
    if (options?.includeCannedResponses !== false) {
      const cannedMatches = this.matchCannedResponses(context, analysis);
      suggestions.push(...cannedMatches);
    }

    // Get knowledge base suggestions if enabled
    if (options?.includeKnowledgeBase !== false) {
      const kbSuggestions = await this.getKnowledgeBaseSuggestions(
        context,
        analysis
      );
      suggestions.push(...kbSuggestions);
    }

    // Sort by confidence and limit results
    const maxSuggestions = options?.maxSuggestions ?? 3;
    const sortedSuggestions = suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);

    return {
      suggestions: sortedSuggestions,
      context: {
        topic: analysis.topic,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        urgency: analysis.urgency,
      },
      generatedAt: new Date(),
      latencyMs: performance.now() - startTime,
    };
  }

  /**
   * Generate a single quick reply
   */
  async generateQuickReply(
    context: ConversationContext,
    options?: SuggestionOptions
  ): Promise<ResponseSuggestion | null> {
    const result = await this.generateSuggestions(context, {
      ...options,
      maxSuggestions: 1,
    });

    return result.suggestions[0] ?? null;
  }

  /**
   * Improve or rephrase existing draft
   */
  async improveDraft(
    draft: string,
    context: ConversationContext,
    options?: {
      tone?: SuggestionOptions["tone"];
      action?: "rephrase" | "shorten" | "expand" | "fix_grammar" | "make_clearer";
    }
  ): Promise<ResponseSuggestion> {
    const actionPrompts: Record<string, string> = {
      rephrase: "Rephrase this message while maintaining the same meaning:",
      shorten: "Make this message more concise while keeping key information:",
      expand: "Expand this message with more detail and context:",
      fix_grammar: "Fix any grammar or spelling errors in this message:",
      make_clearer: "Make this message clearer and easier to understand:",
    };

    const action = options?.action ?? "rephrase";
    const tone = options?.tone ?? "professional";

    const systemPrompt = `You are a writing assistant helping a support agent communicate with customers.
Maintain a ${tone} tone.
${actionPrompts[action]}

Respond with ONLY the improved message, no explanations.`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Original message:\n${draft}\n\nCustomer context: Last message was "${context.messages[context.messages.length - 1]?.content ?? ""}"`,
      },
    ];

    const response = await this.llmClient.chat(messages);

    return {
      id: crypto.randomUUID(),
      content: response.content.trim(),
      confidence: 0.9,
      type: "ai_generated",
      tone,
      metadata: {
        action,
        originalLength: draft.length,
        newLength: response.content.length,
      },
    };
  }

  /**
   * Translate response to another language
   */
  async translateResponse(
    content: string,
    targetLanguage: string
  ): Promise<ResponseSuggestion> {
    const systemPrompt = `You are a translator. Translate the following customer support message to ${targetLanguage}.
Maintain the professional tone and any technical terms.
Respond with ONLY the translated text, no explanations.`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content },
    ];

    const response = await this.llmClient.chat(messages);

    return {
      id: crypto.randomUUID(),
      content: response.content.trim(),
      confidence: 0.95,
      type: "ai_generated",
      tone: "professional",
      metadata: {
        originalLanguage: "auto",
        targetLanguage,
      },
    };
  }

  /**
   * Add canned responses to the service
   */
  addCannedResponses(responses: CannedResponse[]): void {
    for (const response of responses) {
      this.cannedResponses.set(response.id, response);
    }
  }

  /**
   * Add knowledge articles to the service
   */
  addKnowledgeArticles(articles: KnowledgeArticle[]): void {
    for (const article of articles) {
      this.knowledgeArticles.set(article.id, article);
    }
  }

  /**
   * Get analysis of customer sentiment and intent
   */
  async analyzeCustomerMessage(message: string): Promise<{
    sentiment: "positive" | "neutral" | "negative";
    sentimentScore: number;
    intent: string;
    topics: string[];
    urgency: "low" | "normal" | "high" | "urgent";
    suggestedActions: string[];
  }> {
    const systemPrompt = `Analyze this customer message and respond with JSON only:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": 0.0 to 1.0 (0 = very negative, 1 = very positive),
  "intent": "brief description of what customer wants",
  "topics": ["array", "of", "topics"],
  "urgency": "low" | "normal" | "high" | "urgent",
  "suggestedActions": ["array", "of", "suggested", "actions"]
}`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const response = await this.llmClient.chat(messages);

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        sentiment: "neutral",
        sentimentScore: 0.5,
        intent: "Unknown",
        topics: [],
        urgency: "normal",
        suggestedActions: [],
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async analyzeConversation(context: ConversationContext): Promise<{
    topic: string;
    sentiment: string;
    intent: string;
    urgency: "low" | "normal" | "high" | "urgent";
    keyPoints: string[];
  }> {
    // Get last few messages for analysis
    const recentMessages = context.messages.slice(-5);
    const conversationText = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Analyze this customer support conversation and respond with JSON only:
{
  "topic": "main topic being discussed",
  "sentiment": "customer sentiment: positive/neutral/negative/frustrated",
  "intent": "what the customer is trying to achieve",
  "urgency": "low" | "normal" | "high" | "urgent",
  "keyPoints": ["key points to address"]
}`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: conversationText },
    ];

    try {
      const response = await this.llmClient.chat(messages);
      return JSON.parse(response.content);
    } catch {
      return {
        topic: "General inquiry",
        sentiment: "neutral",
        intent: "Seeking assistance",
        urgency: "normal",
        keyPoints: [],
      };
    }
  }

  private async generateAISuggestions(
    context: ConversationContext,
    analysis: { topic: string; sentiment: string; intent: string; urgency: string; keyPoints: string[] },
    options?: SuggestionOptions
  ): Promise<ResponseSuggestion[]> {
    const tone = options?.tone ?? "professional";
    const maxLength = options?.maxLength ?? 500;

    const recentMessages = context.messages.slice(-5);
    const conversationText = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const systemPrompt = `You are an AI assistant helping a support agent respond to customers.

Context:
- Topic: ${analysis.topic}
- Customer sentiment: ${analysis.sentiment}
- Customer intent: ${analysis.intent}
- Key points to address: ${analysis.keyPoints.join(", ")}

Guidelines:
- Use a ${tone} tone
- Keep response under ${maxLength} characters
- Be helpful and address the customer's needs
- If customer is frustrated, acknowledge their feelings
- Provide actionable information

Generate 2-3 different response options. Return as JSON array:
[
  {"content": "response text", "confidence": 0.0-1.0, "tone": "tone used"}
]`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Conversation:\n${conversationText}` },
    ];

    try {
      const response = await this.llmClient.chat(messages);
      const suggestions = JSON.parse(response.content);

      return suggestions.map((s: { content: string; confidence: number; tone: string }) => ({
        id: crypto.randomUUID(),
        content: s.content,
        confidence: s.confidence,
        type: "ai_generated" as const,
        tone: s.tone,
      }));
    } catch {
      return [];
    }
  }

  private matchCannedResponses(
    context: ConversationContext,
    analysis: { topic: string; keyPoints: string[] }
  ): ResponseSuggestion[] {
    const suggestions: ResponseSuggestion[] = [];
    const lastMessage = context.messages[context.messages.length - 1]?.content?.toLowerCase() ?? "";

    for (const [id, response] of this.cannedResponses) {
      // Simple keyword matching
      const keywords = [...response.tags, response.category.toLowerCase()];
      const matchScore = keywords.reduce((score, keyword) => {
        if (lastMessage.includes(keyword.toLowerCase())) {
          return score + 0.2;
        }
        if (analysis.topic.toLowerCase().includes(keyword.toLowerCase())) {
          return score + 0.1;
        }
        return score;
      }, 0);

      if (matchScore > 0.2) {
        suggestions.push({
          id: crypto.randomUUID(),
          content: response.content,
          confidence: Math.min(matchScore, 0.9),
          type: "canned_response",
          tone: "professional",
          metadata: {
            sourceId: id,
            sourceName: response.title,
            matchScore,
          },
        });
      }
    }

    return suggestions.slice(0, 2);
  }

  private async getKnowledgeBaseSuggestions(
    context: ConversationContext,
    analysis: { topic: string; keyPoints: string[] }
  ): Promise<ResponseSuggestion[]> {
    const suggestions: ResponseSuggestion[] = [];
    const lastMessage = context.messages[context.messages.length - 1]?.content?.toLowerCase() ?? "";

    for (const [id, article] of this.knowledgeArticles) {
      // Simple relevance matching
      const titleMatch = article.title.toLowerCase().includes(analysis.topic.toLowerCase());
      const contentMatch = article.content.toLowerCase().includes(lastMessage.slice(0, 50));

      if (titleMatch || contentMatch) {
        const summary = article.summary ?? article.content.slice(0, 200);

        suggestions.push({
          id: crypto.randomUUID(),
          content: `Based on our knowledge base article "${article.title}":\n\n${summary}`,
          confidence: titleMatch ? 0.8 : 0.6,
          type: "knowledge_based",
          tone: "professional",
          metadata: {
            sourceId: id,
            sourceName: article.title,
            matchScore: article.relevanceScore,
          },
        });
      }
    }

    return suggestions.slice(0, 2);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let suggestionServiceInstance: SuggestionService | null = null;

export function getSuggestionService(config?: Partial<LLMConfig>): SuggestionService {
  if (!suggestionServiceInstance) {
    suggestionServiceInstance = new SuggestionService(config);
  }
  return suggestionServiceInstance;
}

export function createSuggestionService(config?: Partial<LLMConfig>): SuggestionService {
  return new SuggestionService(config);
}
