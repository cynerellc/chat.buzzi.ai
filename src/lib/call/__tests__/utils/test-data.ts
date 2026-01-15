/**
 * Test Data Generators for Call Feature Tests
 *
 * Provides utility functions to generate test data for audio processing,
 * call sessions, and other call-related entities.
 */

import type { CallSession, CallSource, CallStatus, CallAiProvider, VoiceConfig } from "../../types";

// ============================================================================
// Audio Test Data Generators
// ============================================================================

/**
 * Generate a PCM16 audio buffer of specified duration
 * Creates a buffer with random noise (simulating real audio)
 */
export function generateTestAudio(durationMs: number, sampleRate: number = 24000): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    // Generate random samples in valid PCM16 range
    const sample = Math.floor(Math.random() * 65536) - 32768;
    buffer.writeInt16LE(sample, i * 2);
  }

  return buffer;
}

/**
 * Generate a sine wave PCM16 buffer
 * Useful for testing audio processing that needs predictable waveforms
 */
export function generateSineWave(
  frequency: number,
  sampleRate: number,
  durationMs: number,
  amplitude: number = 0.5
): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(amplitude * 32767 * Math.sin(2 * Math.PI * frequency * t));
    buffer.writeInt16LE(sample, i * 2);
  }

  return buffer;
}

/**
 * Generate silence PCM16 buffer (all zeros)
 */
export function generateSilence(sampleRate: number, durationMs: number): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  return Buffer.alloc(numSamples * 2);
}

/**
 * Generate stereo PCM16 buffer from two mono sources
 */
export function generateStereo(left: Buffer, right: Buffer): Buffer {
  if (left.length !== right.length) {
    throw new Error("Left and right channels must have the same length");
  }

  const numSamples = left.length / 2;
  const stereo = Buffer.alloc(numSamples * 4);

  for (let i = 0; i < numSamples; i++) {
    stereo.writeInt16LE(left.readInt16LE(i * 2), i * 4);
    stereo.writeInt16LE(right.readInt16LE(i * 2), i * 4 + 2);
  }

  return stereo;
}

/**
 * Generate mulaw encoded audio buffer
 */
export function generateMulawAudio(durationMs: number, sampleRate: number = 8000): Buffer {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples);

  for (let i = 0; i < numSamples; i++) {
    // Generate random mulaw samples
    buffer[i] = Math.floor(Math.random() * 256);
  }

  return buffer;
}

// ============================================================================
// Call Session Test Data
// ============================================================================

/**
 * Create a mock CallSession object with optional overrides
 */
export function createMockSession(overrides: Partial<CallSession> = {}): CallSession {
  const now = new Date();
  return {
    sessionId: `test-session-${Date.now()}`,
    callId: `test-call-${Date.now()}`,
    chatbotId: `chatbot-${Date.now()}`,
    companyId: `company-${Date.now()}`,
    source: "web" as CallSource,
    status: "pending" as CallStatus,
    startedAt: now,
    lastActivity: now,
    ...overrides,
  };
}

/**
 * Create mock session creation parameters
 */
export function createMockSessionParams(overrides: Partial<{
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
}> = {}) {
  return {
    chatbotId: `chatbot-${Date.now()}`,
    companyId: `company-${Date.now()}`,
    source: "web" as CallSource,
    ...overrides,
  };
}

// ============================================================================
// Database Record Test Data
// ============================================================================

/**
 * Create a mock database call record
 */
export function createMockCallRecord(overrides: Partial<{
  id: string;
  chatbotId: string;
  companyId: string;
  endUserId: string | null;
  source: CallSource;
  aiProvider: CallAiProvider;
  status: CallStatus;
  integrationAccountId: string | null;
  externalRefs: Record<string, unknown>;
  callerInfo: Record<string, unknown>;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  endReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const now = new Date();
  return {
    id: `call-${Date.now()}`,
    chatbotId: `chatbot-${Date.now()}`,
    companyId: `company-${Date.now()}`,
    endUserId: null,
    source: "web" as CallSource,
    aiProvider: "OPENAI" as CallAiProvider,
    status: "pending" as CallStatus,
    integrationAccountId: null,
    externalRefs: {},
    callerInfo: {},
    startedAt: now,
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    endReason: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock chatbot configuration for call testing
 */
export function createMockChatbot(overrides: Partial<{
  id: string;
  companyId: string;
  name: string;
  status: "active" | "inactive";
  enabledCall: boolean;
  callAiProvider: CallAiProvider | null;
  voiceConfig: VoiceConfig | null;
  agentsList: Array<{
    agent_identifier: string;
    name: string;
    default_system_prompt: string;
    default_model_id: string;
    agent_type: string;
  }>;
}> = {}) {
  return {
    id: `chatbot-${Date.now()}`,
    companyId: `company-${Date.now()}`,
    name: "Test Chatbot",
    status: "active" as const,
    enabledCall: true,
    callAiProvider: "OPENAI" as CallAiProvider,
    voiceConfig: {
      openai_voice: "alloy" as const,
      openai_model: "gpt-4o-realtime-preview-2024-10-01",
      vad_threshold: 0.5,
      silence_duration_ms: 500,
      call_greeting: "Hello, how can I help you?",
    },
    agentsList: [
      {
        agent_identifier: "default-agent",
        name: "Default Agent",
        default_system_prompt: "You are a helpful assistant.",
        default_model_id: "gpt-4o",
        agent_type: "supervisor",
      },
    ],
    ...overrides,
  };
}

/**
 * Create a mock integration account
 */
export function createMockIntegrationAccount(
  options: {
    provider: "whatsapp" | "twilio" | "vonage" | "bandwidth";
    id?: string;
    companyId?: string;
    displayName?: string;
    phoneNumber?: string;
    isVerified?: boolean;
    isActive?: boolean;
    credentials?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    webhookSecret?: string;
  }
) {
  const { provider, credentials: overrideCredentials, ...overrides } = options;

  const baseAccount = {
    id: `integration-${Date.now()}`,
    companyId: `company-${Date.now()}`,
    displayName: `Test ${provider} Account`,
    phoneNumber: "+1234567890",
    isVerified: true,
    isActive: true,
    webhookSecret: `whsec_${Date.now()}`,
    settings: {
      webhook_url: `https://example.com/api/webhook/${provider}`,
      default_ai_provider: "OPENAI",
      recording_enabled: false,
      auto_answer: true,
    },
    ...overrides,
  };

  // Add provider-specific default credentials
  let defaultCredentials: Record<string, unknown>;
  switch (provider) {
    case "twilio":
      defaultCredentials = {
        twilio_account_sid: "AC123456789",
        twilio_auth_token: "auth_token_123",
        twilio_phone_number: "+1234567890",
      };
      break;
    case "whatsapp":
      defaultCredentials = {
        whatsapp_phone_number_id: "123456789",
        whatsapp_business_account_id: "987654321",
        whatsapp_access_token: "access_token_123",
        whatsapp_app_secret: "app_secret_123",
      };
      break;
    case "vonage":
      defaultCredentials = {
        vonage_api_key: "api_key_123",
        vonage_api_secret: "api_secret_123",
        vonage_application_id: "app_id_123",
      };
      break;
    case "bandwidth":
      defaultCredentials = {
        bandwidth_account_id: "account_123",
        bandwidth_api_token: "api_token_123",
        bandwidth_api_secret: "api_secret_123",
      };
      break;
  }

  return {
    ...baseAccount,
    credentials: {
      ...defaultCredentials,
      ...overrideCredentials,
    },
  };
}

// ============================================================================
// Transcript Test Data
// ============================================================================

/**
 * Create a mock transcript entry
 */
export function createMockTranscriptEntry(overrides: Partial<{
  id: string;
  callId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestampMs: number;
  durationMs: number;
  isFinal: boolean;
  confidence: number;
  createdAt: Date;
}> = {}) {
  return {
    id: `transcript-${Date.now()}`,
    callId: `call-${Date.now()}`,
    role: "user" as const,
    content: "Hello, I need help.",
    timestampMs: 0,
    durationMs: 2000,
    isFinal: true,
    confidence: 0.95,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock conversation with multiple transcript entries
 */
export function createMockConversation(callId: string, turns: number = 3) {
  const entries = [];
  let timestampMs = 0;

  for (let i = 0; i < turns; i++) {
    // User message
    entries.push(
      createMockTranscriptEntry({
        callId,
        role: "user",
        content: `User message ${i + 1}`,
        timestampMs,
        durationMs: 2000,
      })
    );
    timestampMs += 2500;

    // Assistant response
    entries.push(
      createMockTranscriptEntry({
        callId,
        role: "assistant",
        content: `Assistant response ${i + 1}`,
        timestampMs,
        durationMs: 3000,
      })
    );
    timestampMs += 3500;
  }

  return entries;
}

// ============================================================================
// Voice Configuration Test Data
// ============================================================================

/**
 * Create mock OpenAI voice configuration
 */
export function createMockOpenAIVoiceConfig(overrides: Partial<VoiceConfig> = {}): VoiceConfig {
  return {
    openai_voice: "alloy",
    openai_model: "gpt-4o-realtime-preview-2024-10-01",
    vad_threshold: 0.5,
    silence_duration_ms: 500,
    prefix_padding_ms: 300,
    call_greeting: "Hello, how can I help you today?",
    system_prompt_call: "You are a helpful customer service assistant.",
    ...overrides,
  };
}

/**
 * Create mock Gemini voice configuration
 */
export function createMockGeminiVoiceConfig(overrides: Partial<VoiceConfig> = {}): VoiceConfig {
  return {
    gemini_voice: "Puck",
    gemini_model: "gemini-2.0-flash-live-001",
    vad_sensitivity: "MEDIUM",
    silence_duration_ms: 500,
    prefix_padding_ms: 300,
    call_greeting: "Hello, how can I help you today?",
    system_prompt_call: "You are a helpful customer service assistant.",
    ...overrides,
  };
}

// ============================================================================
// WebSocket Message Test Data
// ============================================================================

/**
 * Create a mock WebSocket message for widget call
 */
export function createMockWebSocketMessage(
  type: "audio" | "end" | "mute" | "unmute" | "config",
  data?: Record<string, unknown>
) {
  switch (type) {
    case "audio":
      return {
        type: "audio",
        data: data?.audio || generateTestAudio(100).toString("base64"),
      };
    case "end":
      return {
        type: "end",
        reason: data?.reason || "user_hangup",
      };
    case "mute":
      return { type: "mute" };
    case "unmute":
      return { type: "unmute" };
    case "config":
      return {
        type: "config",
        ...data,
      };
  }
}

/**
 * Create a mock Twilio media stream message
 */
export function createMockTwilioMessage(
  event: "connected" | "start" | "media" | "stop" | "mark",
  overrides: Record<string, unknown> = {}
) {
  switch (event) {
    case "connected":
      return {
        event: "connected",
        protocol: "Call",
        version: "1.0.0",
      };
    case "start":
      return {
        event: "start",
        sequenceNumber: "1",
        start: {
          streamSid: `MZ${Date.now()}`,
          accountSid: "AC123456789",
          callSid: `CA${Date.now()}`,
          tracks: ["inbound"],
          mediaFormat: {
            encoding: "audio/x-mulaw",
            sampleRate: 8000,
            channels: 1,
          },
        },
        streamSid: `MZ${Date.now()}`,
        ...overrides,
      };
    case "media":
      return {
        event: "media",
        sequenceNumber: "2",
        media: {
          track: "inbound",
          chunk: "1",
          timestamp: Date.now().toString(),
          payload: generateMulawAudio(20).toString("base64"),
        },
        streamSid: `MZ${Date.now()}`,
        ...overrides,
      };
    case "stop":
      return {
        event: "stop",
        sequenceNumber: "3",
        streamSid: `MZ${Date.now()}`,
        ...overrides,
      };
    case "mark":
      return {
        event: "mark",
        sequenceNumber: "4",
        streamSid: `MZ${Date.now()}`,
        mark: { name: "audio-end" },
        ...overrides,
      };
  }
}

/**
 * Create a mock WhatsApp call webhook payload
 */
export function createMockWhatsAppCallPayload(
  event: "connect" | "terminate" | "media",
  overrides: Record<string, unknown> = {}
) {
  switch (event) {
    case "connect":
      return {
        type: "call.connect",
        call_id: `call-${Date.now()}`,
        phone_number_id: "123456789",
        from: "+1234567890",
        to: "+0987654321",
        sdp_offer: "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\n...",
        ...overrides,
      };
    case "terminate":
      return {
        type: "call.terminate",
        call_id: `call-${Date.now()}`,
        phone_number_id: "123456789",
        reason: "user_hangup",
        ...overrides,
      };
    case "media":
      return {
        type: "call.media",
        call_id: `call-${Date.now()}`,
        phone_number_id: "123456789",
        audio: generateTestAudio(20).toString("base64"),
        ...overrides,
      };
  }
}

// ============================================================================
// Analytics Test Data
// ============================================================================

/**
 * Create mock call analytics data
 */
export function createMockAnalyticsData(options: {
  totalCalls?: number;
  completedCalls?: number;
  failedCalls?: number;
  days?: number;
} = {}) {
  const { totalCalls = 100, completedCalls = 85, failedCalls = 15, days = 30 } = options;

  return {
    summary: {
      totalCalls,
      completedCalls,
      failedCalls,
      successRate: Math.round((completedCalls / totalCalls) * 100),
      averageDurationSeconds: 180,
      totalDurationSeconds: completedCalls * 180,
      totalTurns: completedCalls * 5,
      averageTurns: 5,
    },
    dailyMetrics: Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dailyCalls = Math.floor(Math.random() * 10) + 1;
      return {
        date: date.toISOString().split("T")[0],
        calls: dailyCalls,
        completed: Math.floor(dailyCalls * 0.85),
        failed: Math.ceil(dailyCalls * 0.15),
        totalDuration: dailyCalls * 180,
      };
    }),
    sourceBreakdown: {
      web: Math.floor(totalCalls * 0.6),
      twilio: Math.floor(totalCalls * 0.25),
      whatsapp: Math.floor(totalCalls * 0.15),
    },
    aiProviderBreakdown: {
      OPENAI: Math.floor(totalCalls * 0.7),
      GEMINI: Math.floor(totalCalls * 0.3),
    },
    statusBreakdown: {
      completed: completedCalls,
      failed: failedCalls,
    },
  };
}
