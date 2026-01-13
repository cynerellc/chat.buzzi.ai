# Call Feature Architecture

## Document Purpose

This document provides the complete technical architecture, system design patterns, and implementation specifications for integrating voice call features into the chat.buzzi.ai multi-tenant SaaS platform. It serves as the technical reference for developers implementing the call feature.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Principles](#core-principles)
3. [System Components](#system-components)
4. [File Organization](#file-organization)
5. [API Route Patterns](#api-route-patterns)
6. [Real-Time Architecture](#real-time-architecture)
7. [Multi-Tenancy & Security](#multi-tenancy--security)
8. [Audio Flow Diagrams](#audio-flow-diagrams)
9. [Voice Activity Detection (VAD)](#voice-activity-detection-vad)
10. [User Interruption Handling](#user-interruption-handling)
11. [Silence Detection & Timeout](#silence-detection--timeout)
12. [Transcript Generation](#transcript-generation)
13. [Error Handling & Recovery](#error-handling--recovery)
14. [Performance Optimization](#performance-optimization)
15. [Monitoring & Observability](#monitoring--observability)
16. [Scalability Considerations](#scalability-considerations)
17. [Critical Implementation Files](#critical-implementation-files)
18. [Code Porting Strategy](#code-porting-strategy)

---

## Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Web Widget          WhatsApp App           Twilio Phone                │
│  (Browser)           (Mobile)               (PSTN)                       │
│     │                    │                      │                        │
│     │ WebSocket          │ WebRTC               │ TwiML/WebSocket       │
│     ▼                    ▼                      ▼                        │
├─────────────────────────────────────────────────────────────────────────┤
│                        INTEGRATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  WebSocketHandler    WhatsAppHandler        TwilioHandler               │
│  - Audio I/O         - WebRTC signaling     - TwiML generation          │
│  - Client events     - SDP negotiation      - Stream handling           │
│  - Base64 codec      - Opus codec           - PCMU codec                │
│     │                    │                      │                        │
│     └────────────────────┴──────────────────────┘                       │
│                            │                                             │
│                            ▼                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                      ORCHESTRATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                    CallRunnerService                                     │
│  - Executor caching (LRU, 3-hour TTL)                                   │
│  - Session lifecycle management                                          │
│  - Audio routing                                                         │
│  - Error handling                                                        │
│                            │                                             │
│                            ▼                                             │
│                    CallSessionManager                                    │
│  - Active session tracking                                              │
│  - Timeout monitoring                                                    │
│  - Database persistence                                                  │
│                            │                                             │
│                            ▼                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                       EXECUTION LAYER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│           CallExecutor (Abstract)                                        │
│                 │           │                                            │
│      ┌──────────┴─────┬─────┴──────────┐                               │
│      ▼                ▼                 ▼                               │
│  OpenAIRealtime   GeminiLive      [Future Providers]                    │
│  - WebSocket      - WebSocket                                           │
│  - PCM16 24kHz    - PCM16 16kHz                                         │
│  - Server VAD     - Streaming                                           │
│  - Functions      - Functions                                           │
│      │                │                                                  │
│      └────────────────┴────────────────────┐                            │
│                                             ▼                            │
├─────────────────────────────────────────────────────────────────────────┤
│                         AI PROVIDER LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│  OpenAI Realtime API      Google Gemini Live API                        │
│  wss://api.openai.com     Gemini SDK WebSocket                          │
└─────────────────────────────────────────────────────────────────────────┘

                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (chatapp schema)                                            │
│  - integration_accounts  - calls  - call_transcripts                    │
│  - chatbots (settings)   - companies (settings)                         │
│                                                                          │
│  Supabase Storage / S3                                                  │
│  - Call recordings (audio files)                                        │
│                                                                          │
│  Redis (Optional)                                                       │
│  - Session state caching                                                │
│  - Rate limiting                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**Call Initiation (Web Widget)**:
```
1. User clicks call button
2. Widget requests microphone permission
3. Widget → POST /api/widget/call/session
4. Server creates call session, returns sessionId and WebSocket URL
5. Widget establishes WebSocket connection
6. Server instantiates WebSocketCallHandler
7. Server loads CallExecutor from cache or creates new
8. Server connects executor to OpenAI Realtime API
9. OpenAI sends session.created event
10. Server starts audio streaming loop
```

**Audio Streaming Loop**:
```
Client → WebSocket message {type: "audio", data: base64PCM}
  → WebSocketCallHandler.handleAudio()
  → CallRunnerService.sendAudio(sessionId, audioBuffer)
  → CallExecutor.sendAudio(audioBuffer)
  → OpenAI Realtime WebSocket (input_audio_buffer.append)
  → [AI Processing with VAD, transcription, response generation]
  → OpenAI sends response.audio.delta events
  → CallExecutor.onAudioDelta(audioData)
  → WebSocketCallHandler.sendAudio(audioData)
  → WebSocket message {type: "audio", data: base64PCM}
  → Client decodes and plays audio
```

**Call Termination**:
```
User ends call OR silence timeout OR max duration
  → CallRunnerService.endCall(sessionId, reason)
  → CallExecutor.disconnect()
  → Close OpenAI WebSocket connection
  → CallSessionManager.endSession(sessionId)
  → Update calls table (status='completed', duration, ended_at)
  → Save final transcript to call_transcripts table
  → Optional: Upload recording to storage
  → Close client WebSocket connection
  → Clean up in-memory state
```

### Integration with Existing Systems

The call feature integrates with existing chat.buzzi.ai infrastructure:

- **Authentication**: Uses existing NextAuth.js session management (requireAuth, requireCompanyAdmin guards)
- **Multi-tenancy**: Leverages existing company_permissions and active_company_id cookie pattern
- **Database**: Uses existing Drizzle ORM setup with chatapp schema
- **Real-time**: Extends existing SSE Manager for broadcasting call events
- **Knowledge Base**: Reuses existing RAG service (RagService) for knowledge base access during calls
- **Chatbot Configuration**: Extends existing chatbots table settings JSONB with call-specific config
- **UI Components**: Follows existing Radix UI + Tailwind CSS patterns
- **API Routes**: Follows existing Next.js App Router API structure

**Shared vs. Separate Components**:

| Component | Shared | Call-Specific | Notes |
|-----------|--------|---------------|-------|
| Database Schema | ✓ | ✓ | Extends existing tables + new call tables |
| Auth Guards | ✓ | | Reuse requireCompanyAdmin() etc. |
| Real-time Infra | ✓ | ✓ | SSE for events, WebSocket for audio |
| Agent Framework | | ✓ | CallRunnerService parallels AgentRunnerService |
| Knowledge Base | ✓ | | Same RagService for both chat and call |
| UI Components | ✓ | ✓ | Shared patterns, call-specific widgets |
| API Routes | | ✓ | New /api/widget/call/* routes |

---

## Core Principles

### 1. Pattern Reuse

**Follow Existing Patterns**: The call feature mirrors the architecture of the existing chat feature wherever possible.

- **CallRunnerService** parallels **AgentRunnerService**:
  - Both use executor caching (LRU, 3-hour TTL)
  - Both manage session lifecycle
  - Both handle error recovery
  - Similar method signatures (loadExecutor, createSession, execute/sendAudio, endSession/endCall)

- **CallExecutor** parallels **AdkExecutor**:
  - Both abstract AI provider connections
  - Both handle tool/function calling
  - Both manage streaming responses
  - Similar event emitters (response, transcript, error)

**Example Parallel**:
```typescript
// Chat: AgentRunnerService
class AgentRunnerService {
  async loadExecutor(chatbotId: string): Promise<AdkExecutor> { }
  async createSession(params): Promise<ConversationSession> { }
  async sendMessage(sessionId, message): Promise<void> { }
  async endSession(sessionId): Promise<void> { }
}

// Call: CallRunnerService (mirrors above)
class CallRunnerService {
  async loadExecutor(chatbotId: string): Promise<CallExecutor> { }
  async createSession(params): Promise<CallSession> { }
  async sendAudio(sessionId, audioBuffer): Promise<void> { }
  async endCall(sessionId, reason): Promise<void> { }
}
```

### 2. Clean Separation

**Isolated Call Logic**: All call-specific code lives in `/src/lib/call/` namespace.

- **No pollution of chat code**: Chat and call features are completely decoupled
- **Conditional feature checks**: UI components check `enabledCall` and `enabledChat` flags to show/hide features
- **Separate API routes**: Call routes under `/api/widget/call/*`, separate from chat `/api/widget/*`
- **Separate database tables**: `calls` and `call_transcripts` tables, not mixed with `conversations` and `messages`

**Benefit**: Features can be developed, tested, and deployed independently. Easier to maintain and extend.

### 3. Shared Infrastructure

**Leverage Existing Systems**: Reuse multi-tenancy, auth, database, and real-time infrastructure.

- **Multi-tenancy**: All call queries filter by `company_id` (same as chat)
- **Authorization**: Use existing auth guards (requireAuth, requireCompanyAdmin)
- **Database**: Extend existing Drizzle schema with new call tables
- **Real-time**: Use existing SSE Manager for broadcasting call events

**Benefit**: No need to rebuild infrastructure. Consistent security and performance patterns.

### 4. Provider Abstraction

**Support Multiple AI Providers**: Design for extensibility beyond OpenAI.

- **BaseProvider interface**: Abstract common operations (connect, sendAudio, cancelResponse, disconnect)
- **Provider implementations**: OpenAIRealtimeProvider, GeminiLiveProvider, [future providers]
- **Provider factory**: Instantiate correct provider based on chatbot's AI model configuration
- **Unified events**: All providers emit same event types (audioDelta, transcriptDelta, agentSpeaking, error)

**Example**:
```typescript
// Abstract base provider
abstract class BaseProvider {
  abstract connect(): Promise<void>;
  abstract sendAudio(audioData: Buffer): Promise<void>;
  abstract cancelResponse(): Promise<void>;
  abstract disconnect(): Promise<void>;

  // Event emitters (common across providers)
  on(event: 'audioDelta', handler: (data: Buffer) => void): void;
  on(event: 'transcriptDelta', handler: (text: string) => void): void;
  on(event: 'agentSpeaking', handler: (isSpeaking: boolean) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}

// Concrete implementations
class OpenAIRealtimeProvider extends BaseProvider { }
class GeminiLiveProvider extends BaseProvider { }
```

**Benefit**: Easy to add new providers (Anthropic, ElevenLabs, etc.) without changing core call logic.

### 5. Integration Flexibility

**Pluggable Integration Adapters**: Support multiple call sources (Web, WhatsApp, Twilio).

- **BaseCallHandler interface**: Abstract connection management and audio I/O
- **Handler implementations**: WebSocketCallHandler, WhatsAppCallHandler, TwilioCallHandler
- **Codec abstraction**: Each handler handles its own audio format conversion
- **Event-driven**: Handlers emit events (audioReceived, callEnded, error) for decoupling

**Example**:
```typescript
// Abstract base handler
abstract class BaseCallHandler {
  abstract start(): Promise<void>;
  abstract handleAudio(audioData: Buffer): Promise<void>;
  abstract sendAudio(audioData: Buffer): Promise<void>;
  abstract end(reason?: string): Promise<void>;

  // Event emitters
  on(event: 'audioReceived', handler: (data: Buffer) => void): void;
  on(event: 'callEnded', handler: (reason?: string) => void): void;
}

// Concrete implementations
class WebSocketCallHandler extends BaseCallHandler { }
class WhatsAppCallHandler extends BaseCallHandler { }
class TwilioCallHandler extends BaseCallHandler { }
```

**Benefit**: Easy to add new integration types (Zoom, custom SIP, etc.) without changing core call logic.

### 6. Hybrid Code Strategy

**Port Core Logic, Rewrite Infrastructure**: Leverage proven patterns from voice.buzzi.ai while matching chat.buzzi.ai architecture.

**Port from voice.buzzi.ai**:
- Audio conversion utilities (codec conversion, resampling, encoding)
- OpenAI Realtime WebSocket connection logic
- VAD configuration and event handling
- WebRTC signaling logic for WhatsApp
- Twilio TwiML generation and stream handling

**Rewrite for chat.buzzi.ai**:
- CallRunnerService (to match AgentRunnerService pattern)
- Database schema (to match multi-tenant schema)
- API routes (to match Next.js App Router)
- UI components (to match Radix UI + Tailwind CSS)
- Authorization (to match NextAuth.js + permission guards)

**Benefit**: Faster development (reuse proven logic) + consistent architecture (match existing patterns).

---

## System Components

### CallRunnerService

**Purpose**: Central orchestration service for all call operations. Parallel to AgentRunnerService for chat.

**Location**: `/src/lib/call/execution/call-runner.ts`

**Responsibilities**:
1. **Executor Caching**: Load and cache CallExecutor instances (LRU cache, 3-hour TTL)
2. **Session Management**: Create and track call sessions via CallSessionManager
3. **Provider Connection**: Connect executors to AI providers (OpenAI, Gemini)
4. **Audio Routing**: Route audio between client handlers and provider executors
5. **Lifecycle Management**: Handle session start, active, ending, ended states
6. **Error Handling**: Retry logic, fallbacks, graceful degradation

**Class Structure**:
```typescript
export class CallRunnerService {
  private static instance: CallRunnerService;
  private executorCache: LRUCache<string, CallExecutor>;
  private sessionManager: CallSessionManager;

  // Singleton accessor
  public static getInstance(): CallRunnerService {
    if (!CallRunnerService.instance) {
      CallRunnerService.instance = new CallRunnerService();
    }
    return CallRunnerService.instance;
  }

  // Load executor (with caching)
  async loadExecutor(chatbotId: string): Promise<CallExecutor> {
    // Check cache first
    if (this.executorCache.has(chatbotId)) {
      return this.executorCache.get(chatbotId)!;
    }

    // Load chatbot config from database
    const chatbot = await db.query.chatbots.findFirst({
      where: eq(chatbots.id, chatbotId),
      with: { aiModel: true, company: true }
    });

    if (!chatbot || !chatbot.enabled_call) {
      throw new Error('Chatbot not found or call not enabled');
    }

    // Create executor instance based on AI model
    const executor = await this.createExecutor(chatbot);

    // Cache executor (3-hour TTL)
    this.executorCache.set(chatbotId, executor, 3 * 60 * 60 * 1000);

    return executor;
  }

  // Create new call session
  async createSession(params: CreateCallSessionParams): Promise<CallSession> {
    const { chatbotId, companyId, endUserId, source, fromNumber, toNumber } = params;

    // Validate chatbot and permissions
    await this.validateChatbot(chatbotId, companyId);

    // Create session in database
    const sessionId = crypto.randomUUID();
    const callId = crypto.randomUUID();

    const callRecord = await db.insert(calls).values({
      id: callId,
      company_id: companyId,
      chatbot_id: chatbotId,
      end_user_id: endUserId,
      source,
      from_number: fromNumber,
      to_number: toNumber,
      status: 'pending',
      started_at: new Date()
    }).returning();

    // Register session in memory
    const session = await this.sessionManager.createSession({
      sessionId,
      callId,
      chatbotId,
      companyId,
      status: 'created'
    });

    return session;
  }

  // Start call (connect to AI provider)
  async startCall(sessionId: string, handler: BaseCallHandler): Promise<void> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Load executor
    const executor = await this.loadExecutor(session.chatbotId);

    // Connect to AI provider
    await executor.connect();

    // Set up audio routing: handler → executor → provider
    handler.on('audioReceived', async (audioData) => {
      await executor.sendAudio(audioData);
    });

    // Set up audio routing: provider → executor → handler
    executor.on('audioDelta', async (audioData) => {
      await handler.sendAudio(audioData);
    });

    // Set up transcript routing
    executor.on('transcriptDelta', async (transcript) => {
      await this.saveTranscript(session.callId, transcript);
      // Broadcast transcript via SSE
      await sseManager.send(getCallChannel(session.callId), {
        type: 'transcript',
        data: transcript
      });
    });

    // Update session status
    await this.sessionManager.updateSessionStatus(sessionId, 'active');
    await db.update(calls)
      .set({ status: 'in_progress', answered_at: new Date() })
      .where(eq(calls.id, session.callId));
  }

  // Send audio to AI provider
  async sendAudio(sessionId: string, audioData: Buffer): Promise<void> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Session not active');
    }

    const executor = await this.loadExecutor(session.chatbotId);
    await executor.sendAudio(audioData);

    // Update last activity time (for timeout tracking)
    await this.sessionManager.updateLastActivity(sessionId);
  }

  // End call
  async endCall(sessionId: string, reason?: string): Promise<void> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Disconnect executor from provider
    const executor = await this.loadExecutor(session.chatbotId);
    await executor.disconnect();

    // Calculate duration
    const duration = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

    // Update database
    await db.update(calls)
      .set({
        status: 'completed',
        duration,
        ended_at: new Date(),
        ...(reason && { notes: `End reason: ${reason}` })
      })
      .where(eq(calls.id, session.callId));

    // End session
    await this.sessionManager.endSession(sessionId);

    // Broadcast call ended event
    await sseManager.send(getCallChannel(session.callId), {
      type: 'call_ended',
      data: { reason, duration }
    });
  }

  // Private helper methods
  private async createExecutor(chatbot: Chatbot): Promise<CallExecutor> {
    const providerType = this.getProviderType(chatbot.aiModel.provider);

    switch (providerType) {
      case 'openai':
        return new OpenAIRealtimeExecutor(chatbot);
      case 'gemini':
        return new GeminiLiveExecutor(chatbot);
      default:
        throw new Error(`Unsupported provider: ${providerType}`);
    }
  }

  private async validateChatbot(chatbotId: string, companyId: string): Promise<void> {
    const chatbot = await db.query.chatbots.findFirst({
      where: and(
        eq(chatbots.id, chatbotId),
        eq(chatbots.company_id, companyId),
        isNull(chatbots.deleted_at)
      )
    });

    if (!chatbot) {
      throw new Error('Chatbot not found');
    }

    if (!chatbot.enabled_call) {
      throw new Error('Call feature not enabled for this chatbot');
    }
  }

  private async saveTranscript(callId: string, transcript: TranscriptData): Promise<void> {
    await db.insert(callTranscripts).values({
      call_id: callId,
      role: transcript.role,
      content: transcript.content,
      start_time: transcript.startTime,
      end_time: transcript.endTime,
      confidence: transcript.confidence
    });
  }
}
```

**Caching Strategy**:
- Use LRU cache from `lru-cache` npm package
- Key: `chatbotId` (string)
- Value: `CallExecutor` instance
- TTL: 3 hours (10,800,000 ms)
- Max size: 1000 entries
- Eviction: Least recently used (LRU)

**Why Caching?**:
- Executors are expensive to create (load chatbot config, knowledge base, tools)
- Multiple calls can reuse same executor if chatbot config hasn't changed
- Reduces database queries and initialization overhead
- Matches existing AgentRunnerService pattern for consistency

**Cache Invalidation**:
- Automatic after 3-hour TTL
- Manual invalidation when chatbot settings change (via cache.delete(chatbotId))
- Periodic cleanup job (every hour, remove expired entries)

---

### CallExecutor

**Purpose**: Execute call interactions with AI provider. Abstract base class with provider-specific implementations.

**Location**: `/src/lib/call/execution/call-executor.ts` (base), `/src/lib/call/providers/openai-realtime.ts`, `/src/lib/call/providers/gemini-live.ts`

**Responsibilities**:
1. **Provider Connection**: Establish and maintain WebSocket connection to AI provider
2. **Audio Transmission**: Send audio chunks to provider
3. **Response Handling**: Receive and process audio responses
4. **Transcription**: Handle real-time transcription events
5. **Function Calling**: Execute tool calls during conversations
6. **State Management**: Track session state and conversation context

**Base Class**:
```typescript
// Abstract base class
export abstract class CallExecutor extends EventEmitter {
  protected chatbot: Chatbot;
  protected sessionConfig: SessionConfig;
  protected isConnected: boolean = false;

  constructor(chatbot: Chatbot) {
    super();
    this.chatbot = chatbot;
    this.sessionConfig = this.buildSessionConfig();
  }

  // Abstract methods (must be implemented by subclasses)
  abstract connect(): Promise<void>;
  abstract sendAudio(audioData: Buffer): Promise<void>;
  abstract cancelResponse(): Promise<void>;
  abstract disconnect(): Promise<void>;

  // Common methods
  protected buildSessionConfig(): SessionConfig {
    const callSettings = this.chatbot.settings.call;

    return {
      voiceId: callSettings.voiceId,
      systemPrompt: this.buildSystemPrompt(),
      tools: this.buildTools(),
      temperature: this.chatbot.aiModel.temperature,
      maxDuration: callSettings.maxCallDuration,
      silenceTimeout: callSettings.silenceTimeout,
      vadThreshold: callSettings.vadThreshold || 0.5,
      interruptionEnabled: callSettings.interruptionEnabled ?? true
    };
  }

  protected buildSystemPrompt(): string {
    // Combine chatbot personality + knowledge base instructions + call-specific instructions
    let prompt = this.chatbot.systemPrompt || '';

    // Add call-specific instructions
    prompt += `\n\nYou are in a voice conversation. Keep responses concise and natural for voice.`;

    if (this.chatbot.settings.call.endCallPhrase) {
      prompt += `\nIf the user says "${this.chatbot.settings.call.endCallPhrase}", end the conversation politely.`;
    }

    return prompt;
  }

  protected buildTools(): Tool[] {
    // Load knowledge base search tools, custom functions, etc.
    // Reuse existing tool loading from chat agents
    const tools: Tool[] = [];

    // Knowledge base search tool
    if (this.chatbot.knowledgeCategories?.length > 0) {
      tools.push(createKnowledgeSearchTool(this.chatbot.knowledgeCategories));
    }

    // Custom function calling tools (if configured)
    // ... add other tools

    return tools;
  }

  // Event emitters (subclasses call these)
  protected emitAudioDelta(audioData: Buffer): void {
    this.emit('audioDelta', audioData);
  }

  protected emitTranscriptDelta(transcript: TranscriptData): void {
    this.emit('transcriptDelta', transcript);
  }

  protected emitAgentSpeaking(isSpeaking: boolean): void {
    this.emit('agentSpeaking', isSpeaking);
  }

  protected emitError(error: Error): void {
    this.emit('error', error);
  }
}
```

**OpenAI Realtime Implementation**:
```typescript
export class OpenAIRealtimeExecutor extends CallExecutor {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private responseInProgress: boolean = false;

  async connect(): Promise<void> {
    const apiKey = this.chatbot.company.openaiApiKey || process.env.OPENAI_API_KEY;
    const model = this.chatbot.aiModel.modelId; // e.g., 'gpt-4o-realtime-preview-2024-10-01'

    // WebSocket connection to OpenAI Realtime API
    this.ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${model}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    // Set up event handlers
    this.ws.on('open', () => {
      this.isConnected = true;
      this.sendSessionUpdate();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleServerEvent(JSON.parse(data.toString()));
    });

    this.ws.on('error', (error) => {
      this.emitError(error);
    });

    this.ws.on('close', () => {
      this.isConnected = false;
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      this.ws!.once('open', resolve);
      this.ws!.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }

  private sendSessionUpdate(): void {
    // Configure session with voice, tools, VAD settings
    this.ws!.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.sessionConfig.systemPrompt,
        voice: this.sessionConfig.voiceId,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: this.sessionConfig.vadThreshold,
          prefix_padding_ms: 300,
          silence_duration_ms: 700
        },
        tools: this.sessionConfig.tools.map(tool => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        })),
        tool_choice: 'auto',
        temperature: this.sessionConfig.temperature
      }
    }));
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    // Convert Buffer to base64
    const base64Audio = audioData.toString('base64');

    // Send audio chunk
    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    }));
  }

  async cancelResponse(): Promise<void> {
    if (!this.ws || !this.responseInProgress) return;

    // Cancel in-progress response (for interruption)
    this.ws.send(JSON.stringify({
      type: 'response.cancel'
    }));

    this.responseInProgress = false;
    this.emitAgentSpeaking(false);
  }

  private handleServerEvent(event: any): void {
    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session.id;
        break;

      case 'session.updated':
        // Session configuration updated
        break;

      case 'input_audio_buffer.speech_started':
        // User started speaking
        // If agent is currently speaking, trigger interruption
        if (this.responseInProgress && this.sessionConfig.interruptionEnabled) {
          this.cancelResponse();
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        // User stopped speaking (VAD detected silence)
        // OpenAI will automatically trigger response generation
        break;

      case 'response.created':
        this.responseInProgress = true;
        this.emitAgentSpeaking(true);
        break;

      case 'response.audio.delta':
        // Incremental audio response
        const audioBuffer = Buffer.from(event.delta, 'base64');
        this.emitAudioDelta(audioBuffer);
        break;

      case 'response.audio.done':
        // Audio response complete
        this.responseInProgress = false;
        this.emitAgentSpeaking(false);
        break;

      case 'response.audio_transcript.delta':
        // Partial transcript of agent's speech
        this.emitTranscriptDelta({
          role: 'assistant',
          content: event.delta,
          startTime: event.content_index * 100, // Estimate
          confidence: 1.0
        });
        break;

      case 'response.audio_transcript.done':
        // Final transcript of agent's speech
        this.emitTranscriptDelta({
          role: 'assistant',
          content: event.transcript,
          startTime: event.content_index * 100,
          endTime: Date.now(),
          confidence: 1.0
        });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcript (from Whisper)
        this.emitTranscriptDelta({
          role: 'user',
          content: event.transcript,
          startTime: event.content_index * 100,
          endTime: Date.now(),
          confidence: 1.0
        });
        break;

      case 'response.function_call_arguments.done':
        // Function call requested by agent
        this.handleFunctionCall(event);
        break;

      case 'error':
        this.emitError(new Error(`OpenAI error: ${event.error.message}`));
        break;
    }
  }

  private async handleFunctionCall(event: any): Promise<void> {
    const { call_id, name, arguments: argsJson } = event;

    try {
      // Parse function arguments
      const args = JSON.parse(argsJson);

      // Execute function (e.g., knowledge base search)
      const result = await this.executeFunction(name, args);

      // Send function result back to OpenAI
      this.ws!.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify(result)
        }
      }));

      // Trigger response generation with function result
      this.ws!.send(JSON.stringify({
        type: 'response.create'
      }));

    } catch (error) {
      // Send error to OpenAI
      this.ws!.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify({ error: error.message })
        }
      }));
    }
  }

  private async executeFunction(name: string, args: any): Promise<any> {
    // Execute tool based on name
    switch (name) {
      case 'search_knowledge_base':
        return await this.searchKnowledgeBase(args.query);

      // Add other function handlers

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  private async searchKnowledgeBase(query: string): Promise<any> {
    // Use existing RagService
    const ragService = new RagService();
    const results = await ragService.search({
      query,
      companyId: this.chatbot.company_id,
      categoryIds: this.chatbot.knowledgeCategories.map(c => c.id),
      limit: 5
    });

    return {
      results: results.map(r => ({
        content: r.content,
        source: r.source,
        score: r.score
      }))
    };
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}
```

**Gemini Live Implementation**:
```typescript
export class GeminiLiveExecutor extends CallExecutor {
  private client: any; // Gemini SDK client
  private session: any;

  async connect(): Promise<void> {
    // Connect to Gemini Live API via SDK
    // Similar structure to OpenAI, but using Gemini SDK methods
    // Handle Gemini-specific audio format (16kHz requires resampling)
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    // Resample from 24kHz to 16kHz for Gemini
    const resampledAudio = await resampleAudio(audioData, 24000, 16000);

    // Send to Gemini
    await this.session.sendAudio(resampledAudio);
  }

  // ... implement other methods
}
```

---

### CallSessionManager

**Purpose**: Track active call sessions and handle lifecycle management.

**Location**: `/src/lib/call/execution/session-manager.ts`

**Responsibilities**:
1. **Session Registration**: Track active sessions in memory
2. **Session Retrieval**: Get session by ID
3. **Status Updates**: Update session status (created, active, ending, ended)
4. **Timeout Monitoring**: Detect and handle silence timeouts and max duration
5. **Cleanup**: Remove ended sessions from memory

**Class Structure**:
```typescript
export interface CallSession {
  sessionId: string;
  callId: string;
  chatbotId: string;
  companyId: string;
  status: 'created' | 'active' | 'ending' | 'ended';
  startedAt: Date;
  lastActivityAt: Date;
  handler: BaseCallHandler | null;
  executor: CallExecutor | null;
}

export class CallSessionManager {
  private static instance: CallSessionManager;
  private sessions: Map<string, CallSession> = new Map();
  private timeoutCheckInterval: NodeJS.Timeout | null = null;

  public static getInstance(): CallSessionManager {
    if (!CallSessionManager.instance) {
      CallSessionManager.instance = new CallSessionManager();
      CallSessionManager.instance.startTimeoutMonitoring();
    }
    return CallSessionManager.instance;
  }

  async createSession(params: CreateSessionParams): Promise<CallSession> {
    const session: CallSession = {
      sessionId: params.sessionId,
      callId: params.callId,
      chatbotId: params.chatbotId,
      companyId: params.companyId,
      status: 'created',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      handler: null,
      executor: null
    };

    this.sessions.set(params.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<CallSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSessionStatus(sessionId: string, status: CallSession['status']): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
    }
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();
    }
  }

  async attachHandler(sessionId: string, handler: BaseCallHandler): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.handler = handler;
    }
  }

  async attachExecutor(sessionId: string, executor: CallExecutor): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.executor = executor;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';

      // Clean up after 5 minutes (allow time for final events)
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 5 * 60 * 1000);
    }
  }

  // Timeout monitoring
  private startTimeoutMonitoring(): void {
    // Check every 10 seconds for timed-out sessions
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts();
    }, 10000);
  }

  private async checkTimeouts(): Promise<void> {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status !== 'active') continue;

      // Load chatbot settings to get timeout values
      const chatbot = await db.query.chatbots.findFirst({
        where: eq(chatbots.id, session.chatbotId)
      });

      if (!chatbot) continue;

      const silenceTimeout = chatbot.settings.call.silenceTimeout || 180; // seconds
      const maxDuration = chatbot.settings.call.maxCallDuration || 3600; // seconds

      // Check silence timeout
      const silenceDuration = (now - session.lastActivityAt.getTime()) / 1000;
      if (silenceDuration > silenceTimeout) {
        await this.handleTimeout(sessionId, 'silence_timeout');
        continue;
      }

      // Check max duration
      const callDuration = (now - session.startedAt.getTime()) / 1000;
      if (callDuration > maxDuration) {
        await this.handleTimeout(sessionId, 'max_duration');
      }
    }
  }

  private async handleTimeout(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // End call via CallRunnerService
    const callRunner = CallRunnerService.getInstance();
    await callRunner.endCall(sessionId, reason);
  }

  // Get active session count (for monitoring)
  getActiveSessionCount(): number {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active')
      .length;
  }

  // Get all sessions (for debugging)
  getAllSessions(): CallSession[] {
    return Array.from(this.sessions.values());
  }
}
```

---

### Call Handlers

**Purpose**: Handle different connection types (Web, WhatsApp, Twilio) and manage client-side audio streaming.

**Location**: `/src/lib/call/handlers/base-handler.ts` (abstract), `/src/lib/call/handlers/websocket-handler.ts`, `/src/lib/call/handlers/whatsapp-handler.ts`, `/src/lib/call/handlers/twilio-handler.ts`

**Base Class**:
```typescript
export abstract class BaseCallHandler extends EventEmitter {
  protected sessionId: string;
  protected callId: string;

  constructor(sessionId: string, callId: string) {
    super();
    this.sessionId = sessionId;
    this.callId = callId;
  }

  // Abstract methods (must be implemented by subclasses)
  abstract start(): Promise<void>;
  abstract handleAudio(audioData: Buffer): Promise<void>;
  abstract sendAudio(audioData: Buffer): Promise<void>;
  abstract end(reason?: string): Promise<void>;

  // Event emitters (subclasses call these)
  protected emitAudioReceived(audioData: Buffer): void {
    this.emit('audioReceived', audioData);
  }

  protected emitCallEnded(reason?: string): void {
    this.emit('callEnded', reason);
  }

  protected emitError(error: Error): void {
    this.emit('error', error);
  }
}
```

**WebSocket Handler**:
```typescript
export class WebSocketCallHandler extends BaseCallHandler {
  private ws: WebSocket;

  constructor(sessionId: string, callId: string, ws: WebSocket) {
    super(sessionId, callId);
    this.ws = ws;
  }

  async start(): Promise<void> {
    // Set up WebSocket message handlers
    this.ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(message);
      } catch (error) {
        this.emitError(new Error(`Failed to parse message: ${error.message}`));
      }
    });

    this.ws.on('close', () => {
      this.emitCallEnded('client_disconnected');
    });

    this.ws.on('error', (error) => {
      this.emitError(error);
    });

    // Send connected confirmation
    this.ws.send(JSON.stringify({ type: 'connected', sessionId: this.sessionId }));
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'audio':
        // Decode base64 audio
        const audioBuffer = Buffer.from(message.data, 'base64');
        await this.handleAudio(audioBuffer);
        break;

      case 'end':
        await this.end('user_ended');
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  async handleAudio(audioData: Buffer): Promise<void> {
    // Emit to CallRunnerService
    this.emitAudioReceived(audioData);
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Send audio as base64
    this.ws.send(JSON.stringify({
      type: 'audio',
      data: audioData.toString('base64')
    }));
  }

  async end(reason?: string): Promise<void> {
    // Send call ended message
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'call_ended',
        reason
      }));
    }

    // Close WebSocket
    this.ws.close();

    this.emitCallEnded(reason);
  }

  // Send transcript to client
  async sendTranscript(transcript: TranscriptData): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'transcript',
      data: transcript
    }));
  }

  // Send agent speaking status
  async sendAgentSpeaking(isSpeaking: boolean): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'agent_speaking',
      data: { isSpeaking }
    }));
  }
}
```

**WhatsApp Handler**:
```typescript
export class WhatsAppCallHandler extends BaseCallHandler {
  private rtpConnection: RTCPeerConnection;
  private audioTrack: MediaStreamTrack | null = null;

  async start(): Promise<void> {
    // WebRTC connection established via webhook SDP exchange
    // This handler receives already-negotiated connection
  }

  async handleAudio(audioData: Buffer): Promise<void> {
    // Audio received via RTP (Opus codec, 48kHz)

    // Decode Opus to PCM16
    const pcm16 = await audioConverter.opusToPcm16(audioData);

    // Resample 48kHz → 24kHz (for OpenAI Realtime)
    const resampled = await audioResampler.resample(pcm16, 48000, 24000);

    this.emitAudioReceived(resampled);
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    // Audio from OpenAI (PCM16 24kHz)

    // Resample 24kHz → 48kHz
    const resampled = await audioResampler.resample(audioData, 24000, 48000);

    // Encode PCM16 to Opus
    const opus = await audioConverter.pcm16ToOpus(resampled);

    // Send via RTP
    await this.sendRtpPacket(opus);
  }

  private async sendRtpPacket(audioData: Buffer): Promise<void> {
    // Send audio via WebRTC data channel or RTP stream
    // Implementation details depend on WhatsApp WebRTC setup
  }

  async end(reason?: string): Promise<void> {
    // Close RTP connection
    if (this.rtpConnection) {
      this.rtpConnection.close();
    }

    this.emitCallEnded(reason);
  }
}
```

**Twilio Handler**:
```typescript
export class TwilioCallHandler extends BaseCallHandler {
  private streamWs: WebSocket;

  constructor(sessionId: string, callId: string, streamWs: WebSocket) {
    super(sessionId, callId);
    this.streamWs = streamWs;
  }

  async start(): Promise<void> {
    // Set up Twilio stream WebSocket handlers
    this.streamWs.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleTwilioMessage(message);
      } catch (error) {
        this.emitError(new Error(`Failed to parse Twilio message: ${error.message}`));
      }
    });
  }

  private async handleTwilioMessage(message: any): Promise<void> {
    switch (message.event) {
      case 'start':
        // Stream started
        break;

      case 'media':
        // Audio chunk from Twilio (PCMU codec, 8kHz, base64)
        const pcmuBuffer = Buffer.from(message.media.payload, 'base64');
        await this.handleAudio(pcmuBuffer);
        break;

      case 'stop':
        await this.end('twilio_ended');
        break;
    }
  }

  async handleAudio(audioData: Buffer): Promise<void> {
    // Audio from Twilio (PCMU 8kHz)

    // Decode PCMU to PCM16
    const pcm16 = await audioConverter.pcmuToPcm16(audioData);

    // Resample 8kHz → 24kHz (for OpenAI Realtime)
    const resampled = await audioResampler.resample(pcm16, 8000, 24000);

    this.emitAudioReceived(resampled);
  }

  async sendAudio(audioData: Buffer): Promise<void> {
    // Audio from OpenAI (PCM16 24kHz)

    // Resample 24kHz → 8kHz
    const resampled = await audioResampler.resample(audioData, 24000, 8000);

    // Encode PCM16 to PCMU
    const pcmu = await audioConverter.pcm16ToPcmu(resampled);

    // Send to Twilio as base64
    this.streamWs.send(JSON.stringify({
      event: 'media',
      streamSid: this.sessionId,
      media: {
        payload: pcmu.toString('base64')
      }
    }));
  }

  async end(reason?: string): Promise<void> {
    // Close Twilio stream
    if (this.streamWs.readyState === WebSocket.OPEN) {
      this.streamWs.send(JSON.stringify({
        event: 'stop',
        streamSid: this.sessionId
      }));
      this.streamWs.close();
    }

    this.emitCallEnded(reason);
  }
}
```

---

### Audio Processing

**Purpose**: Convert between audio formats and sample rates for different integrations.

**Location**: `/src/lib/call/audio/converter.ts`, `/src/lib/call/audio/resampler.ts`, `/src/lib/call/audio/encoder.ts`, `/src/lib/call/audio/validator.ts`

**Ported from**: voice.buzzi.ai `/src/utils/audio-converter.js`

**Libraries**:
- `@discordjs/opus` - Opus codec encoding/decoding
- `@alexanderolsen/libsamplerate-js` - High-quality sample rate conversion
- Built-in Node.js Buffer for PCM16/PCMU conversion

**Audio Converter**:
```typescript
// /src/lib/call/audio/converter.ts

import { OpusEncoder } from '@discordjs/opus';

export class AudioConverter {
  private static opusEncoder: OpusEncoder | null = null;

  // Initialize Opus encoder (singleton)
  private static getOpusEncoder(): OpusEncoder {
    if (!AudioConverter.opusEncoder) {
      AudioConverter.opusEncoder = new OpusEncoder(48000, 1); // 48kHz, mono
    }
    return AudioConverter.opusEncoder;
  }

  // PCM16 to Opus
  static async pcm16ToOpus(pcm16Buffer: Buffer, sampleRate: number = 48000): Promise<Buffer> {
    const encoder = AudioConverter.getOpusEncoder();

    // Ensure sample rate matches encoder (48kHz)
    if (sampleRate !== 48000) {
      throw new Error('Opus encoder expects 48kHz PCM16. Resample first.');
    }

    // Encode PCM16 to Opus
    const opusBuffer = encoder.encode(pcm16Buffer);
    return Buffer.from(opusBuffer);
  }

  // Opus to PCM16
  static async opusToPcm16(opusBuffer: Buffer): Promise<Buffer> {
    const encoder = AudioConverter.getOpusEncoder();

    // Decode Opus to PCM16
    const pcm16Buffer = encoder.decode(opusBuffer);
    return Buffer.from(pcm16Buffer);
  }

  // PCM16 to PCMU (G.711 μ-law)
  static pcm16ToPcmu(pcm16Buffer: Buffer): Buffer {
    const pcmuBuffer = Buffer.alloc(pcm16Buffer.length / 2);

    for (let i = 0; i < pcm16Buffer.length; i += 2) {
      // Read PCM16 sample (16-bit signed integer, little-endian)
      const pcm16Sample = pcm16Buffer.readInt16LE(i);

      // Convert to PCMU (μ-law algorithm)
      const pcmuSample = AudioConverter.linearToMulaw(pcm16Sample);

      // Write PCMU sample (8-bit)
      pcmuBuffer[i / 2] = pcmuSample;
    }

    return pcmuBuffer;
  }

  // PCMU to PCM16
  static pcmuToPcm16(pcmuBuffer: Buffer): Buffer {
    const pcm16Buffer = Buffer.alloc(pcmuBuffer.length * 2);

    for (let i = 0; i < pcmuBuffer.length; i++) {
      // Read PCMU sample (8-bit)
      const pcmuSample = pcmuBuffer[i];

      // Convert to PCM16 (μ-law to linear)
      const pcm16Sample = AudioConverter.mulawToLinear(pcmuSample);

      // Write PCM16 sample (16-bit signed integer, little-endian)
      pcm16Buffer.writeInt16LE(pcm16Sample, i * 2);
    }

    return pcm16Buffer;
  }

  // μ-law encoding (linear PCM to PCMU)
  private static linearToMulaw(sample: number): number {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;

    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) {
      sample = -sample;
    }

    if (sample > MULAW_MAX) {
      sample = MULAW_MAX;
    }

    sample += MULAW_BIAS;

    let exponent = 7;
    let expMask = 0x4000;
    while ((sample & expMask) === 0 && exponent > 0) {
      exponent--;
      expMask >>= 1;
    }

    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const mulaw = ~(sign | (exponent << 4) | mantissa);

    return mulaw & 0xFF;
  }

  // μ-law decoding (PCMU to linear PCM)
  private static mulawToLinear(mulaw: number): number {
    mulaw = ~mulaw;

    const sign = (mulaw & 0x80) !== 0;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;

    let sample = (mantissa << 3) + 0x84;
    sample <<= exponent;
    sample -= 0x84;

    return sign ? -sample : sample;
  }

  // Float32 to PCM16 (for Web Audio API)
  static float32ToPcm16(float32Array: Float32Array): Buffer {
    const pcm16Buffer = Buffer.alloc(float32Array.length * 2);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp float value to [-1.0, 1.0]
      const clamped = Math.max(-1, Math.min(1, float32Array[i]));

      // Convert to 16-bit signed integer
      const pcm16Sample = Math.floor(clamped * 32767);

      pcm16Buffer.writeInt16LE(pcm16Sample, i * 2);
    }

    return pcm16Buffer;
  }

  // PCM16 to Float32 (for Web Audio API)
  static pcm16ToFloat32(pcm16Buffer: Buffer): Float32Array {
    const float32Array = new Float32Array(pcm16Buffer.length / 2);

    for (let i = 0; i < pcm16Buffer.length; i += 2) {
      const pcm16Sample = pcm16Buffer.readInt16LE(i);
      float32Array[i / 2] = pcm16Sample / 32768.0;
    }

    return float32Array;
  }
}
```

**Audio Resampler**:
```typescript
// /src/lib/call/audio/resampler.ts

import { Resampler } from '@alexanderolsen/libsamplerate-js';

export class AudioResampler {
  // Resample PCM16 audio
  static async resample(
    pcm16Buffer: Buffer,
    inputSampleRate: number,
    outputSampleRate: number
  ): Promise<Buffer> {
    if (inputSampleRate === outputSampleRate) {
      return pcm16Buffer; // No resampling needed
    }

    // Convert PCM16 buffer to Float32Array
    const inputFloat32 = AudioConverter.pcm16ToFloat32(pcm16Buffer);

    // Calculate resampling ratio
    const ratio = outputSampleRate / inputSampleRate;

    // Create resampler (best quality)
    const resampler = new Resampler({
      nChannels: 1, // Mono
      sampleRate: inputSampleRate,
      targetSampleRate: outputSampleRate
    });

    // Resample
    const outputFloat32 = resampler.full(inputFloat32);

    // Convert back to PCM16
    return AudioConverter.float32ToPcm16(outputFloat32);
  }

  // Resample with chunk processing (for streaming)
  static createStreamingResampler(
    inputSampleRate: number,
    outputSampleRate: number
  ): StreamingResampler {
    return new StreamingResampler(inputSampleRate, outputSampleRate);
  }
}

// Streaming resampler for continuous audio
export class StreamingResampler {
  private resampler: Resampler;
  private inputSampleRate: number;
  private outputSampleRate: number;

  constructor(inputSampleRate: number, outputSampleRate: number) {
    this.inputSampleRate = inputSampleRate;
    this.outputSampleRate = outputSampleRate;

    this.resampler = new Resampler({
      nChannels: 1,
      sampleRate: inputSampleRate,
      targetSampleRate: outputSampleRate
    });
  }

  // Process single chunk
  processChunk(pcm16Chunk: Buffer): Buffer {
    if (this.inputSampleRate === this.outputSampleRate) {
      return pcm16Chunk;
    }

    const inputFloat32 = AudioConverter.pcm16ToFloat32(pcm16Chunk);
    const outputFloat32 = this.resampler.simple(inputFloat32);
    return AudioConverter.float32ToPcm16(outputFloat32);
  }

  // Flush remaining samples
  flush(): Buffer {
    const outputFloat32 = this.resampler.flush();
    return AudioConverter.float32ToPcm16(outputFloat32);
  }
}
```

**Audio Encoder** (Base64):
```typescript
// /src/lib/call/audio/encoder.ts

export class AudioEncoder {
  // Encode buffer to base64
  static encode(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  // Decode base64 to buffer
  static decode(base64String: string): Buffer {
    return Buffer.from(base64String, 'base64');
  }

  // Encode buffer to base64 URL-safe
  static encodeUrlSafe(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Decode base64 URL-safe to buffer
  static decodeUrlSafe(base64String: string): Buffer {
    // Add padding if needed
    while (base64String.length % 4 !== 0) {
      base64String += '=';
    }

    // Replace URL-safe characters
    const base64 = base64String
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    return Buffer.from(base64, 'base64');
  }
}
```

**Audio Validator**:
```typescript
// /src/lib/call/audio/validator.ts

export class AudioValidator {
  // Validate PCM16 buffer
  static validatePcm16(buffer: Buffer, sampleRate: number): ValidationResult {
    const errors: string[] = [];

    // Check buffer length (must be even for 16-bit samples)
    if (buffer.length % 2 !== 0) {
      errors.push('PCM16 buffer length must be even');
    }

    // Check sample rate
    const validSampleRates = [8000, 16000, 24000, 48000];
    if (!validSampleRates.includes(sampleRate)) {
      errors.push(`Invalid sample rate: ${sampleRate}. Must be one of: ${validSampleRates.join(', ')}`);
    }

    // Check buffer size (should be multiple of frame size)
    const frameDuration = 20; // ms
    const bytesPerFrame = (sampleRate * frameDuration / 1000) * 2; // 2 bytes per sample
    if (buffer.length % bytesPerFrame !== 0) {
      errors.push(`Buffer size ${buffer.length} is not a multiple of frame size ${bytesPerFrame}`);
    }

    // Check for silence (all zeros)
    const isSilent = buffer.every(byte => byte === 0);
    if (isSilent) {
      errors.push('Buffer contains only silence (all zeros)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate audio chunk size
  static validateChunkSize(buffer: Buffer, expectedChunkMs: number, sampleRate: number): boolean {
    const expectedBytes = (sampleRate * expectedChunkMs / 1000) * 2; // PCM16 = 2 bytes per sample
    return buffer.length === expectedBytes;
  }

  // Detect clipping
  static detectClipping(pcm16Buffer: Buffer, threshold: number = 32000): boolean {
    for (let i = 0; i < pcm16Buffer.length; i += 2) {
      const sample = Math.abs(pcm16Buffer.readInt16LE(i));
      if (sample >= threshold) {
        return true;
      }
    }
    return false;
  }

  // Calculate RMS (root mean square) level
  static calculateRms(pcm16Buffer: Buffer): number {
    let sumSquares = 0;
    const sampleCount = pcm16Buffer.length / 2;

    for (let i = 0; i < pcm16Buffer.length; i += 2) {
      const sample = pcm16Buffer.readInt16LE(i);
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

---

## File Organization

Complete directory structure for call feature:

```
/src/lib/call/
├── execution/
│   ├── call-runner.ts          # CallRunnerService (central orchestration)
│   ├── call-executor.ts        # Abstract CallExecutor base class
│   ├── session-manager.ts      # CallSessionManager (track active sessions)
│   └── index.ts                # Exports
│
├── handlers/
│   ├── base-handler.ts         # Abstract BaseCallHandler
│   ├── websocket-handler.ts    # WebSocketCallHandler (browser)
│   ├── whatsapp-handler.ts     # WhatsAppCallHandler (WebRTC)
│   ├── twilio-handler.ts       # TwilioCallHandler (TwiML/SIP)
│   └── index.ts                # Exports
│
├── providers/
│   ├── base-provider.ts        # Abstract BaseProvider interface
│   ├── openai-realtime.ts      # OpenAIRealtimeProvider
│   ├── gemini-live.ts          # GeminiLiveProvider
│   ├── provider-factory.ts     # Factory for instantiating providers
│   └── index.ts                # Exports
│
├── audio/
│   ├── converter.ts            # AudioConverter (codec conversion)
│   ├── resampler.ts            # AudioResampler (sample rate conversion)
│   ├── encoder.ts              # AudioEncoder (base64 encoding)
│   ├── validator.ts            # AudioValidator (validation, RMS, clipping)
│   └── index.ts                # Exports
│
├── integrations/
│   ├── integration-manager.ts  # IntegrationManager (CRUD for accounts)
│   ├── whatsapp-client.ts      # WhatsApp Business API client
│   ├── twilio-client.ts        # Twilio API client
│   ├── webrtc-signaling.ts     # WebRTC SDP negotiation
│   └── index.ts                # Exports
│
├── types.ts                    # Call-specific TypeScript types
└── index.ts                    # Public API exports

/src/app/api/widget/call/
├── session/
│   └── route.ts                # POST /api/widget/call/session (create session)
├── [sessionId]/
│   ├── ws/
│   │   └── route.ts            # WebSocket /api/widget/call/[sessionId]/ws
│   └── end/
│       └── route.ts            # POST /api/widget/call/[sessionId]/end
└── config/
    └── route.ts                # GET /api/widget/call/config

/src/app/api/webhooks/
├── whatsapp/
│   └── call/
│       └── route.ts            # POST /api/webhooks/whatsapp/call
└── twilio/
    ├── voice/
    │   └── route.ts            # POST /api/webhooks/twilio/voice
    └── call-status/
        └── route.ts            # POST /api/webhooks/twilio/call-status

/src/app/api/company/
├── integration-accounts/
│   ├── route.ts                # GET/POST /api/company/integration-accounts
│   └── [accountId]/
│       └── route.ts            # GET/PATCH/DELETE /api/company/integration-accounts/[accountId]
└── chatbots/
    └── [chatbotId]/
        ├── call-settings/
        │   └── route.ts        # GET/PATCH /api/company/chatbots/[chatbotId]/call-settings
        └── call-models/
            └── route.ts        # GET /api/company/chatbots/[chatbotId]/call-models

/src/app/(company-admin)/
├── integrations/
│   ├── page.tsx                # Integration accounts list page
│   ├── new/
│   │   └── page.tsx            # Create new integration account
│   └── [accountId]/
│       └── page.tsx            # Edit integration account
└── chatbots/
    └── [chatbotId]/
        ├── call-settings/
        │   └── page.tsx        # Call settings page (Call Options tab)
        └── widget/
            └── page.tsx        # Widget customization (update to include call options)

/src/components/shared/chatbot/
├── call-settings/
│   ├── call-settings-form.tsx  # Main call settings form
│   ├── voice-selector.tsx      # Voice selection dropdown
│   ├── voice-preview.tsx       # Voice preview player
│   ├── call-options.tsx        # Call behavior options
│   └── advanced-settings.tsx   # Advanced call settings
│
└── call-widget/
    ├── call-button.tsx         # Call button component
    ├── call-interface.tsx      # Full call interface
    ├── audio-visualizer.tsx    # Audio visualizer (Wave/Orb)
    ├── transcript-display.tsx  # Live transcript display
    ├── call-controls.tsx       # Mute/End call controls
    └── call-status.tsx         # Call status indicators

/src/lib/db/schema/
└── calls.ts                    # Database schema for call tables
```

---

## API Route Patterns

### Widget Call API (Public, no auth)

**POST /api/widget/call/session** - Create call session

Location: `/src/app/api/widget/call/session/route.ts`

Request:
```typescript
{
  chatbotId: string;
  companyId: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}
```

Response:
```typescript
{
  sessionId: string;
  callId: string;
  websocketUrl: string;
  expiresAt: string; // ISO timestamp
  config: {
    voiceId: string;
    visualizerStyle: 'wave' | 'orb';
    showDuration: boolean;
    showTranscript: boolean;
  };
}
```

Implementation:
```typescript
// /src/app/api/widget/call/session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CallRunnerService } from '@/lib/call';
import { db } from '@/lib/db';
import { chatbots, companies } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const createSessionSchema = z.object({
  chatbotId: z.string().uuid(),
  companyId: z.string().uuid(),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const data = createSessionSchema.parse(body);

    // Validate chatbot exists and call is enabled
    const chatbot = await db.query.chatbots.findFirst({
      where: and(
        eq(chatbots.id, data.chatbotId),
        eq(chatbots.company_id, data.companyId),
        isNull(chatbots.deleted_at)
      ),
      with: {
        company: true
      }
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    if (!chatbot.enabled_call) {
      return NextResponse.json(
        { error: 'Call feature not enabled for this chatbot' },
        { status: 403 }
      );
    }

    // Check if company has call feature enabled
    if (!chatbot.company.settings?.features?.callEnabled) {
      return NextResponse.json(
        { error: 'Call feature not enabled for this company' },
        { status: 403 }
      );
    }

    // Create call session
    const callRunner = CallRunnerService.getInstance();
    const session = await callRunner.createSession({
      chatbotId: data.chatbotId,
      companyId: data.companyId,
      source: 'web',
      customer: data.customer,
      metadata: data.metadata
    });

    // Generate WebSocket URL
    const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    const host = request.headers.get('host') || 'localhost:3000';
    const websocketUrl = `${protocol}://${host}/api/widget/call/${session.sessionId}/ws`;

    // Return session details
    return NextResponse.json({
      sessionId: session.sessionId,
      callId: session.callId,
      websocketUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      config: {
        voiceId: chatbot.settings.call?.voiceId,
        visualizerStyle: chatbot.settings.call?.visualizerStyle || 'wave',
        showDuration: chatbot.settings.call?.showDuration ?? true,
        showTranscript: chatbot.settings.call?.showTranscript ?? true
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating call session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

**WebSocket /api/widget/call/[sessionId]/ws** - Audio streaming

Location: `/src/app/api/widget/call/[sessionId]/ws/route.ts`

Protocol:
```
Client → Server:
  {type: "audio", data: base64}   # PCM16 24kHz audio chunk
  {type: "end"}                   # End call

Server → Client:
  {type: "connected", sessionId}  # Connection established
  {type: "audio", data: base64}   # PCM16 24kHz audio response
  {type: "transcript", data: {...}}  # Transcript update
  {type: "agent_speaking", data: {isSpeaking: boolean}}
  {type: "call_ended", reason}    # Call terminated
  {type: "error", message}        # Error occurred
```

Implementation:
```typescript
// /src/app/api/widget/call/[sessionId]/ws/route.ts

import { NextRequest } from 'next/server';
import { WebSocket } from 'ws';
import { CallRunnerService, WebSocketCallHandler } from '@/lib/call';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const upgradeHeader = request.headers.get('upgrade');

  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  // Upgrade HTTP connection to WebSocket
  const { socket, response } = await (request as any).socket.server.upgrade(request);

  const ws = new WebSocket(socket);
  const sessionId = params.sessionId;

  try {
    // Get call session
    const callRunner = CallRunnerService.getInstance();
    const session = await callRunner.getSession(sessionId);

    if (!session) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Session not found'
      }));
      ws.close();
      return response;
    }

    // Create WebSocket handler
    const handler = new WebSocketCallHandler(sessionId, session.callId, ws);

    // Start handler
    await handler.start();

    // Start call (connect to AI provider)
    await callRunner.startCall(sessionId, handler);

    // Set up event listeners
    handler.on('audioReceived', async (audioData) => {
      await callRunner.sendAudio(sessionId, audioData);
    });

    handler.on('callEnded', async (reason) => {
      await callRunner.endCall(sessionId, reason);
    });

    handler.on('error', (error) => {
      console.error(`Call handler error [${sessionId}]:`, error);
    });

  } catch (error) {
    console.error(`WebSocket upgrade error [${sessionId}]:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to start call'
    }));
    ws.close();
  }

  return response;
}
```

---

**POST /api/widget/call/[sessionId]/end** - End call

Location: `/src/app/api/widget/call/[sessionId]/end/route.ts`

Request:
```typescript
{
  reason?: string; // Optional end reason
}
```

Response:
```typescript
{
  callId: string;
  duration: number; // seconds
  transcriptUrl?: string;
}
```

Implementation:
```typescript
// /src/app/api/widget/call/[sessionId]/end/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { CallRunnerService } from '@/lib/call';

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { reason } = await request.json();
    const sessionId = params.sessionId;

    // End call
    const callRunner = CallRunnerService.getInstance();
    await callRunner.endCall(sessionId, reason);

    // Get call details
    const session = await callRunner.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Return call summary
    return NextResponse.json({
      callId: session.callId,
      duration: Math.floor((Date.now() - session.startedAt.getTime()) / 1000),
      transcriptUrl: `/api/widget/call/${session.callId}/transcript`
    });

  } catch (error) {
    console.error('Error ending call:', error);
    return NextResponse.json(
      { error: 'Failed to end call' },
      { status: 500 }
    );
  }
}
```

---

### Webhook API

**POST /api/webhooks/whatsapp/call** - WhatsApp call events

Location: `/src/app/api/webhooks/whatsapp/call/route.ts`

Handles: call_initiated, call_accepted, ice_candidate, call_ended

Request (example):
```typescript
{
  event: 'call_initiated',
  phone_number: '+1234567890',
  business_phone_number_id: 'xxx',
  from: {
    phone: '+1987654321',
    name: 'John Doe'
  },
  sdp: '...' // SDP offer
}
```

Response:
```typescript
{
  sdp: '...' // SDP answer
}
```

Implementation:
```typescript
// /src/app/api/webhooks/whatsapp/call/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/call/integrations/whatsapp-client';
import { WebRTCSignaling } from '@/lib/call/integrations/webrtc-signaling';
import { CallRunnerService, WhatsAppCallHandler } from '@/lib/call';
import { db } from '@/lib/db';
import { integrationAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    const body = await request.text();

    // Find integration account by phone number
    const data = JSON.parse(body);
    const account = await db.query.integrationAccounts.findFirst({
      where: eq(integrationAccounts.credentials->>'phoneNumberId', data.business_phone_number_id)
    });

    if (!account) {
      return NextResponse.json({ error: 'Integration account not found' }, { status: 404 });
    }

    // Verify signature
    const isValid = verifyWebhookSignature(body, signature!, account.webhook_secret!);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle event
    switch (data.event) {
      case 'call_initiated': {
        // Create call session
        const callRunner = CallRunnerService.getInstance();
        const session = await callRunner.createSession({
          chatbotId: account.chatbot_id!, // Configured in integration
          companyId: account.company_id,
          source: 'whatsapp',
          fromNumber: data.from.phone,
          toNumber: data.phone_number,
          customer: {
            name: data.from.name,
            phone: data.from.phone
          }
        });

        // Parse SDP offer
        const signaling = new WebRTCSignaling();
        const sdpAnswer = await signaling.createAnswer(data.sdp);

        // Create WhatsApp handler
        const handler = new WhatsAppCallHandler(session.sessionId, session.callId, signaling.peerConnection);

        // Start call
        await callRunner.startCall(session.sessionId, handler);

        // Return SDP answer
        return NextResponse.json({ sdp: sdpAnswer });
      }

      case 'call_ended': {
        // Handle call end
        // ... implementation
        return NextResponse.json({ status: 'ok' });
      }

      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

**POST /api/webhooks/twilio/voice** - Twilio voice call

Location: `/src/app/api/webhooks/twilio/voice/route.ts`

Returns TwiML with `<Stream>` verb to start audio streaming.

Response (XML):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://yourapp.com/api/webhooks/twilio/stream?sessionId=xxx" />
  </Connect>
</Response>
```

Implementation:
```typescript
// /src/app/api/webhooks/twilio/voice/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { CallRunnerService } from '@/lib/call';
import { db } from '@/lib/db';
import { integrationAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Parse Twilio request (form-urlencoded)
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;

    // Find integration account by Twilio phone number
    const account = await db.query.integrationAccounts.findFirst({
      where: eq(integrationAccounts.credentials->>'phoneNumber', to)
    });

    if (!account) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Sorry, this number is not configured for calls.</Say>
          <Hangup />
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Create call session
    const callRunner = CallRunnerService.getInstance();
    const session = await callRunner.createSession({
      chatbotId: account.chatbot_id!,
      companyId: account.company_id,
      source: 'custom', // Twilio uses 'custom' channel
      fromNumber: from,
      toNumber: to,
      metadata: { callSid }
    });

    // Generate stream WebSocket URL
    const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    const host = request.headers.get('host') || 'localhost:3000';
    const streamUrl = `${protocol}://${host}/api/webhooks/twilio/stream?sessionId=${session.sessionId}`;

    // Return TwiML with Stream
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="${streamUrl}" />
        </Connect>
      </Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error('Twilio voice webhook error:', error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>An error occurred. Please try again later.</Say>
        <Hangup />
      </Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
```

---

### Admin API

**GET /api/company/integration-accounts** - List integration accounts

Location: `/src/app/api/company/integration-accounts/route.ts`

Authorization: requireCompanyAdmin()

Response:
```typescript
{
  accounts: Array<{
    id: string;
    accountType: 'twilio' | 'whatsapp' | 'custom';
    accountName: string;
    status: 'active' | 'inactive' | 'error';
    webhookUrl: string;
    lastVerifiedAt: string | null;
    createdAt: string;
  }>;
}
```

**POST /api/company/integration-accounts** - Create integration account

Request:
```typescript
{
  accountType: 'twilio' | 'whatsapp' | 'custom';
  accountName: string;
  credentials: {
    // Twilio
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;

    // WhatsApp
    accessToken?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
  };
}
```

Response:
```typescript
{
  account: {
    id: string;
    webhookUrl: string;
    webhookSecret: string;
  };
}
```

---

**GET /api/company/chatbots/[chatbotId]/call-settings** - Get call settings

Authorization: requireCompanyAdmin()

Response:
```typescript
{
  callSettings: {
    voiceId: string;
    voiceProvider: string;
    callGreeting: string;
    silenceTimeout: number;
    maxCallDuration: number;
    recordingEnabled: boolean;
    transcriptionEnabled: boolean;
    // ... all call settings from chatbots.settings.call
  };
}
```

**PATCH /api/company/chatbots/[chatbotId]/call-settings** - Update call settings

Request: Same as response above

---

## Real-Time Architecture

### WebSocket vs. SSE

**Chat uses SSE (Server-Sent Events)**:
- **Direction**: Unidirectional (server → client only)
- **Use case**: Text streaming, status updates
- **Route**: `/api/widget/[sessionId]/stream`
- **Format**: `event: message\ndata: {"chunk": "..."}\n\n`
- **Multiplexing**: HTTP/2 allows many concurrent SSE connections
- **Rationale**: Text streaming doesn't require client→server during response generation

**Calls use WebSocket**:
- **Direction**: Bidirectional (client ↔ server)
- **Use case**: Binary audio streaming, low-latency communication
- **Route**: `/api/widget/call/[sessionId]/ws`
- **Format**: JSON messages with base64-encoded audio data
- **Connection**: Single persistent connection per call
- **Rationale**: Audio requires full duplex (simultaneous client→server and server→client), low latency critical

**Shared Infrastructure**:
Both use SSE Manager for broadcasting events to observers (admin dashboard, other clients).

**Channel Naming**:
```typescript
// Call channel (for broadcasting call events)
function getCallChannel(callId: string): string {
  return `call:${callId}`;
}

// Conversation channel (for chat messages)
function getConversationChannel(conversationId: string): string {
  return `conversation:${conversationId}`;
}
```

**SSE Manager Usage** (existing, reused):
```typescript
// Broadcast call transcript to observers
await sseManager.send(getCallChannel(callId), {
  type: 'transcript',
  data: {
    role: 'user',
    content: 'Hello, I need help with...',
    timestamp: Date.now()
  }
});

// Broadcast call status change
await sseManager.send(getCallChannel(callId), {
  type: 'status',
  data: { status: 'in_progress' }
});
```

**Who subscribes to call channels?**
- Company admin viewing live call dashboard
- Support agents monitoring active calls
- Analytics systems collecting metrics

**Note**: The actual audio streaming still uses WebSocket (not SSE), only status/transcript events use SSE for broadcasting to observers.

---

## Multi-Tenancy & Security

### Company Isolation

**Database-Level Isolation**:
All call queries must filter by `company_id`:

```typescript
// CORRECT: Filter by company_id
const calls = await db.query.calls.findMany({
  where: and(
    eq(calls.company_id, companyId),
    eq(calls.status, 'in_progress')
  )
});

// INCORRECT: Missing company_id filter (security vulnerability!)
const calls = await db.query.calls.findMany({
  where: eq(calls.status, 'in_progress')
});
```

**Integration Accounts are Company-Scoped**:
- Each integration account belongs to one company
- Company A cannot see or use Company B's Twilio account
- Foreign key: `integration_accounts.company_id → companies.id` with `CASCADE DELETE`

**Call Sessions Validate Ownership**:
- Before creating session, validate chatbot belongs to company
- Before accessing call, verify call belongs to user's active company

```typescript
// Validate chatbot ownership
const chatbot = await db.query.chatbots.findFirst({
  where: and(
    eq(chatbots.id, chatbotId),
    eq(chatbots.company_id, companyId),
    isNull(chatbots.deleted_at)
  )
});

if (!chatbot) {
  throw new Error('Chatbot not found or access denied');
}
```

### Authorization

**Role-Based Access**:

| Action | Master Admin | Company Admin | Support Agent | End User |
|--------|--------------|---------------|---------------|----------|
| Enable call feature (company-level) | ✓ | ✗ | ✗ | ✗ |
| Create call-enabled packages | ✓ | ✗ | ✗ | ✗ |
| Manage AI models (model_type) | ✓ | ✗ | ✗ | ✗ |
| Create/edit integration accounts | ✗ | ✓ | ✗ | ✗ |
| Configure chatbot call settings | ✗ | ✓ | ✗ | ✗ |
| Customize widget | ✗ | ✓ | ✗ | ✗ |
| View call transcripts (own company) | ✓ | ✓ | ✓ (read-only) | ✗ |
| View call analytics | ✓ | ✓ | ✓ (limited) | ✗ |
| Initiate calls (widget) | N/A | N/A | N/A | ✓ (no auth) |

**Authorization Guards** (reuse existing):
```typescript
// In admin API routes
import { requireCompanyAdmin } from '@/lib/auth/guards';

export async function GET(request: NextRequest) {
  const session = await requireCompanyAdmin();

  // Access company_permissions via session.user
  const companyId = request.cookies.get('active_company_id')?.value;

  // ... implementation
}
```

**Widget API (Public)**:
- No authentication required for widget API
- Sessions are created without user accounts
- Validated by chatbot existence and `enabled_call` flag
- Rate limited by IP address

### Security Measures

**1. Webhook Signature Verification**:
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}
```

Usage:
```typescript
// In webhook handler
const signature = request.headers.get('x-hub-signature-256');
const body = await request.text();
const account = await getIntegrationAccount(phoneNumberId);

if (!verifyWebhookSignature(body, signature!, account.webhook_secret!)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

**2. Credential Encryption**:
```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

function encryptCredentials(credentials: Record<string, any>): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex')
  });
}

function decryptCredentials(encryptedData: string): Record<string, any> {
  const { iv, encrypted, authTag } = JSON.parse(encryptedData);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
```

Storage:
```typescript
// When creating integration account
const encryptedCredentials = encryptCredentials({
  accountSid: 'ACxxxx',
  authToken: 'secret_token'
});

await db.insert(integrationAccounts).values({
  company_id: companyId,
  account_type: 'twilio',
  credentials: encryptedCredentials, // JSONB column
  // ...
});
```

**3. Rate Limiting**:
```typescript
// Rate limit webhook endpoints (prevent DoS)
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // ... handle webhook
}
```

**4. Session Tokens**:
```typescript
// Generate session token for call authentication
function generateSessionToken(sessionId: string): string {
  const payload = {
    sessionId,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };

  const token = crypto
    .createHmac('sha256', process.env.SESSION_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');

  return `${Buffer.from(JSON.stringify(payload)).toString('base64')}.${token}`;
}

function verifySessionToken(token: string): { sessionId: string } | null {
  const [payloadB64, signature] = token.split('.');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

  // Check expiry
  if (payload.exp < Date.now()) {
    return null;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (signature !== expectedSignature) {
    return null;
  }

  return { sessionId: payload.sessionId };
}
```

**5. CORS Validation**:
```typescript
// Widget API must validate origin
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Check if origin is allowed for this chatbot
  const chatbot = await getChatbot(chatbotId);
  const allowedOrigins = chatbot.settings.allowedOrigins || [];

  if (!allowedOrigins.includes(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  // ... handle request
}
```

**6. Signed URLs for Recordings**:
```typescript
// Generate signed URL for call recording access (expires in 10 minutes)
function generateSignedRecordingUrl(callId: string, recordingPath: string): string {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  const payload = `${callId}:${recordingPath}:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', process.env.RECORDING_SECRET!)
    .update(payload)
    .digest('hex');

  return `/api/recordings/${callId}?path=${encodeURIComponent(recordingPath)}&expires=${expiresAt}&sig=${signature}`;
}
```

**7. Never Log Sensitive Data**:
```typescript
// GOOD: Log without sensitive data
logger.info('Call created', {
  callId,
  companyId,
  chatbotId,
  duration,
  status
});

// BAD: Logs audio data (security risk + large logs)
logger.debug('Audio received', { audioData }); // DON'T DO THIS

// BAD: Logs credentials (security risk)
logger.debug('Integration account', { credentials }); // DON'T DO THIS
```

---

## Audio Flow Diagrams

### Web Widget Audio Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          User Microphone
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Web Audio API (getUserMedia)                                           │
│  - Sample rate: 48kHz (browser default)                                 │
│  - Format: Float32Array                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Resample 48kHz → 24kHz
                          (for OpenAI Realtime API)
                                  │
                                  ▼
                          Convert Float32 → PCM16
                                  │
                                  ▼
                          Base64 encode
                                  │
                                  ▼
                          WebSocket send message
                          {type: "audio", data: base64}
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          WebSocket route handler
                          /api/widget/call/[sessionId]/ws
                                  │
                                  ▼
                          Base64 decode
                                  │
                                  ▼
                          WebSocketCallHandler.handleAudio()
                                  │
                                  ▼
                          CallRunnerService.sendAudio()
                                  │
                                  ▼
                          CallExecutor.sendAudio()
                          (OpenAIRealtimeExecutor)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPENAI REALTIME API                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          WebSocket send
                          {type: "input_audio_buffer.append", audio: base64}
                                  │
                                  ▼
                          AI Processing:
                          - Voice Activity Detection (VAD)
                          - Speech-to-text (Whisper)
                          - LLM reasoning (GPT-4o)
                          - Text-to-speech (TTS voice)
                                  │
                                  ▼
                          WebSocket receive
                          {type: "response.audio.delta", delta: base64}
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          CallExecutor.onAudioDelta()
                                  │
                                  ▼
                          Emit 'audioDelta' event
                                  │
                                  ▼
                          WebSocketCallHandler.sendAudio()
                                  │
                                  ▼
                          WebSocket send message
                          {type: "audio", data: base64}
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          WebSocket receive
                                  │
                                  ▼
                          Base64 decode
                                  │
                                  ▼
                          PCM16 Buffer
                                  │
                                  ▼
                          Convert PCM16 → Float32
                                  │
                                  ▼
                          Web Audio API AudioBuffer
                                  │
                                  ▼
                          Play via AudioContext
                                  │
                                  ▼
                          User Speaker
```

**Key Points**:
- Browser captures at 48kHz (default), server resamples to 24kHz for OpenAI
- Float32 ↔ PCM16 conversion for compatibility between Web Audio API and OpenAI
- Base64 encoding for WebSocket text frame transmission
- Bidirectional full-duplex streaming
- Typical latency: 200-400ms (network + AI processing)

---

### WhatsApp Call Audio Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP USER (Mobile App)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          WhatsApp App (Audio I/O)
                          - Codec: Opus
                          - Sample rate: 48kHz
                                  │
                                  ▼
                          Opus encoding
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              WHATSAPP SERVERS (WebRTC Gateway)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          WebRTC RTP packets
                          (Opus codec, 48kHz)
                                  │
                                  ▼
                          Webhook to server
                          POST /api/webhooks/whatsapp/call
                          {event: "call_initiated", sdp: "..."}
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          WebRTC Signaling
                          - Parse SDP offer
                          - Create SDP answer
                          - Establish RTP connection
                                  │
                                  ▼
                          WhatsAppCallHandler.handleAudio()
                                  │
                                  ▼
                          Receive Opus audio (48kHz)
                                  │
                                  ▼
                          AudioConverter.opusToPcm16()
                          (Decode Opus → PCM16)
                                  │
                                  ▼
                          PCM16 48kHz
                                  │
                                  ▼
                          AudioResampler.resample()
                          (48kHz → 24kHz)
                                  │
                                  ▼
                          PCM16 24kHz
                                  │
                                  ▼
                          Base64 encode
                                  │
                                  ▼
                          CallExecutor.sendAudio()
                          (OpenAIRealtimeExecutor)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPENAI REALTIME API                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          AI Processing (same as web widget)
                                  │
                                  ▼
                          Response audio (PCM16 24kHz base64)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          CallExecutor.onAudioDelta()
                                  │
                                  ▼
                          Base64 decode
                                  │
                                  ▼
                          PCM16 24kHz
                                  │
                                  ▼
                          AudioResampler.resample()
                          (24kHz → 48kHz)
                                  │
                                  ▼
                          PCM16 48kHz
                                  │
                                  ▼
                          AudioConverter.pcm16ToOpus()
                          (Encode PCM16 → Opus)
                                  │
                                  ▼
                          Opus audio 48kHz
                                  │
                                  ▼
                          WhatsAppCallHandler.sendAudio()
                                  │
                                  ▼
                          WebRTC RTP packets
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              WHATSAPP SERVERS (WebRTC Gateway)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          RTP to WhatsApp App
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP USER (Mobile App)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Opus decoding
                                  │
                                  ▼
                          Audio playback
```

**Key Points**:
- WhatsApp uses Opus codec at 48kHz (efficient for mobile networks)
- Server must decode Opus → PCM16, resample 48kHz → 24kHz for OpenAI
- Response requires reverse: resample 24kHz → 48kHz, encode PCM16 → Opus
- WebRTC handles network jitter, packet loss recovery
- Typical latency: 300-500ms (mobile network + WebRTC + AI processing)

---

### Twilio Phone Call Audio Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHONE USER (PSTN)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          PSTN Network
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      TWILIO GATEWAY                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Webhook to server
                          POST /api/webhooks/twilio/voice
                          (TwiML request)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Generate TwiML response
                          <Response><Connect><Stream url="wss://..."/></Connect></Response>
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      TWILIO GATEWAY                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Open WebSocket to server
                          wss://yourapp.com/api/webhooks/twilio/stream
                                  │
                                  ▼
                          Stream audio via WebSocket
                          {event: "media", media: {payload: base64}}
                          - Codec: PCMU (G.711 μ-law)
                          - Sample rate: 8kHz
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          TwilioCallHandler.handleAudio()
                                  │
                                  ▼
                          Base64 decode
                                  │
                                  ▼
                          PCMU buffer (8kHz)
                                  │
                                  ▼
                          AudioConverter.pcmuToPcm16()
                          (Decode μ-law → PCM16)
                                  │
                                  ▼
                          PCM16 8kHz
                                  │
                                  ▼
                          AudioResampler.resample()
                          (8kHz → 24kHz)
                                  │
                                  ▼
                          PCM16 24kHz
                                  │
                                  ▼
                          Base64 encode
                                  │
                                  ▼
                          CallExecutor.sendAudio()
                          (OpenAIRealtimeExecutor)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPENAI REALTIME API                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          AI Processing (same as above)
                                  │
                                  ▼
                          Response audio (PCM16 24kHz base64)
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (Next.js)                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          CallExecutor.onAudioDelta()
                                  │
                                  ▼
                          Base64 decode
                                  │
                                  ▼
                          PCM16 24kHz
                                  │
                                  ▼
                          AudioResampler.resample()
                          (24kHz → 8kHz)
                                  │
                                  ▼
                          PCM16 8kHz
                                  │
                                  ▼
                          AudioConverter.pcm16ToPcmu()
                          (Encode PCM16 → μ-law)
                                  │
                                  ▼
                          PCMU buffer (8kHz)
                                  │
                                  ▼
                          Base64 encode
                                  │
                                  ▼
                          TwilioCallHandler.sendAudio()
                                  │
                                  ▼
                          WebSocket send
                          {event: "media", streamSid: "...", media: {payload: base64}}
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      TWILIO GATEWAY                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          PCMU audio to PSTN
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHONE USER (PSTN)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Audio playback
```

**Key Points**:
- Twilio uses PCMU (G.711 μ-law) at 8kHz (telephony standard)
- Server must decode PCMU → PCM16, resample 8kHz → 24kHz for OpenAI
- Response requires reverse: resample 24kHz → 8kHz, encode PCM16 → PCMU
- Lower sample rate (8kHz) = lower audio quality but compatible with PSTN
- Typical latency: 400-600ms (PSTN network + conversion + AI processing)

---

## Voice Activity Detection (VAD)

### Strategy: Server-Side VAD via OpenAI Realtime API

**Why Server-Side VAD?**
- Eliminates need for client-side VAD implementation (complexity reduction)
- Consistent behavior across all integration types (Web, WhatsApp, Twilio)
- OpenAI's VAD model is optimized for their TTS voices
- Reduces false positives/negatives compared to custom VAD

### Configuration

Set during session initialization:

```typescript
// In OpenAIRealtimeExecutor.sendSessionUpdate()
{
  type: 'session.update',
  session: {
    // ... other config
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,                // Sensitivity (0.0 = very sensitive, 1.0 = very strict)
      prefix_padding_ms: 300,        // Capture 300ms before speech starts
      silence_duration_ms: 700       // 700ms silence = turn end
    }
  }
}
```

**Configuration Tunables** (stored in chatbot settings):

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| vadThreshold | 0.5 | 0.0 - 1.0 | Speech detection sensitivity. Lower = more sensitive (triggers on quieter sounds). Higher = stricter (requires louder speech). |
| prefix_padding_ms | 300 | 0 - 1000 | Milliseconds of audio to capture before detected speech start. Prevents cutting off first syllable. |
| silence_duration_ms | 700 | 200 - 3000 | Milliseconds of silence required to consider turn complete. Lower = more interruptions allowed. Higher = more patient listening. |

### Events

OpenAI emits these events based on VAD:

```typescript
// User started speaking
{
  type: 'input_audio_buffer.speech_started',
  audio_start_ms: 1234,
  item_id: 'msg_abc123'
}

// User stopped speaking (silence detected)
{
  type: 'input_audio_buffer.speech_stopped',
  audio_end_ms: 5678,
  item_id: 'msg_abc123'
}
```

### Implementation

```typescript
// In OpenAIRealtimeExecutor.handleServerEvent()
switch (event.type) {
  case 'input_audio_buffer.speech_started':
    // User started speaking
    console.log('[VAD] User speech started');

    // If agent is currently speaking, trigger interruption
    if (this.responseInProgress && this.sessionConfig.interruptionEnabled) {
      console.log('[VAD] User interrupted agent, canceling response');
      await this.cancelResponse();
    }

    // Emit event for UI updates (e.g., show "User is speaking" indicator)
    this.emit('userSpeaking', true);
    break;

  case 'input_audio_buffer.speech_stopped':
    // User stopped speaking
    console.log('[VAD] User speech stopped, generating response');

    this.emit('userSpeaking', false);

    // OpenAI automatically triggers response generation
    // No manual action needed
    break;
}
```

### Use Cases

1. **Automatic Turn-Taking**:
   - User speaks → VAD detects speech → captures audio
   - User pauses → VAD detects silence → triggers response generation
   - No button press needed ("push-to-talk" not required)

2. **User Interruption Detection**:
   - Agent is speaking → user starts speaking → VAD detects speech
   - System cancels agent's response → allows user to speak
   - Enables natural conversational flow

3. **Silence Timeout Tracking**:
   - Track time since last `speech_stopped` event
   - If > silenceTimeout setting, end call gracefully
   - Prevents hanging calls when user walks away

### Fallback for Non-OpenAI Providers

For providers without built-in VAD (e.g., Gemini Live), implement client-side VAD:

```typescript
// Client-side VAD using @ricky0123/vad-web
import { MicVAD } from '@ricky0123/vad-web';

const vad = await MicVAD.new({
  onSpeechStart: () => {
    console.log('[VAD] Speech started');
    // Send control message to server
    ws.send(JSON.stringify({ type: 'speech_start' }));
  },
  onSpeechEnd: (audio) => {
    console.log('[VAD] Speech ended');
    // Send audio chunk
    ws.send(JSON.stringify({ type: 'audio', data: audioToBase64(audio) }));
    // Send control message
    ws.send(JSON.stringify({ type: 'speech_end' }));
  }
});
```

---

## User Interruption Handling

### Detection

**Using Server-Side VAD**:
- Monitor `input_audio_buffer.speech_started` event while agent is speaking
- If `speech_started` fires while `responseInProgress === true`, user interrupted

**Debouncing**:
- Ignore interruptions within 100ms of response start (prevent false positives from echo)
- Track last interruption time, require 100ms gap between interruptions

### Response

1. **Cancel Agent Response**:
```typescript
// Send response.cancel to OpenAI
this.ws.send(JSON.stringify({
  type: 'response.cancel'
}));

this.responseInProgress = false;
```

2. **Stop Audio Playback on Client**:
```typescript
// WebSocketCallHandler sends STOP_AUDIO event
this.ws.send(JSON.stringify({
  type: 'stop_audio'
}));
```

3. **Track Interruption**:
```typescript
// Increment interruption counter for analytics
await db.update(calls)
  .set({
    metadata: sql`jsonb_set(metadata, '{interruption_count}',
                            (COALESCE(metadata->>'interruption_count', '0')::int + 1)::text::jsonb)`
  })
  .where(eq(calls.id, callId));
```

### Recovery

- Provider stops generating response immediately
- System is ready for user's new input
- Conversation history preserved (partial response discarded, context intact)
- No explicit "resume" needed, user just continues speaking

### Implementation

```typescript
// In OpenAIRealtimeExecutor
private handleSpeechStarted(): void {
  console.log('[VAD] User speech started');

  // Check if agent is currently speaking
  if (!this.responseInProgress) {
    // Normal speech, no interruption
    this.emit('userSpeaking', true);
    return;
  }

  // Check if interruption is enabled
  if (!this.sessionConfig.interruptionEnabled) {
    // Ignore user speech while agent speaks
    console.log('[VAD] Interruption disabled, ignoring user speech');
    return;
  }

  // Check debounce (prevent false positives)
  const timeSinceResponseStart = Date.now() - this.responseStartTime;
  if (timeSinceResponseStart < 100) {
    console.log('[VAD] Ignoring interruption (too soon after response start)');
    return;
  }

  // User interrupted agent
  console.log('[VAD] User interrupted agent, canceling response');

  this.cancelResponse();
  this.emit('userInterrupted', true);
  this.emit('userSpeaking', true);
}

async cancelResponse(): Promise<void> {
  if (!this.ws || !this.responseInProgress) return;

  // Send cancel to OpenAI
  this.ws.send(JSON.stringify({
    type: 'response.cancel'
  }));

  this.responseInProgress = false;
  this.emit('agentSpeaking', false);

  // Notify client to stop playing audio
  // (handled by CallRunnerService → WebSocketCallHandler)
}
```

### UI Feedback

**Client-Side Handling**:
```typescript
// In call interface component
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'stop_audio':
      // Stop audio playback immediately
      audioContext.suspend();
      audioQueue.clear();

      // Update UI
      setAgentSpeaking(false);
      setUserInterrupted(true);

      // Show brief indicator
      showToast('You interrupted the agent', { duration: 1000 });
      break;
  }
});
```

---

## Silence Detection & Timeout

### Implementation

**Timeout Monitoring** (in CallSessionManager):
```typescript
private async checkTimeouts(): Promise<void> {
  const now = Date.now();

  for (const [sessionId, session] of this.sessions.entries()) {
    if (session.status !== 'active') continue;

    // Load chatbot settings
    const chatbot = await db.query.chatbots.findFirst({
      where: eq(chatbots.id, session.chatbotId)
    });

    if (!chatbot) continue;

    const silenceTimeout = chatbot.settings.call.silenceTimeout || 180; // seconds

    // Check silence timeout
    const silenceDuration = (now - session.lastActivityAt.getTime()) / 1000;
    if (silenceDuration > silenceTimeout) {
      console.log(`[Timeout] Silence timeout reached for session ${sessionId} (${silenceDuration}s)`);
      await this.handleTimeout(sessionId, 'silence_timeout');
    }
  }
}

private async handleTimeout(sessionId: string, reason: string): Promise<void> {
  const session = this.sessions.get(sessionId);
  if (!session) return;

  // Optionally: Prompt user before ending
  if (reason === 'silence_timeout') {
    await this.promptUserBeforeEnding(session);

    // Wait 10 seconds for response
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check if user responded (lastActivityAt updated)
    if (Date.now() - session.lastActivityAt.getTime() < 10000) {
      // User responded, don't end call
      console.log(`[Timeout] User responded, canceling timeout for session ${sessionId}`);
      return;
    }
  }

  // End call
  const callRunner = CallRunnerService.getInstance();
  await callRunner.endCall(sessionId, reason);
}

private async promptUserBeforeEnding(session: CallSession): Promise<void> {
  // Send prompt through executor
  const executor = await CallRunnerService.getInstance().loadExecutor(session.chatbotId);

  // Inject prompt to generate "Are you still there?" message
  // (Implementation depends on provider API)
}
```

### Default Timeout

**Default: 180 seconds (3 minutes)**

Configurable per chatbot in settings:
```typescript
// In chatbot.settings.call
{
  silenceTimeout: 180, // seconds
  maxCallDuration: 3600 // seconds (hard limit)
}
```

### Actions on Timeout

1. **Emit silence_timeout event**:
```typescript
await sseManager.send(getCallChannel(callId), {
  type: 'silence_timeout',
  data: { duration: silenceDuration }
});
```

2. **Optional: Agent prompts "Are you still there?"**:
- Only if `settings.call.promptBeforeTimeout === true`
- Wait 10 seconds for response
- If no response, proceed to end call

3. **Gracefully end call**:
- Save call record with `end_reason: 'silence_timeout'`
- Disconnect from AI provider
- Close client connection
- Clean up resources

4. **Save final transcript**:
- Ensure all pending transcripts saved to database
- Mark call as completed

### Max Duration Timeout

Separate from silence timeout, enforces absolute maximum call length:

```typescript
// Check max duration
const callDuration = (now - session.startedAt.getTime()) / 1000;
const maxDuration = chatbot.settings.call.maxCallDuration || 3600;

if (callDuration > maxDuration) {
  console.log(`[Timeout] Max duration reached for session ${sessionId} (${callDuration}s)`);
  await this.handleTimeout(sessionId, 'max_duration');
}
```

**Default: 3600 seconds (60 minutes)**

Prevents runaway calls (e.g., user leaves call connected).

---

## Transcript Generation

### Source: Automatic via OpenAI Realtime API

**Configuration**:
```typescript
// In OpenAIRealtimeExecutor.sendSessionUpdate()
{
  type: 'session.update',
  session: {
    input_audio_transcription: {
      model: 'whisper-1'
    }
  }
}
```

Enables automatic transcription of user speech using Whisper-1 model.

### Events

**Partial Transcript** (streaming):
```typescript
{
  type: 'conversation.item.input_audio_transcription.delta',
  item_id: 'msg_abc123',
  content_index: 0,
  delta: 'Hello, I need help with...'
}
```

**Final Transcript** (complete):
```typescript
{
  type: 'conversation.item.input_audio_transcription.completed',
  item_id: 'msg_abc123',
  content_index: 0,
  transcript: 'Hello, I need help with my account.'
}
```

**Agent Speech Transcript**:
```typescript
{
  type: 'response.audio_transcript.delta',
  response_id: 'resp_123',
  item_id: 'msg_abc456',
  output_index: 0,
  content_index: 0,
  delta: 'I can help you with that. Let me look...'
}

{
  type: 'response.audio_transcript.done',
  response_id: 'resp_123',
  item_id: 'msg_abc456',
  output_index: 0,
  content_index: 0,
  transcript: 'I can help you with that. Let me look up your account.'
}
```

### Storage

**Real-Time** (stream to client):
```typescript
// In CallRunnerService
executor.on('transcriptDelta', async (transcript) => {
  // Broadcast via WebSocket to client
  await handler.sendTranscript(transcript);

  // Broadcast via SSE to observers (admin dashboard)
  await sseManager.send(getCallChannel(session.callId), {
    type: 'transcript',
    data: transcript
  });
});
```

**Persistent** (save to database):
```typescript
// Save final transcripts to call_transcripts table
private async saveTranscript(callId: string, transcript: TranscriptData): Promise<void> {
  await db.insert(callTranscripts).values({
    call_id: callId,
    role: transcript.role, // 'user' | 'assistant'
    content: transcript.content,
    start_time: transcript.startTime, // milliseconds from call start
    end_time: transcript.endTime,
    duration: transcript.endTime - transcript.startTime,
    confidence: transcript.confidence, // 0.0 - 1.0
    created_at: new Date()
  });
}
```

### Data Structure

**call_transcripts Table**:
```sql
CREATE TABLE chatapp.call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES chatapp.calls(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  start_time INTEGER NOT NULL, -- Milliseconds from call start
  end_time INTEGER NOT NULL,
  duration INTEGER NOT NULL, -- Milliseconds
  audio_url VARCHAR(500), -- Optional: URL to audio segment
  confidence DECIMAL(5,4), -- 0.0000 to 1.0000
  metadata JSONB, -- Provider-specific data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_transcripts_call_id ON chatapp.call_transcripts(call_id);
CREATE INDEX idx_call_transcripts_role ON chatapp.call_transcripts(role);
```

### Use Cases

1. **Live Transcript Display in Widget**:
```typescript
// Client receives transcript via WebSocket
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'transcript') {
    const { role, content, startTime } = message.data;

    appendTranscriptEntry({
      role,
      content,
      timestamp: startTime
    });
  }
});
```

2. **Post-Call Transcript Download**:
```typescript
// API route: GET /api/company/calls/[callId]/transcript
export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  const session = await requireCompanyAdmin();

  // Fetch all transcript entries
  const transcripts = await db.query.callTranscripts.findMany({
    where: eq(callTranscripts.call_id, params.callId),
    orderBy: asc(callTranscripts.start_time)
  });

  // Format as plain text
  const text = transcripts
    .map(t => `[${formatTime(t.start_time)}] ${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n\n');

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="call-${params.callId}-transcript.txt"`
    }
  });
}
```

3. **Searchable Call History**:
```typescript
// Search calls by transcript content
const results = await db.select()
  .from(calls)
  .innerJoin(callTranscripts, eq(calls.id, callTranscripts.call_id))
  .where(
    and(
      eq(calls.company_id, companyId),
      sql`${callTranscripts.content} ILIKE ${'%' + query + '%'}`
    )
  )
  .limit(20);
```

4. **Compliance and Quality Review**:
- Company admins can review all call transcripts
- Search for specific phrases (e.g., "cancel", "refund")
- Audit agent responses for quality
- Identify common issues or questions

---

## Error Handling & Recovery

### Provider Connection Failures

**Scenario**: OpenAI Realtime API WebSocket connection fails

**Retry Logic**:
```typescript
async connectWithRetry(maxAttempts: number = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await this.connect();
      console.log(`[Provider] Connected successfully (attempt ${attempt})`);
      return;
    } catch (error) {
      console.error(`[Provider] Connection failed (attempt ${attempt}/${maxAttempts}):`, error);

      if (attempt === maxAttempts) {
        throw new Error('Failed to connect to AI provider after max retries');
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

**Fallback**:
```typescript
// If OpenAI connection fails, fallback to error message
try {
  await this.connectWithRetry();
} catch (error) {
  // Send error to client
  handler.send({
    type: 'error',
    message: 'Unable to connect to AI provider. Please try again.'
  });

  // Offer alternative
  handler.send({
    type: 'fallback_options',
    options: ['retry', 'start_chat', 'leave_message']
  });

  // Log for monitoring
  logger.error('Provider connection failed', {
    callId,
    companyId,
    chatbotId,
    error: error.message
  });
}
```

### Audio Quality Issues

**Detection**:
```typescript
// Monitor audio stream quality
private monitorAudioQuality(audioBuffer: Buffer): void {
  // Calculate RMS level
  const rms = AudioValidator.calculateRms(audioBuffer);

  // Check for clipping
  const hasClipping = AudioValidator.detectClipping(audioBuffer);

  // Check for silence
  const isSilent = rms < 100; // Very low RMS = silence

  if (hasClipping) {
    console.warn('[Audio] Clipping detected, possible microphone overload');
  }

  if (isSilent && this.consecutiveSilentChunks++ > 50) {
    console.warn('[Audio] Prolonged silence detected, possible microphone issue');
    this.emit('audioQualityWarning', 'silence');
  }

  if (!isSilent) {
    this.consecutiveSilentChunks = 0;
  }
}
```

**Response**:
```typescript
// Notify user of connection issues
handler.send({
  type: 'audio_quality_warning',
  message: 'We\'re experiencing audio quality issues. Please check your microphone.'
});

// Offer to reconnect
handler.send({
  type: 'reconnect_prompt',
  message: 'Would you like to reconnect?'
});
```

### Integration Errors

**Webhook Signature Validation Failures**:
```typescript
// Reject with 401, don't process
if (!verifyWebhookSignature(body, signature, account.webhook_secret)) {
  logger.warn('Webhook signature verification failed', {
    accountId: account.id,
    ip: request.headers.get('x-forwarded-for')
  });

  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

**Account Inactive**:
```typescript
// Check integration account status before creating call
if (account.status !== 'active') {
  return NextResponse.json({
    error: 'Integration account is inactive',
    details: account.last_error
  }, { status: 503 });
}

// Notify company admin of integration issue
await sendAdminNotification({
  companyId: account.company_id,
  type: 'integration_error',
  message: `Integration account "${account.account_name}" is inactive`,
  accountId: account.id
});
```

**Rate Limiting**:
```typescript
// If rate limit exceeded, queue or reject
const { success, pending } = await ratelimit.limit(ip);

if (!success) {
  if (pending < 10) {
    // Queue request if not too many pending
    await queueCallRequest(request);
    return NextResponse.json({ status: 'queued', message: 'Your call will start shortly' });
  } else {
    // Reject if too many pending
    return NextResponse.json({ error: 'Too many requests, please try again later' }, { status: 429 });
  }
}
```

### Session Timeouts

**Idle Timeout**:
- Detected by CallSessionManager checking `lastActivityAt`
- If no activity for `silenceTimeout` seconds, end call gracefully
- Optionally prompt user before ending

**Max Duration**:
- Hard limit to prevent runaway costs
- Default: 60 minutes
- Cannot be extended once reached
- Call ends with reason: `max_duration`

**Cleanup**:
```typescript
async endCall(sessionId: string, reason?: string): Promise<void> {
  // ... end call logic

  // Clean up resources
  const session = this.sessionManager.getSession(sessionId);
  if (session) {
    // Disconnect executor
    if (session.executor) {
      await session.executor.disconnect();
    }

    // Close handler
    if (session.handler) {
      await session.handler.end(reason);
    }

    // Remove from sessions map (after 5 minutes)
    await this.sessionManager.endSession(sessionId);
  }
}
```

### Monitoring & Alerting

**Metrics to Track**:
```typescript
// Increment counters
metrics.increment('call_errors_total', { error_type: 'provider_connection' });
metrics.increment('call_sessions_failed_total', { reason: 'timeout' });

// Record latency
metrics.histogram('audio_latency_ms', latencyMs);

// Record audio quality
metrics.histogram('audio_rms_level', rms);
```

**Alerting Rules**:
- Call failure rate > 5% → Alert engineering team
- Provider connection errors > 10/min → Alert on-call
- High audio latency > 1000ms for 5 minutes → Investigate network
- Integration account failures → Notify company admin

**Logging**:
```typescript
// Structured logs with context
logger.error('Call failed', {
  callId,
  sessionId,
  companyId,
  chatbotId,
  reason: 'provider_connection',
  error: error.message,
  stack: error.stack,
  duration: callDuration,
  audioChunksReceived: audioChunkCount
});
```

---

## Performance Optimization

### 1. Executor Caching

**Cache executors to avoid repeated initialization**:

```typescript
// LRU cache with 3-hour TTL
private executorCache = new LRUCache<string, CallExecutor>({
  max: 1000, // Maximum 1000 executors cached
  ttl: 3 * 60 * 60 * 1000, // 3 hours
  updateAgeOnGet: true, // Reset TTL on access
  dispose: async (executor) => {
    // Clean up when evicted
    await executor.disconnect();
  }
});
```

**Benefits**:
- Reduces database queries (chatbot config loading)
- Faster call initiation (no executor initialization delay)
- Consistent with AgentRunnerService pattern

**Cache Invalidation**:
```typescript
// Invalidate when chatbot settings change
async function updateChatbotCallSettings(chatbotId: string, settings: any): Promise<void> {
  // Update database
  await db.update(chatbots)
    .set({ settings: { ...existing.settings, call: settings } })
    .where(eq(chatbots.id, chatbotId));

  // Invalidate executor cache
  const callRunner = CallRunnerService.getInstance();
  callRunner.invalidateExecutor(chatbotId);
}
```

### 2. Audio Buffering

**Circular Buffers to Prevent Memory Leaks**:

```typescript
class CircularAudioBuffer {
  private buffer: Buffer[];
  private maxSize: number;
  private readIndex: number = 0;
  private writeIndex: number = 0;

  constructor(maxSize: number = 1000) {
    this.buffer = new Array(maxSize);
    this.maxSize = maxSize;
  }

  write(chunk: Buffer): void {
    this.buffer[this.writeIndex] = chunk;
    this.writeIndex = (this.writeIndex + 1) % this.maxSize;

    // Overwrite read pointer if buffer full
    if (this.writeIndex === this.readIndex) {
      this.readIndex = (this.readIndex + 1) % this.maxSize;
    }
  }

  read(): Buffer | null {
    if (this.readIndex === this.writeIndex) {
      return null; // Empty
    }

    const chunk = this.buffer[this.readIndex];
    this.readIndex = (this.readIndex + 1) % this.maxSize;
    return chunk;
  }

  clear(): void {
    this.readIndex = 0;
    this.writeIndex = 0;
  }
}
```

**Usage**:
```typescript
// In call handler
private audioBuffer = new CircularAudioBuffer(1000);

async handleAudio(audioData: Buffer): Promise<void> {
  // Buffer audio chunks
  this.audioBuffer.write(audioData);

  // Process buffered chunks
  let chunk: Buffer | null;
  while ((chunk = this.audioBuffer.read()) !== null) {
    await this.processAudioChunk(chunk);
  }
}
```

### 3. Chunk Size Optimization

**Audio Chunk Size: 100ms (2400 samples at 24kHz)**:

```typescript
const SAMPLE_RATE = 24000; // 24kHz
const CHUNK_DURATION_MS = 100; // 100ms
const SAMPLES_PER_CHUNK = (SAMPLE_RATE * CHUNK_DURATION_MS) / 1000; // 2400 samples
const BYTES_PER_CHUNK = SAMPLES_PER_CHUNK * 2; // 4800 bytes (PCM16 = 2 bytes per sample)
```

**Why 100ms?**
- Balance between latency and overhead
- Too small (< 50ms): High overhead, more network packets, CPU intensive
- Too large (> 200ms): Noticeable latency, chunky audio
- 100ms: Optimal for real-time voice (imperceptible latency, efficient processing)

### 4. WebSocket Connection Pooling

**Reuse Provider Connections When Possible**:

```typescript
// Connection pool for OpenAI Realtime WebSockets
class ProviderConnectionPool {
  private connections: Map<string, WebSocket> = new Map();

  async getConnection(apiKey: string): Promise<WebSocket> {
    const key = this.hashApiKey(apiKey);

    if (this.connections.has(key)) {
      const ws = this.connections.get(key)!;
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
    }

    // Create new connection
    const ws = await this.createConnection(apiKey);
    this.connections.set(key, ws);
    return ws;
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}
```

**Note**: Check provider API limits for connection pooling (some APIs require one connection per session).

### 5. Database Indexing

**Optimize Common Queries**:

```sql
-- Index for active calls query (company dashboard)
CREATE INDEX idx_calls_company_status ON chatapp.calls(company_id, status)
WHERE deleted_at IS NULL;

-- Index for call history by date (analytics)
CREATE INDEX idx_calls_company_created ON chatapp.calls(company_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for transcript search
CREATE INDEX idx_call_transcripts_content_gin ON chatapp.call_transcripts
USING gin(to_tsvector('english', content));

-- Index for integration accounts by type
CREATE INDEX idx_integration_accounts_type ON chatapp.integration_accounts(company_id, account_type, status)
WHERE deleted_at IS NULL;
```

### 6. Transcript Pagination

**Limit Initial Load**:

```typescript
// API route: GET /api/company/calls/[callId]/transcripts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  const transcripts = await db.query.callTranscripts.findMany({
    where: eq(callTranscripts.call_id, callId),
    orderBy: asc(callTranscripts.start_time),
    limit,
    offset
  });

  return NextResponse.json({ transcripts, limit, offset });
}
```

**Client-Side Infinite Scroll**:
- Load first 100 entries on page load
- Load more as user scrolls
- Prevents slow initial page load for long calls

### 7. Memory Management

**Periodic Cleanup**:

```typescript
// Run every hour
setInterval(() => {
  // Clean up expired sessions
  sessionManager.cleanupExpiredSessions();

  // Clean up executor cache (LRU handles this automatically)

  // Force garbage collection (if --expose-gc flag enabled)
  if (global.gc) {
    global.gc();
  }
}, 60 * 60 * 1000);
```

**Monitor Memory Usage**:
```typescript
// Log memory usage metrics
setInterval(() => {
  const memUsage = process.memoryUsage();
  metrics.gauge('nodejs_memory_heap_used_bytes', memUsage.heapUsed);
  metrics.gauge('nodejs_memory_heap_total_bytes', memUsage.heapTotal);
  metrics.gauge('nodejs_memory_external_bytes', memUsage.external);

  if (memUsage.heapUsed > 1.5 * 1024 * 1024 * 1024) { // > 1.5GB
    logger.warn('High memory usage detected', { memUsage });
  }
}, 60000); // Every minute
```

---

## Monitoring & Observability

### Metrics to Track

**Call Session Metrics**:
```typescript
// Counter: Total call sessions created
metrics.increment('call_sessions_created_total', {
  company_id: companyId,
  chatbot_id: chatbotId,
  source: 'web' // or 'whatsapp', 'custom'
});

// Gauge: Active call sessions
metrics.gauge('call_sessions_active', sessionManager.getActiveSessionCount());

// Histogram: Call duration
metrics.histogram('call_duration_seconds', durationSeconds, {
  company_id: companyId,
  status: 'completed' // or 'failed'
});

// Counter: Call failures
metrics.increment('call_sessions_failed_total', {
  reason: 'provider_connection', // or 'timeout', 'user_ended', etc.
  company_id: companyId
});
```

**Audio Quality Metrics**:
```typescript
// Histogram: Audio latency (time from client send to server receive)
metrics.histogram('audio_latency_ms', latencyMs, {
  source: 'web'
});

// Histogram: Audio RMS level (signal strength)
metrics.histogram('audio_rms_level', rms);

// Counter: Audio quality warnings
metrics.increment('audio_quality_warnings_total', {
  type: 'clipping' // or 'silence', 'low_level'
});
```

**Provider Metrics**:
```typescript
// Counter: Provider connection failures
metrics.increment('provider_connection_failures_total', {
  provider: 'openai', // or 'gemini'
  error_type: 'websocket_error'
});

// Histogram: Provider response latency
metrics.histogram('provider_response_latency_ms', latencyMs, {
  provider: 'openai'
});

// Counter: Provider API errors
metrics.increment('provider_api_errors_total', {
  provider: 'openai',
  error_code: error.code
});
```

**Integration Metrics**:
```typescript
// Counter: Integration account errors
metrics.increment('integration_account_errors_total', {
  account_type: 'twilio',
  company_id: companyId
});

// Counter: Webhook signature verification failures
metrics.increment('webhook_signature_failures_total', {
  account_type: 'whatsapp'
});
```

### Logging Strategy

**Structured Logs with Context**:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'call-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Call session created', {
  callId,
  sessionId,
  companyId,
  chatbotId,
  source: 'web'
});

logger.error('Provider connection failed', {
  callId,
  sessionId,
  provider: 'openai',
  error: error.message,
  stack: error.stack,
  attempt: 3
});
```

**Log Levels**:
- **ERROR**: Failures requiring attention (provider errors, integration failures)
- **WARN**: Degraded performance or recoverable issues (audio quality warnings, retries)
- **INFO**: Lifecycle events (call started, ended, status changes)
- **DEBUG**: Detailed execution (audio chunks, WebSocket messages) - disable in production

**What NOT to Log**:
- ❌ Audio data (binary, large, no value)
- ❌ API keys, credentials (security risk)
- ❌ PII unless absolutely necessary (user names, phone numbers)
- ❌ Full WebSocket messages (too verbose)

### Alerting

**Critical Alerts** (page on-call):
- Call failure rate > 10% for 5 minutes
- Provider connection errors > 50/min
- Integration account down (affects multiple calls)
- High memory usage > 2GB sustained

**Warning Alerts** (Slack notification):
- Call failure rate > 5% for 10 minutes
- Average audio latency > 500ms for 10 minutes
- High error rate for specific company (> 20% failure)
- Webhook signature verification failures > 10/hour

**Alert Configuration** (example with Prometheus Alertmanager):

```yaml
groups:
  - name: call_service
    interval: 1m
    rules:
      # Critical: High call failure rate
      - alert: HighCallFailureRate
        expr: (rate(call_sessions_failed_total[5m]) / rate(call_sessions_created_total[5m])) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High call failure rate ({{ $value }}%)"
          description: "More than 10% of calls failing in the last 5 minutes"

      # Warning: High audio latency
      - alert: HighAudioLatency
        expr: histogram_quantile(0.95, audio_latency_ms) > 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High audio latency ({{ $value }}ms)"
          description: "95th percentile audio latency above 500ms"

      # Critical: Provider connection failures
      - alert: ProviderConnectionFailures
        expr: rate(provider_connection_failures_total[1m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Provider connection failures ({{ $value }}/min)"
          description: "High rate of failures connecting to AI provider"
```

### Dashboards

**Grafana Dashboard Panels**:

1. **Call Overview**:
   - Active calls gauge
   - Calls created/hour timeseries
   - Call duration histogram
   - Call failure rate

2. **Audio Quality**:
   - Audio latency percentiles (p50, p95, p99)
   - Audio RMS level distribution
   - Quality warnings count

3. **Provider Health**:
   - Provider response latency
   - Provider error rate
   - Connection success rate

4. **Integration Status**:
   - Active integration accounts by type
   - Webhook errors by account
   - Call distribution by source (web, whatsapp, twilio)

5. **Per-Company Metrics**:
   - Top companies by call volume
   - Call failure rate by company
   - Average call duration by company

**Example Grafana Panel Query** (Prometheus):
```promql
# Active calls
sum(call_sessions_active)

# Call failure rate
rate(call_sessions_failed_total[5m]) / rate(call_sessions_created_total[5m])

# 95th percentile audio latency
histogram_quantile(0.95, rate(audio_latency_ms_bucket[5m]))
```

---

## Scalability Considerations

### 1. Horizontal Scaling

**Stateless API Routes**:
- All API routes are stateless (no in-memory state)
- Session state stored in database (or Redis for performance)
- Multiple server instances can handle requests

**Load Balancing**:
- Sticky sessions for WebSocket connections (route to same instance)
- Round-robin for HTTP API requests
- Health check endpoint: `GET /api/health`

**Configuration**:
```typescript
// Health check route
export async function GET() {
  // Check database connection
  const dbHealthy = await checkDatabaseHealth();

  // Check Redis connection (if using)
  const redisHealthy = await checkRedisHealth();

  // Check active sessions
  const activeSessions = sessionManager.getActiveSessionCount();

  if (!dbHealthy || !redisHealthy || activeSessions > 1000) {
    return NextResponse.json({
      status: 'unhealthy',
      database: dbHealthy,
      redis: redisHealthy,
      activeSessions
    }, { status: 503 });
  }

  return NextResponse.json({
    status: 'healthy',
    activeSessions
  });
}
```

### 2. Database Partitioning

**Partition call_transcripts by Date**:

Large tables (millions of rows) benefit from partitioning:

```sql
-- Partition by month
CREATE TABLE chatapp.call_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- ... other columns
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE chatapp.call_transcripts_2025_01 PARTITION OF chatapp.call_transcripts
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE chatapp.call_transcripts_2025_02 PARTITION OF chatapp.call_transcripts
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ... create partitions for each month
```

**Benefits**:
- Faster queries (scan only relevant partitions)
- Easier archival (drop old partitions)
- Better vacuum performance

### 3. Storage for Call Recordings

**Separate Storage Bucket**:
- Don't store recordings in database (too large)
- Use object storage: Supabase Storage, AWS S3, Google Cloud Storage

**Storage Structure**:
```
/recordings/
  {companyId}/
    {year}/
      {month}/
        {callId}.wav
```

**Upload After Call Ends**:
```typescript
async function uploadRecording(callId: string, audioData: Buffer): Promise<string> {
  const call = await db.query.calls.findFirst({
    where: eq(calls.id, callId)
  });

  const path = `${call.company_id}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${callId}.wav`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('call-recordings')
    .upload(path, audioData, {
      contentType: 'audio/wav',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload recording: ${error.message}`);
  }

  // Generate signed URL (expires in 1 hour)
  const { data: signedUrl } = await supabase.storage
    .from('call-recordings')
    .createSignedUrl(path, 3600);

  // Save URL to database
  await db.update(calls)
    .set({ recording_url: signedUrl.signedUrl })
    .where(eq(calls.id, callId));

  return signedUrl.signedUrl;
}
```

### 4. Concurrent Calls per Instance

**Monitor Active Connections**:
```typescript
// Track WebSocket connections
private activeConnections = new Set<WebSocket>();

// Add connection
this.activeConnections.add(ws);

// Remove on close
ws.on('close', () => {
  this.activeConnections.delete(ws);
});

// Get count
const connectionCount = this.activeConnections.size;
```

**Limit per Instance**:
- Set max concurrent calls per instance (e.g., 100)
- If exceeded, route to another instance or queue request

```typescript
const MAX_CONCURRENT_CALLS = 100;

if (sessionManager.getActiveSessionCount() >= MAX_CONCURRENT_CALLS) {
  return NextResponse.json({
    error: 'Server at capacity, please try again shortly',
    retry_after: 30 // seconds
  }, { status: 503 });
}
```

### 5. Cost Management

**Track Costs per Call**:
```typescript
// After call ends
const duration = call.duration; // seconds
const audioMinutes = duration / 60;

// OpenAI Realtime API pricing (example: $0.06/min input, $0.24/min output)
const inputCost = audioMinutes * 0.06;
const outputCost = audioMinutes * 0.24;
const totalCost = inputCost + outputCost;

// Save to database
await db.update(calls)
  .set({
    metadata: {
      ...call.metadata,
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost,
        currency: 'USD'
      }
    }
  })
  .where(eq(calls.id, callId));

// Track in metrics
metrics.histogram('call_cost_usd', totalCost, {
  company_id: call.company_id,
  provider: 'openai'
});
```

**Budget Alerts**:
- Track monthly costs per company
- Alert if company exceeds budget
- Auto-pause calls if hard limit reached

### 6. Rate Limiting per Company

**Prevent Abuse**:
```typescript
// Redis-based rate limiter
const companyRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 calls per hour per company
  prefix: 'ratelimit:calls'
});

export async function POST(request: NextRequest) {
  const { companyId } = await request.json();

  const { success, limit, remaining } = await companyRateLimit.limit(companyId);

  if (!success) {
    return NextResponse.json({
      error: 'Company rate limit exceeded',
      limit,
      remaining: 0,
      reset: Date.now() + 3600000 // 1 hour from now
    }, { status: 429 });
  }

  // ... create call session
}
```

---

## Critical Implementation Files

Based on the architecture, these are the **most critical files** to implement (in priority order):

### 1. `/src/lib/db/schema/calls.ts`

**Why Critical**: Foundation for all call data. Must be created first.

**Contents**:
- `integration_accounts` table (company integration credentials)
- `calls` table (call session records)
- `call_transcripts` table (turn-by-turn transcripts)
- Proper indexes for performance
- Foreign keys for data integrity
- Multi-tenancy constraints (company_id filtering)

**Priority**: **HIGHEST** (must complete before any code)

---

### 2. `/src/lib/call/execution/call-runner.ts`

**Why Critical**: Central orchestration service for all call operations. Equivalent to AgentRunnerService for chat.

**Contents**:
- `CallRunnerService` class (singleton)
- Executor caching (LRU, 3-hour TTL)
- Session management via `CallSessionManager`
- Methods: `loadExecutor`, `createSession`, `startCall`, `sendAudio`, `endCall`
- Error handling and retry logic

**Dependencies**:
- Database schema (calls tables)
- `CallExecutor` (can be stubbed initially)
- `CallSessionManager` (can be stubbed initially)

**Priority**: **HIGHEST** (core orchestration)

---

### 3. `/src/lib/call/providers/openai-realtime.ts`

**Why Critical**: Primary AI provider for calls. All call functionality depends on this working.

**Contents**:
- `OpenAIRealtimeExecutor` class (extends `CallExecutor`)
- WebSocket connection to OpenAI Realtime API
- Session configuration (voice, VAD, tools, transcription)
- Audio streaming (`sendAudio` method)
- Event handling (`speech_started`, `speech_stopped`, `response.audio.delta`, `response.audio_transcript.done`)
- Function calling integration (knowledge base search)
- Interruption handling (`response.cancel`)

**Dependencies**:
- `CallExecutor` base class
- Audio converter (for base64 encoding)

**Priority**: **HIGHEST** (enables AI functionality)

---

### 4. `/src/app/api/widget/call/[sessionId]/ws/route.ts`

**Why Critical**: Main WebSocket entry point for web widget calls. Handles all client-server audio streaming.

**Contents**:
- WebSocket upgrade handler
- `WebSocketCallHandler` instantiation
- Connection lifecycle management
- Message protocol implementation (`audio`, `transcript`, `control` events)
- Integration with `CallRunnerService`

**Dependencies**:
- `CallRunnerService`
- `WebSocketCallHandler`
- Session validation

**Priority**: **HIGHEST** (enables web widget calls)

---

### 5. `/src/lib/call/audio/converter.ts`

**Why Critical**: Required for all non-web integrations (WhatsApp, Twilio). Audio format mismatches will cause call failures.

**Contents**:
- `AudioConverter` class
- Codec conversion functions:
  - `pcm16ToOpus` (for WhatsApp)
  - `opusToPcm16` (for WhatsApp)
  - `pcm16ToPcmu` (for Twilio)
  - `pcmuToPcm16` (for Twilio)
  - `float32ToPcm16` (for Web Audio API)
  - `pcm16ToFloat32` (for Web Audio API)
- μ-law encoding/decoding algorithms
- Opus encoding/decoding via `@discordjs/opus`

**Dependencies**:
- `@discordjs/opus` npm package

**Priority**: **HIGH** (required for integrations)

---

### Honorable Mentions (also important, but can be implemented after the top 5):

6. **`/src/lib/call/handlers/websocket-handler.ts`** - Core handler logic for web widget
7. **`/src/lib/call/execution/session-manager.ts`** - Session tracking and timeout monitoring
8. **`/src/lib/call/audio/resampler.ts`** - Sample rate conversion (critical for WhatsApp and Twilio)
9. **`/src/app/api/widget/call/session/route.ts`** - Session creation endpoint
10. **`/src/components/shared/chatbot/call-widget/call-interface.tsx`** - Main widget UI component

---

## Code Porting Strategy

### Port from voice.buzzi.ai

The following components should be **ported** (adapted, not copied verbatim) from voice.buzzi.ai:

1. **Audio Conversion Utilities**:
   - Source: `voice.buzzi.ai/src/utils/audio-converter.js`
   - Port to: `/src/lib/call/audio/converter.ts`
   - Adaptations:
     - Convert from JavaScript to TypeScript
     - Add type definitions
     - Use ES modules instead of CommonJS
     - Add error handling

2. **OpenAI Realtime WebSocket Logic**:
   - Source: `voice.buzzi.ai/src/services/openai-realtime.js`
   - Port to: `/src/lib/call/providers/openai-realtime.ts`
   - Adaptations:
     - Refactor to class-based `CallExecutor` pattern
     - Integrate with `CallRunnerService`
     - Use existing event emitter patterns
     - Add retry logic and error handling

3. **WebRTC Signaling (WhatsApp)**:
   - Source: `voice.buzzi.ai/src/services/webrtc.js`
   - Port to: `/src/lib/call/integrations/webrtc-signaling.ts`
   - Adaptations:
     - TypeScript conversion
     - Integrate with `WhatsAppCallHandler`
     - Add SDP validation
     - Add ICE candidate handling

4. **Twilio TwiML and Stream Handling**:
   - Source: `voice.buzzi.ai/src/webhooks/twilio.js`
   - Port to: `/src/app/api/webhooks/twilio/voice/route.ts`, `/src/lib/call/handlers/twilio-handler.ts`
   - Adaptations:
     - Next.js API route format
     - Integrate with `CallRunnerService`
     - Use existing multi-tenancy patterns
     - Add signature verification

### Rewrite for chat.buzzi.ai

The following components should be **rewritten** to match chat.buzzi.ai architecture:

1. **CallRunnerService**:
   - **Why**: Must mirror `AgentRunnerService` pattern exactly
   - **Pattern**: Singleton, executor caching, session management
   - **Don't port**: voice.buzzi.ai uses different orchestration

2. **Database Schema**:
   - **Why**: Must match chat.buzzi.ai multi-tenant schema
   - **Pattern**: `chatapp` schema prefix, foreign keys to existing tables
   - **Don't port**: voice.buzzi.ai uses different database structure

3. **API Routes**:
   - **Why**: Must use Next.js 15 App Router conventions
   - **Pattern**: `/src/app/api/` structure, route handlers
   - **Don't port**: voice.buzzi.ai uses Express.js

4. **UI Components**:
   - **Why**: Must match Radix UI + Tailwind CSS patterns
   - **Pattern**: Existing component structure in `/src/components/shared/`
   - **Don't port**: voice.buzzi.ai uses different UI framework

5. **Authorization**:
   - **Why**: Must use existing NextAuth.js + permission guards
   - **Pattern**: `requireAuth()`, `requireCompanyAdmin()`, active company cookie
   - **Don't port**: voice.buzzi.ai uses different auth system

### Porting Checklist

For each ported component:

- [ ] Convert JavaScript → TypeScript
- [ ] Add type definitions for all parameters and returns
- [ ] Replace CommonJS (`require`, `module.exports`) with ES modules (`import`, `export`)
- [ ] Update error handling (use consistent error patterns)
- [ ] Add logging with structured context
- [ ] Add unit tests
- [ ] Update dependencies (use chat.buzzi.ai's package.json versions)
- [ ] Follow chat.buzzi.ai code style (ESLint rules)
- [ ] Add JSDoc comments for public APIs

---

## Summary

This architecture document provides complete technical specifications for implementing voice call features into chat.buzzi.ai. Key takeaways:

1. **Follow Existing Patterns**: CallRunnerService mirrors AgentRunnerService, ensuring consistency
2. **Clean Separation**: All call code isolated in `/src/lib/call/` namespace
3. **Provider Abstraction**: Support multiple AI providers (OpenAI, Gemini, future providers)
4. **Integration Flexibility**: Pluggable handlers for Web, WhatsApp, Twilio
5. **Hybrid Code Strategy**: Port audio conversion and OpenAI logic from voice.buzzi.ai, rewrite infrastructure to match chat.buzzi.ai
6. **Multi-Tenancy First**: Company isolation enforced at all layers (database, API, UI)
7. **Security by Design**: Webhook verification, credential encryption, signed URLs, rate limiting
8. **Performance Optimized**: Executor caching, audio buffering, database indexing
9. **Observable**: Comprehensive metrics, structured logging, alerting rules
10. **Scalable**: Horizontal scaling, database partitioning, cost management

**Next Steps**: Implement the 5 critical files in priority order, starting with database schema, then CallRunnerService, OpenAIRealtimeProvider, WebSocket route, and audio converter.
