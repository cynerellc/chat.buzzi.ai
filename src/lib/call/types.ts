/**
 * Call Feature Type Definitions
 *
 * This file contains all TypeScript types and interfaces used throughout the call feature.
 */

// ============================================================================
// Call Session Types
// ============================================================================

export type CallSource = "web" | "whatsapp" | "twilio" | "vonage";
export type CallStatus =
  | "pending"
  | "connecting"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "cancelled"
  | "timeout";

export type CallAiProvider = "OPENAI" | "GEMINI";

export interface CallSession {
  sessionId: string;
  callId: string;
  chatbotId: string;
  companyId: string;
  endUserId?: string;
  source: CallSource;
  status: CallStatus;
  aiProvider?: CallAiProvider;
  startedAt: Date;
  lastActivity: Date;
}

export interface CreateCallSessionParams {
  chatbotId: string;
  companyId: string;
  endUserId?: string;
  source: CallSource;
  fromNumber?: string;
  toNumber?: string;
  callerName?: string;
  callerEmail?: string;
  integrationAccountId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Voice Configuration Types
// ============================================================================

export interface VoiceConfig {
  // OpenAI configuration
  openai_voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse";
  openai_model?: string; // e.g., "gpt-4o-realtime-preview-2024-10-01"
  // Gemini configuration
  gemini_voice?: "Kore" | "Aoede" | "Puck" | "Charon" | "Fenrir";
  gemini_model?: string; // e.g., "gemini-2.0-flash-live-001"
  // Voice Activity Detection settings
  vad_threshold?: number; // 0.0-1.0 for OpenAI
  vad_sensitivity?: "LOW" | "MEDIUM" | "HIGH"; // For Gemini
  silence_duration_ms?: number;
  prefix_padding_ms?: number;
  // Call-specific prompts
  call_greeting?: string;
  system_prompt_call?: string;
}

// ============================================================================
// Transcript Types
// ============================================================================

export interface TranscriptData {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number; // Milliseconds from call start
  isFinal?: boolean;
  confidence?: number;
}

export interface CallTranscriptEntry {
  id: string;
  callId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestampMs: number;
  durationMs?: number;
  isFinal: boolean;
  confidence?: number;
  createdAt: Date;
}

// ============================================================================
// Audio Types
// ============================================================================

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

export interface AudioConfig {
  sampleRate: number; // 16000 or 24000
  channels: number; // 1 (mono) or 2 (stereo)
  encoding: "pcm16" | "opus" | "mulaw";
}

// ============================================================================
// Executor Types
// ============================================================================

export interface ExecutorConfig {
  chatbotId: string;
  companyId: string;
  aiProvider: CallAiProvider;
  voiceConfig: VoiceConfig;
  systemPrompt?: string;
  knowledgeCategories?: string[];
  knowledgeEnabled?: boolean; // Whether knowledge base tool should be available
  knowledgeThreshold?: number; // Min relevance score for RAG results (0.05-0.95)
  tools?: unknown[]; // OpenAI-formatted tool schemas
  registeredTools?: RegisteredToolRef[]; // Full tool objects with execute functions
}

/**
 * Reference to a RegisteredTool for executor use
 * Matches the RegisteredTool interface from @/lib/ai/tools/types
 */
export interface RegisteredToolRef {
  name: string;
  description: string;
  category?: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    params: Record<string, unknown>,
    context: unknown
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

export interface ExecutorEvents {
  audioDelta: (audioData: Buffer) => void;
  transcriptDelta: (data: TranscriptData) => void;
  agentSpeaking: () => void;
  agentListening: () => void;
  userInterrupted: () => void;
  turnComplete: () => void;
  error: (error: Error) => void;
  connectionClosed: () => void;
}

// ============================================================================
// Handler Types
// ============================================================================

export interface CallHandlerEvents {
  audioReceived: (audioData: Buffer) => void;
  callStarted: () => void;
  callEnded: (reason?: string) => void;
  error: (error: Error) => void;
}

// ============================================================================
// Call Recording Types
// ============================================================================

export interface CallRecording {
  callId: string;
  url: string;
  storagePath: string;
  durationSeconds: number;
  sizeBytes: number;
}

// ============================================================================
// Integration Account Types
// ============================================================================

export type IntegrationProvider = "whatsapp" | "twilio" | "vonage" | "bandwidth";

export interface IntegrationAccountCredentials {
  // WhatsApp
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
  whatsapp_app_secret?: string;
  // Twilio
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  // Vonage
  vonage_api_key?: string;
  vonage_api_secret?: string;
  vonage_application_id?: string;
  vonage_private_key?: string;
  // Bandwidth
  bandwidth_account_id?: string;
  bandwidth_api_token?: string;
  bandwidth_api_secret?: string;
}

export interface IntegrationAccountSettings {
  webhook_url?: string;
  default_ai_provider?: CallAiProvider;
  recording_enabled?: boolean;
  auto_answer?: boolean;
  call_timeout_seconds?: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class CallError extends Error {
  constructor(
    message: string,
    public code: string,
    public callId?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "CallError";
  }
}

export class ExecutorError extends Error {
  constructor(
    message: string,
    public code: string,
    public chatbotId?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ExecutorError";
  }
}

export class HandlerError extends Error {
  constructor(
    message: string,
    public code: string,
    public sessionId?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HandlerError";
  }
}
