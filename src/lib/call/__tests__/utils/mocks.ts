/**
 * Mock Factories for Call Feature Tests
 *
 * Provides mock implementations of call services, handlers, and executors
 * for unit and integration testing.
 */

import { vi } from "vitest";
import { EventEmitter } from "events";
import type { CallSession, CallStatus, CallSource, CallAiProvider, TranscriptData } from "../../types";

// ============================================================================
// Mock CallSessionManager
// ============================================================================

export function createMockSessionManager() {
  const sessions = new Map<string, CallSession>();

  return {
    createSession: vi.fn(async (params: {
      sessionId: string;
      callId: string;
      chatbotId: string;
      companyId: string;
      endUserId?: string;
      source: CallSource;
    }): Promise<CallSession> => {
      const session: CallSession = {
        sessionId: params.sessionId,
        callId: params.callId,
        chatbotId: params.chatbotId,
        companyId: params.companyId,
        endUserId: params.endUserId,
        source: params.source,
        status: "pending",
        startedAt: new Date(),
        lastActivity: new Date(),
      };
      sessions.set(params.sessionId, session);
      return session;
    }),

    getSession: vi.fn(async (sessionId: string): Promise<CallSession | null> => {
      return sessions.get(sessionId) || null;
    }),

    updateSessionStatus: vi.fn(async (sessionId: string, status: CallStatus): Promise<void> => {
      const session = sessions.get(sessionId);
      if (session) {
        session.status = status;
        session.lastActivity = new Date();
      }
    }),

    updateLastActivity: vi.fn(async (sessionId: string): Promise<void> => {
      const session = sessions.get(sessionId);
      if (session) {
        session.lastActivity = new Date();
      }
    }),

    endSession: vi.fn(async (sessionId: string): Promise<void> => {
      sessions.delete(sessionId);
    }),

    getActiveSessionIds: vi.fn((): string[] => {
      return Array.from(sessions.keys());
    }),

    getActiveSessionsCount: vi.fn((): number => {
      return sessions.size;
    }),

    getCompanySessions: vi.fn((companyId: string): CallSession[] => {
      return Array.from(sessions.values()).filter((s) => s.companyId === companyId);
    }),

    getChatbotSessions: vi.fn((chatbotId: string): CallSession[] => {
      return Array.from(sessions.values()).filter((s) => s.chatbotId === chatbotId);
    }),

    shutdown: vi.fn(async (): Promise<void> => {
      sessions.clear();
    }),

    // Test helpers
    _sessions: sessions,
    _reset: () => sessions.clear(),
  };
}

// ============================================================================
// Mock CallExecutor
// ============================================================================

export function createMockExecutor(provider: CallAiProvider = "OPENAI") {
  const emitter = new EventEmitter();
  let isConnected = false;
  let isSpeaking = false;

  const executor = {
    // State
    isConnected: false,
    isSpeaking: false,
    chatbotId: "mock-chatbot-id",
    companyId: "mock-company-id",
    aiProvider: provider,

    // Abstract methods
    connect: vi.fn(async (): Promise<void> => {
      isConnected = true;
      executor.isConnected = true;
    }),

    disconnect: vi.fn(async (): Promise<void> => {
      isConnected = false;
      executor.isConnected = false;
    }),

    sendAudio: vi.fn(async (_audioBuffer: Buffer): Promise<void> => {
      // Simulate audio processing - emit audio delta after a short delay
      setTimeout(() => {
        const responseAudio = Buffer.alloc(1920); // 20ms at 24kHz
        emitter.emit("audioDelta", responseAudio);
      }, 10);
    }),

    cancelResponse: vi.fn(async (): Promise<void> => {
      isSpeaking = false;
      executor.isSpeaking = false;
    }),

    // Getters
    isExecutorConnected: vi.fn((): boolean => isConnected),
    isExecutorSpeaking: vi.fn((): boolean => isSpeaking),
    getChatbotId: vi.fn((): string => executor.chatbotId),
    getCompanyId: vi.fn((): string => executor.companyId),
    getAiProvider: vi.fn((): CallAiProvider => executor.aiProvider),

    // Event emitter methods (delegate to internal emitter)
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler);
      return executor;
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.once(event, handler);
      return executor;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      return emitter.emit(event, ...args);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.off(event, handler);
      return executor;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      emitter.removeAllListeners(event);
      return executor;
    }),

    // Test helpers
    _emitter: emitter,
    _simulateAudioDelta: (audioData: Buffer) => {
      emitter.emit("audioDelta", audioData);
    },
    _simulateTranscriptDelta: (data: TranscriptData) => {
      emitter.emit("transcriptDelta", data);
    },
    _simulateAgentSpeaking: () => {
      isSpeaking = true;
      executor.isSpeaking = true;
      emitter.emit("agentSpeaking");
    },
    _simulateAgentListening: () => {
      isSpeaking = false;
      executor.isSpeaking = false;
      emitter.emit("agentListening");
    },
    _simulateUserInterrupted: () => {
      emitter.emit("userInterrupted");
    },
    _simulateError: (error: Error) => {
      emitter.emit("error", error);
    },
    _simulateConnectionClosed: () => {
      isConnected = false;
      executor.isConnected = false;
      emitter.emit("connectionClosed");
    },
    _reset: () => {
      isConnected = false;
      isSpeaking = false;
      executor.isConnected = false;
      executor.isSpeaking = false;
      emitter.removeAllListeners();
      vi.clearAllMocks();
    },
  };

  return executor;
}

// ============================================================================
// Mock BaseCallHandler
// ============================================================================

export function createMockHandler(type: "websocket" | "twilio" | "whatsapp" = "websocket") {
  const emitter = new EventEmitter();
  let isActive = false;

  const handler = {
    // State
    sessionId: "mock-session-id",
    callId: "mock-call-id",
    isActive: false,
    type,

    // Abstract methods
    start: vi.fn(async (): Promise<void> => {
      isActive = true;
      handler.isActive = true;
      emitter.emit("callStarted");
    }),

    handleAudio: vi.fn(async (audioData: Buffer): Promise<void> => {
      emitter.emit("audioReceived", audioData);
    }),

    sendAudio: vi.fn(async (_audioData: Buffer): Promise<void> => {
      // Mock sending audio to external destination
    }),

    end: vi.fn(async (reason?: string): Promise<void> => {
      isActive = false;
      handler.isActive = false;
      emitter.emit("callEnded", reason);
    }),

    // Getters
    isHandlerActive: vi.fn((): boolean => isActive),
    getSessionId: vi.fn((): string => handler.sessionId),
    getCallId: vi.fn((): string => handler.callId),

    // Event emitter methods
    on: vi.fn((event: string, handlerFn: (...args: unknown[]) => void) => {
      emitter.on(event, handlerFn);
      return handler;
    }),
    once: vi.fn((event: string, handlerFn: (...args: unknown[]) => void) => {
      emitter.once(event, handlerFn);
      return handler;
    }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      return emitter.emit(event, ...args);
    }),
    off: vi.fn((event: string, handlerFn: (...args: unknown[]) => void) => {
      emitter.off(event, handlerFn);
      return handler;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      emitter.removeAllListeners(event);
      return handler;
    }),

    // Test helpers
    _emitter: emitter,
    _simulateAudioReceived: (audioData: Buffer) => {
      emitter.emit("audioReceived", audioData);
    },
    _simulateCallStarted: () => {
      isActive = true;
      handler.isActive = true;
      emitter.emit("callStarted");
    },
    _simulateCallEnded: (reason?: string) => {
      isActive = false;
      handler.isActive = false;
      emitter.emit("callEnded", reason);
    },
    _simulateError: (error: Error) => {
      emitter.emit("error", error);
    },
    _reset: () => {
      isActive = false;
      handler.isActive = false;
      emitter.removeAllListeners();
      vi.clearAllMocks();
    },
  };

  return handler;
}

// ============================================================================
// Mock WebSocket
// ============================================================================

export function createMockWebSocket() {
  const emitter = new EventEmitter();
  let readyState = 1; // WebSocket.OPEN

  const ws = {
    readyState,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,

    send: vi.fn((data: string | Buffer): void => {
      // Mock send - you can capture sent data in tests
    }),

    close: vi.fn((code?: number, reason?: string): void => {
      readyState = 3; // CLOSED
      ws.readyState = 3;
      emitter.emit("close", { code, reason });
    }),

    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.on(event, handler);
      return ws;
    }),

    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.once(event, handler);
      return ws;
    }),

    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      emitter.off(event, handler);
      return ws;
    }),

    removeAllListeners: vi.fn((event?: string) => {
      emitter.removeAllListeners(event);
      return ws;
    }),

    // Test helpers
    _emitter: emitter,
    _simulateMessage: (data: string | Buffer) => {
      emitter.emit("message", data);
    },
    _simulateOpen: () => {
      readyState = 1;
      ws.readyState = 1;
      emitter.emit("open");
    },
    _simulateClose: (code?: number, reason?: string) => {
      readyState = 3;
      ws.readyState = 3;
      emitter.emit("close", { code, reason });
    },
    _simulateError: (error: Error) => {
      emitter.emit("error", error);
    },
    _reset: () => {
      readyState = 1;
      ws.readyState = 1;
      emitter.removeAllListeners();
      vi.clearAllMocks();
    },
  };

  return ws;
}

// ============================================================================
// Mock CallRunnerService
// ============================================================================

export function createMockCallRunner() {
  const executorCache = new Map<string, ReturnType<typeof createMockExecutor>>();
  const activeHandlers = new Map<string, ReturnType<typeof createMockHandler>>();
  const mockSessionManager = createMockSessionManager();

  return {
    loadExecutor: vi.fn(async (chatbotId: string) => {
      let executor = executorCache.get(chatbotId);
      if (!executor) {
        executor = createMockExecutor();
        executor.chatbotId = chatbotId;
        executorCache.set(chatbotId, executor);
      }
      return executor;
    }),

    createSession: vi.fn(async (params: {
      chatbotId: string;
      companyId: string;
      endUserId?: string;
      source: CallSource;
    }) => {
      const sessionId = `session-${Date.now()}`;
      const callId = `call-${Date.now()}`;
      return mockSessionManager.createSession({
        sessionId,
        callId,
        chatbotId: params.chatbotId,
        companyId: params.companyId,
        endUserId: params.endUserId,
        source: params.source,
      });
    }),

    startCall: vi.fn(async (sessionId: string, handler: ReturnType<typeof createMockHandler>) => {
      activeHandlers.set(sessionId, handler);
      await handler.start();
    }),

    sendAudio: vi.fn(async (sessionId: string, audioBuffer: Buffer) => {
      const session = await mockSessionManager.getSession(sessionId);
      if (!session) return;

      const executor = executorCache.get(session.chatbotId);
      if (executor) {
        await executor.sendAudio(audioBuffer);
      }
    }),

    endCall: vi.fn(async (sessionId: string, reason?: string) => {
      const handler = activeHandlers.get(sessionId);
      if (handler) {
        await handler.end(reason);
        activeHandlers.delete(sessionId);
      }
      await mockSessionManager.endSession(sessionId);
    }),

    getActiveSessionCount: vi.fn(() => mockSessionManager.getActiveSessionsCount()),

    getCacheStats: vi.fn(() => ({
      size: executorCache.size,
      maxSize: 100,
      inactivityTTL: 3 * 60 * 60 * 1000,
      entries: Array.from(executorCache.keys()).map((chatbotId) => ({
        chatbotId,
        idleTime: 0,
      })),
    })),

    invalidateExecutor: vi.fn(async (chatbotId: string) => {
      const executor = executorCache.get(chatbotId);
      if (executor) {
        await executor.disconnect();
        executorCache.delete(chatbotId);
      }
    }),

    clearCache: vi.fn(() => {
      executorCache.clear();
    }),

    shutdown: vi.fn(async () => {
      for (const sessionId of activeHandlers.keys()) {
        const handler = activeHandlers.get(sessionId);
        if (handler) {
          await handler.end("shutdown");
        }
      }
      activeHandlers.clear();
      executorCache.clear();
      await mockSessionManager.shutdown();
    }),

    // Test helpers
    _executorCache: executorCache,
    _activeHandlers: activeHandlers,
    _sessionManager: mockSessionManager,
    _reset: () => {
      executorCache.clear();
      activeHandlers.clear();
      mockSessionManager._reset();
      vi.clearAllMocks();
    },
  };
}

// ============================================================================
// Mock Audio Converter
// ============================================================================

export function createMockAudioConverter() {
  return {
    mulawToPCM16: vi.fn((mulawData: Buffer): Buffer => {
      // Mock: double the buffer size
      return Buffer.alloc(mulawData.length * 2);
    }),

    pcm16ToMulaw: vi.fn((pcm16Data: Buffer): Buffer => {
      // Mock: halve the buffer size
      return Buffer.alloc(pcm16Data.length / 2);
    }),

    resamplePCM16: vi.fn((pcm16Data: Buffer, _fromRate: number, _toRate: number): Buffer => {
      // Mock: return same buffer (simplified)
      return Buffer.from(pcm16Data);
    }),

    stereoToMono: vi.fn((stereoData: Buffer): Buffer => {
      // Mock: halve the buffer size
      return Buffer.alloc(stereoData.length / 2);
    }),

    monoToStereo: vi.fn((monoData: Buffer): Buffer => {
      // Mock: double the buffer size
      return Buffer.alloc(monoData.length * 2);
    }),

    calculateRMS: vi.fn((_buffer: Buffer): number => {
      return 0.5;
    }),

    isSilence: vi.fn((_buffer: Buffer, _threshold?: number): boolean => {
      return false;
    }),

    normalizeAudio: vi.fn((buffer: Buffer, _targetLevel?: number): Buffer => {
      return Buffer.from(buffer);
    }),
  };
}

// ============================================================================
// Mock Database
// ============================================================================

export function createMockDatabase() {
  const mockData = {
    chatbots: new Map<string, ReturnType<typeof import("./test-data").createMockChatbot>>(),
    calls: new Map<string, ReturnType<typeof import("./test-data").createMockCallRecord>>(),
    transcripts: new Map<string, ReturnType<typeof import("./test-data").createMockTranscriptEntry>[]>(),
    integrationAccounts: new Map<string, ReturnType<typeof import("./test-data").createMockIntegrationAccount>>(),
  };

  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),

    // Test helpers
    _data: mockData,
    _setChatbot: (chatbot: ReturnType<typeof import("./test-data").createMockChatbot>) => {
      mockData.chatbots.set(chatbot.id, chatbot);
    },
    _setCall: (call: ReturnType<typeof import("./test-data").createMockCallRecord>) => {
      mockData.calls.set(call.id, call);
    },
    _reset: () => {
      mockData.chatbots.clear();
      mockData.calls.clear();
      mockData.transcripts.clear();
      mockData.integrationAccounts.clear();
      vi.clearAllMocks();
    },
  };
}

// ============================================================================
// Mock Profiler
// ============================================================================

export function createMockProfiler() {
  return {
    startSpan: vi.fn((_name: string, _type?: string, _attributes?: Record<string, unknown>) => ({
      end: vi.fn((_attributes?: Record<string, unknown>) => {}),
    })),
  };
}

// ============================================================================
// Mock Rate Limiter
// ============================================================================

export function createMockRateLimiter() {
  return {
    withRateLimit: vi.fn().mockResolvedValue(null),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29 }),
  };
}

// ============================================================================
// Mock Next.js Request/Response
// ============================================================================

export function createMockNextRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  searchParams?: Record<string, string>;
} = {}) {
  const { method = "GET", url = "http://localhost:3000/api/test", headers = {}, body, searchParams = {} } = options;

  const urlObj = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  return {
    method,
    url: urlObj.toString(),
    headers: new Map(Object.entries(headers)),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
    nextUrl: urlObj,
  };
}

export function createMockNextResponse() {
  return {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      data,
      status: init?.status || 200,
    })),
    redirect: vi.fn((url: string) => ({ url })),
  };
}
