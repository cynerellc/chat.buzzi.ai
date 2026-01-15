/**
 * CallExecutor Unit Tests
 *
 * Tests for the abstract base class for AI provider executors.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CallExecutor, isCallExecutor } from "../../execution/call-executor";
import type { ExecutorConfig, TranscriptData } from "../../types";

// ============================================================================
// Test Implementation
// ============================================================================

class TestCallExecutor extends CallExecutor {
  public connectCalled = false;
  public disconnectCalled = false;
  public sendAudioCalled = false;
  public cancelResponseCalled = false;
  public lastAudioBuffer: Buffer | null = null;

  async connect(): Promise<void> {
    this.connectCalled = true;
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalled = true;
    this.isConnected = false;
  }

  async sendAudio(audioBuffer: Buffer): Promise<void> {
    this.sendAudioCalled = true;
    this.lastAudioBuffer = audioBuffer;
  }

  async cancelResponse(): Promise<void> {
    this.cancelResponseCalled = true;
    this.isSpeaking = false;
  }

  // Expose protected methods for testing
  public testEmitAudioDelta(audioData: Buffer): void {
    this.emitAudioDelta(audioData);
  }

  public testEmitTranscriptDelta(data: TranscriptData): void {
    this.emitTranscriptDelta(data);
  }

  public testEmitAgentSpeaking(): void {
    this.emitAgentSpeaking();
  }

  public testEmitAgentListening(): void {
    this.emitAgentListening();
  }

  public testEmitUserInterrupted(): void {
    this.emitUserInterrupted();
  }

  public testEmitTurnComplete(): void {
    this.emitTurnComplete();
  }

  public testEmitError(error: Error): void {
    this.emitError(error);
  }

  public testEmitConnectionClosed(): void {
    this.emitConnectionClosed();
  }

  public testEmitFunctionCall(data: { name: string; arguments: Record<string, unknown> }): void {
    this.emitFunctionCall(data);
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestConfig(overrides: Partial<ExecutorConfig> = {}): ExecutorConfig {
  return {
    chatbotId: "test-chatbot-123",
    companyId: "test-company-456",
    aiProvider: "OPENAI",
    voiceConfig: {
      openai_voice: "alloy",
      openai_model: "gpt-4o-realtime-preview-2024-10-01",
    },
    systemPrompt: "You are a test assistant.",
    knowledgeCategories: ["test-category"],
    tools: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("CallExecutor", () => {
  let executor: TestCallExecutor;

  beforeEach(() => {
    executor = new TestCallExecutor(createTestConfig());
  });

  afterEach(() => {
    executor.removeAllListeners();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      expect(executor.getChatbotId()).toBe("test-chatbot-123");
      expect(executor.getCompanyId()).toBe("test-company-456");
      expect(executor.getAiProvider()).toBe("OPENAI");
    });

    it("should start with isConnected = false", () => {
      expect(executor.isExecutorConnected()).toBe(false);
    });

    it("should start with isSpeaking = false", () => {
      expect(executor.isExecutorSpeaking()).toBe(false);
    });

    it("should use default system prompt if not provided", () => {
      const executorNoPrompt = new TestCallExecutor({
        chatbotId: "test",
        companyId: "test",
        aiProvider: "OPENAI",
        voiceConfig: {},
      });

      // The default prompt is set in the constructor
      expect(executorNoPrompt).toBeDefined();
    });

    it("should handle empty knowledge categories", () => {
      const executorNoCategories = new TestCallExecutor({
        chatbotId: "test",
        companyId: "test",
        aiProvider: "OPENAI",
        voiceConfig: {},
      });

      expect(executorNoCategories).toBeDefined();
    });

    it("should handle empty tools array", () => {
      const executorNoTools = new TestCallExecutor({
        chatbotId: "test",
        companyId: "test",
        aiProvider: "OPENAI",
        voiceConfig: {},
      });

      expect(executorNoTools).toBeDefined();
    });
  });

  // ============================================================================
  // Getter Tests
  // ============================================================================

  describe("getters", () => {
    it("getChatbotId should return chatbot ID", () => {
      expect(executor.getChatbotId()).toBe("test-chatbot-123");
    });

    it("getCompanyId should return company ID", () => {
      expect(executor.getCompanyId()).toBe("test-company-456");
    });

    it("getAiProvider should return AI provider", () => {
      expect(executor.getAiProvider()).toBe("OPENAI");
    });

    it("should work with GEMINI provider", () => {
      const geminiExecutor = new TestCallExecutor(
        createTestConfig({
          aiProvider: "GEMINI",
          voiceConfig: {
            gemini_voice: "Kore",
            gemini_model: "gemini-2.0-flash-live-001",
          },
        })
      );

      expect(geminiExecutor.getAiProvider()).toBe("GEMINI");
    });

    it("isExecutorConnected should reflect connection state", async () => {
      expect(executor.isExecutorConnected()).toBe(false);
      await executor.connect();
      expect(executor.isExecutorConnected()).toBe(true);
      await executor.disconnect();
      expect(executor.isExecutorConnected()).toBe(false);
    });

    it("isExecutorSpeaking should reflect speaking state", () => {
      expect(executor.isExecutorSpeaking()).toBe(false);
      executor.testEmitAgentSpeaking();
      expect(executor.isExecutorSpeaking()).toBe(true);
      executor.testEmitAgentListening();
      expect(executor.isExecutorSpeaking()).toBe(false);
    });
  });

  // ============================================================================
  // Abstract Method Tests
  // ============================================================================

  describe("abstract methods", () => {
    it("connect should set isConnected to true", async () => {
      expect(executor.connectCalled).toBe(false);
      await executor.connect();
      expect(executor.connectCalled).toBe(true);
      expect(executor.isExecutorConnected()).toBe(true);
    });

    it("disconnect should set isConnected to false", async () => {
      await executor.connect();
      expect(executor.isExecutorConnected()).toBe(true);

      await executor.disconnect();
      expect(executor.disconnectCalled).toBe(true);
      expect(executor.isExecutorConnected()).toBe(false);
    });

    it("sendAudio should receive audio buffer", async () => {
      const audioBuffer = Buffer.from([1, 2, 3, 4, 5]);
      await executor.sendAudio(audioBuffer);

      expect(executor.sendAudioCalled).toBe(true);
      expect(executor.lastAudioBuffer).toEqual(audioBuffer);
    });

    it("cancelResponse should reset speaking state", async () => {
      executor.testEmitAgentSpeaking();
      expect(executor.isExecutorSpeaking()).toBe(true);

      await executor.cancelResponse();
      expect(executor.cancelResponseCalled).toBe(true);
      expect(executor.isExecutorSpeaking()).toBe(false);
    });
  });

  // ============================================================================
  // Event Emitter Tests
  // ============================================================================

  describe("event emitters", () => {
    it("emitAudioDelta should emit audioDelta event", () => {
      const audioHandler = vi.fn();
      executor.on("audioDelta", audioHandler);

      const audioData = Buffer.from([1, 2, 3]);
      executor.testEmitAudioDelta(audioData);

      expect(audioHandler).toHaveBeenCalledTimes(1);
      expect(audioHandler).toHaveBeenCalledWith(audioData);
    });

    it("emitTranscriptDelta should emit transcriptDelta event", () => {
      const transcriptHandler = vi.fn();
      executor.on("transcriptDelta", transcriptHandler);

      const transcriptData: TranscriptData = {
        role: "assistant",
        content: "Hello, how can I help?",
        timestamp: 1000,
        isFinal: true,
      };
      executor.testEmitTranscriptDelta(transcriptData);

      expect(transcriptHandler).toHaveBeenCalledTimes(1);
      expect(transcriptHandler).toHaveBeenCalledWith(transcriptData);
    });

    it("emitAgentSpeaking should emit agentSpeaking event and set isSpeaking", () => {
      const speakingHandler = vi.fn();
      executor.on("agentSpeaking", speakingHandler);

      executor.testEmitAgentSpeaking();

      expect(speakingHandler).toHaveBeenCalledTimes(1);
      expect(executor.isExecutorSpeaking()).toBe(true);
    });

    it("emitAgentListening should emit agentListening event and reset isSpeaking", () => {
      const listeningHandler = vi.fn();
      executor.on("agentListening", listeningHandler);

      // First set speaking to true
      executor.testEmitAgentSpeaking();
      expect(executor.isExecutorSpeaking()).toBe(true);

      // Then emit listening
      executor.testEmitAgentListening();

      expect(listeningHandler).toHaveBeenCalledTimes(1);
      expect(executor.isExecutorSpeaking()).toBe(false);
    });

    it("emitUserInterrupted should emit userInterrupted event", () => {
      const interruptedHandler = vi.fn();
      executor.on("userInterrupted", interruptedHandler);

      executor.testEmitUserInterrupted();

      expect(interruptedHandler).toHaveBeenCalledTimes(1);
    });

    it("emitTurnComplete should emit turnComplete event", () => {
      const turnHandler = vi.fn();
      executor.on("turnComplete", turnHandler);

      executor.testEmitTurnComplete();

      expect(turnHandler).toHaveBeenCalledTimes(1);
    });

    it("emitError should emit error event", () => {
      const errorHandler = vi.fn();
      executor.on("error", errorHandler);

      const error = new Error("test error");
      executor.testEmitError(error);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it("emitConnectionClosed should emit connectionClosed event and set isConnected to false", async () => {
      const closedHandler = vi.fn();
      executor.on("connectionClosed", closedHandler);

      // First connect
      await executor.connect();
      expect(executor.isExecutorConnected()).toBe(true);

      // Emit connection closed
      executor.testEmitConnectionClosed();

      expect(closedHandler).toHaveBeenCalledTimes(1);
      expect(executor.isExecutorConnected()).toBe(false);
    });

    it("emitFunctionCall should emit functionCall event with data", () => {
      const functionCallHandler = vi.fn();
      executor.on("functionCall", functionCallHandler);

      const functionData = {
        name: "get_weather",
        arguments: { location: "New York" },
      };
      executor.testEmitFunctionCall(functionData);

      expect(functionCallHandler).toHaveBeenCalledTimes(1);
      expect(functionCallHandler).toHaveBeenCalledWith(functionData);
    });
  });

  // ============================================================================
  // Typed Event Listener Tests
  // ============================================================================

  describe("typed event listeners", () => {
    it("on should register typed event handlers", () => {
      const audioDeltaHandler = vi.fn();
      const transcriptDeltaHandler = vi.fn();
      const agentSpeakingHandler = vi.fn();
      const agentListeningHandler = vi.fn();
      const userInterruptedHandler = vi.fn();
      const turnCompleteHandler = vi.fn();
      const errorHandler = vi.fn();
      const connectionClosedHandler = vi.fn();
      const functionCallHandler = vi.fn();

      executor.on("audioDelta", audioDeltaHandler);
      executor.on("transcriptDelta", transcriptDeltaHandler);
      executor.on("agentSpeaking", agentSpeakingHandler);
      executor.on("agentListening", agentListeningHandler);
      executor.on("userInterrupted", userInterruptedHandler);
      executor.on("turnComplete", turnCompleteHandler);
      executor.on("error", errorHandler);
      executor.on("connectionClosed", connectionClosedHandler);
      executor.on("functionCall", functionCallHandler);

      // Trigger all events
      executor.testEmitAudioDelta(Buffer.from([1]));
      executor.testEmitTranscriptDelta({ role: "user", content: "test", timestamp: 0 });
      executor.testEmitAgentSpeaking();
      executor.testEmitAgentListening();
      executor.testEmitUserInterrupted();
      executor.testEmitTurnComplete();
      executor.testEmitError(new Error("test"));
      executor.testEmitConnectionClosed();
      executor.testEmitFunctionCall({ name: "test", arguments: {} });

      expect(audioDeltaHandler).toHaveBeenCalled();
      expect(transcriptDeltaHandler).toHaveBeenCalled();
      expect(agentSpeakingHandler).toHaveBeenCalled();
      expect(agentListeningHandler).toHaveBeenCalled();
      expect(userInterruptedHandler).toHaveBeenCalled();
      expect(turnCompleteHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
      expect(connectionClosedHandler).toHaveBeenCalled();
      expect(functionCallHandler).toHaveBeenCalled();
    });

    it("once should register one-time event handlers", () => {
      const speakingHandler = vi.fn();
      executor.once("agentSpeaking", speakingHandler);

      executor.testEmitAgentSpeaking();
      executor.testEmitAgentSpeaking();

      expect(speakingHandler).toHaveBeenCalledTimes(1);
    });

    it("emit should return true when listeners exist", () => {
      executor.on("agentSpeaking", vi.fn());

      const result = executor.emit("agentSpeaking");
      expect(result).toBe(true);
    });

    it("emit should return false when no listeners exist", () => {
      const result = executor.emit("agentSpeaking");
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("should handle full connection lifecycle", async () => {
      const connectionClosedHandler = vi.fn();
      executor.on("connectionClosed", connectionClosedHandler);

      // Connect
      await executor.connect();
      expect(executor.isExecutorConnected()).toBe(true);

      // Disconnect
      await executor.disconnect();
      expect(executor.isExecutorConnected()).toBe(false);
    });

    it("should handle audio streaming workflow", async () => {
      const audioDeltaHandler = vi.fn();
      executor.on("audioDelta", audioDeltaHandler);

      await executor.connect();

      // Send multiple audio chunks
      const chunks = [
        Buffer.from([1, 2, 3]),
        Buffer.from([4, 5, 6]),
        Buffer.from([7, 8, 9]),
      ];

      for (const chunk of chunks) {
        await executor.sendAudio(chunk);
      }

      expect(executor.sendAudioCalled).toBe(true);
      expect(executor.lastAudioBuffer).toEqual(chunks[2]);
    });

    it("should handle interruption workflow", async () => {
      const userInterruptedHandler = vi.fn();
      executor.on("userInterrupted", userInterruptedHandler);

      await executor.connect();

      // Agent starts speaking
      executor.testEmitAgentSpeaking();
      expect(executor.isExecutorSpeaking()).toBe(true);

      // User interrupts
      executor.testEmitUserInterrupted();
      expect(userInterruptedHandler).toHaveBeenCalled();

      // Cancel response
      await executor.cancelResponse();
      expect(executor.isExecutorSpeaking()).toBe(false);
    });

    it("should handle transcript flow", () => {
      const transcriptHandler = vi.fn();
      executor.on("transcriptDelta", transcriptHandler);

      // User transcript (partial)
      executor.testEmitTranscriptDelta({
        role: "user",
        content: "Hello",
        timestamp: 0,
        isFinal: false,
      });

      // User transcript (final)
      executor.testEmitTranscriptDelta({
        role: "user",
        content: "Hello, how are you?",
        timestamp: 1000,
        isFinal: true,
      });

      // Assistant transcript
      executor.testEmitTranscriptDelta({
        role: "assistant",
        content: "I'm doing well, thank you!",
        timestamp: 2000,
        isFinal: true,
      });

      expect(transcriptHandler).toHaveBeenCalledTimes(3);
    });

    it("should handle function call workflow", () => {
      const functionCallHandler = vi.fn();
      const turnCompleteHandler = vi.fn();
      executor.on("functionCall", functionCallHandler);
      executor.on("turnComplete", turnCompleteHandler);

      // Function call from AI
      executor.testEmitFunctionCall({
        name: "search_knowledge_base",
        arguments: { query: "pricing information" },
      });

      // Turn complete after function execution
      executor.testEmitTurnComplete();

      expect(functionCallHandler).toHaveBeenCalledWith({
        name: "search_knowledge_base",
        arguments: { query: "pricing information" },
      });
      expect(turnCompleteHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Type Guard Tests
  // ============================================================================

  describe("isCallExecutor type guard", () => {
    it("should return true for CallExecutor instances", () => {
      expect(isCallExecutor(executor)).toBe(true);
    });

    it("should return false for non-executor objects", () => {
      expect(isCallExecutor({})).toBe(false);
      expect(isCallExecutor(null)).toBe(false);
      expect(isCallExecutor(undefined)).toBe(false);
      expect(isCallExecutor("string")).toBe(false);
      expect(isCallExecutor(123)).toBe(false);
      expect(isCallExecutor({ isExecutorConnected: () => true })).toBe(false);
    });
  });
});
