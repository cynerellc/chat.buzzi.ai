/**
 * Escalation Module
 *
 * Exports the escalation service and related utilities for Human-in-the-Loop (HITL) support.
 */

// Main service
export {
  EscalationService,
  getEscalationService,
  createEscalation,
  autoEscalateConversation,
  resolveEscalation,
  type CreateEscalationOptions,
  type EscalationDetails,
  type ResolveOptions,
} from "./escalation-service";

// Trigger detection
export {
  TriggerDetector,
  getTriggerDetector,
  detectEscalationTriggers,
  shouldEscalate,
  type EscalationTrigger,
  type TriggerType,
  type TriggerConfig,
  type ConversationContext,
} from "./triggers";

// Routing
export {
  RoutingService,
  getRoutingService,
  routeEscalation,
  getAvailableAgents,
  processEscalationQueue,
  type RoutingOptions,
  type RoutingStrategy,
  type AvailableAgent,
  type RoutingResult,
} from "./routing";

// Sentiment Analysis
export {
  SentimentAnalyzer,
  getSentimentAnalyzer,
  analyzeSentiment,
  analyzeConversationSentiment,
  needsEscalation,
  type SentimentResult,
  type SentimentLabel,
  type SentimentDetails,
} from "./sentiment-analyzer";
