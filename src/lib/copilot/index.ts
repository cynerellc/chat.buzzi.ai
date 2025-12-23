/**
 * AI Co-pilot Module
 *
 * Provides AI-powered assistance for support agents:
 * - Response suggestions
 * - Message improvement
 * - Translation
 * - Conversation analysis
 */

export {
  SuggestionService,
  getSuggestionService,
  createSuggestionService,
  type Message,
  type ConversationContext,
  type SuggestionOptions,
  type ResponseSuggestion,
  type SuggestionResult,
  type CannedResponse,
  type KnowledgeArticle,
} from "./suggestion-service";
