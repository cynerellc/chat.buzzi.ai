/**
 * Call Feature Types Unit Tests
 *
 * Tests for custom error classes and type definitions.
 */

import { describe, expect, it } from "vitest";
import { CallError, ExecutorError, HandlerError } from "../../types";

// ============================================================================
// CallError Tests
// ============================================================================

describe("CallError", () => {
  it("should create error with message and code", () => {
    const error = new CallError("Call failed", "CALL_FAILED");

    expect(error.message).toBe("Call failed");
    expect(error.code).toBe("CALL_FAILED");
    expect(error.name).toBe("CallError");
    expect(error.callId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it("should create error with all properties", () => {
    const details = { reason: "timeout", attempts: 3 };
    const error = new CallError("Call timeout", "CALL_TIMEOUT", "call-123", details);

    expect(error.message).toBe("Call timeout");
    expect(error.code).toBe("CALL_TIMEOUT");
    expect(error.name).toBe("CallError");
    expect(error.callId).toBe("call-123");
    expect(error.details).toEqual(details);
  });

  it("should be an instance of Error", () => {
    const error = new CallError("Test error", "TEST");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CallError);
  });

  it("should have proper stack trace", () => {
    const error = new CallError("Test error", "TEST");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("CallError");
  });

  it("should handle various error codes", () => {
    const codes = [
      "CALL_NOT_FOUND",
      "CALL_ALREADY_ENDED",
      "CALL_DISABLED",
      "INVALID_SESSION",
      "CONNECTION_ERROR",
      "AUDIO_ERROR",
    ];

    codes.forEach((code) => {
      const error = new CallError(`Error: ${code}`, code);
      expect(error.code).toBe(code);
    });
  });
});

// ============================================================================
// ExecutorError Tests
// ============================================================================

describe("ExecutorError", () => {
  it("should create error with message and code", () => {
    const error = new ExecutorError("Executor failed", "EXECUTOR_FAILED");

    expect(error.message).toBe("Executor failed");
    expect(error.code).toBe("EXECUTOR_FAILED");
    expect(error.name).toBe("ExecutorError");
    expect(error.chatbotId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it("should create error with all properties", () => {
    const details = { provider: "openai", retries: 2 };
    const error = new ExecutorError("Connection failed", "CONNECTION_FAILED", "chatbot-456", details);

    expect(error.message).toBe("Connection failed");
    expect(error.code).toBe("CONNECTION_FAILED");
    expect(error.name).toBe("ExecutorError");
    expect(error.chatbotId).toBe("chatbot-456");
    expect(error.details).toEqual(details);
  });

  it("should be an instance of Error", () => {
    const error = new ExecutorError("Test error", "TEST");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ExecutorError);
  });

  it("should have proper stack trace", () => {
    const error = new ExecutorError("Test error", "TEST");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ExecutorError");
  });

  it("should handle various error codes", () => {
    const codes = [
      "EXECUTOR_NOT_FOUND",
      "EXECUTOR_DISCONNECTED",
      "INVALID_CONFIG",
      "API_ERROR",
      "RATE_LIMITED",
      "AUDIO_FORMAT_ERROR",
    ];

    codes.forEach((code) => {
      const error = new ExecutorError(`Error: ${code}`, code);
      expect(error.code).toBe(code);
    });
  });
});

// ============================================================================
// HandlerError Tests
// ============================================================================

describe("HandlerError", () => {
  it("should create error with message and code", () => {
    const error = new HandlerError("Handler failed", "HANDLER_FAILED");

    expect(error.message).toBe("Handler failed");
    expect(error.code).toBe("HANDLER_FAILED");
    expect(error.name).toBe("HandlerError");
    expect(error.sessionId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it("should create error with all properties", () => {
    const details = { handlerType: "websocket", clientInfo: "Chrome" };
    const error = new HandlerError("WebSocket error", "WEBSOCKET_ERROR", "session-789", details);

    expect(error.message).toBe("WebSocket error");
    expect(error.code).toBe("WEBSOCKET_ERROR");
    expect(error.name).toBe("HandlerError");
    expect(error.sessionId).toBe("session-789");
    expect(error.details).toEqual(details);
  });

  it("should be an instance of Error", () => {
    const error = new HandlerError("Test error", "TEST");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HandlerError);
  });

  it("should have proper stack trace", () => {
    const error = new HandlerError("Test error", "TEST");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("HandlerError");
  });

  it("should handle various error codes", () => {
    const codes = [
      "HANDLER_NOT_FOUND",
      "HANDLER_DISCONNECTED",
      "INVALID_MESSAGE",
      "SEND_FAILED",
      "PARSE_ERROR",
      "TIMEOUT_ERROR",
    ];

    codes.forEach((code) => {
      const error = new HandlerError(`Error: ${code}`, code);
      expect(error.code).toBe(code);
    });
  });
});

// ============================================================================
// Error Differentiation Tests
// ============================================================================

describe("Error type differentiation", () => {
  it("should differentiate between error types", () => {
    const callError = new CallError("Call error", "CALL_ERROR");
    const executorError = new ExecutorError("Executor error", "EXECUTOR_ERROR");
    const handlerError = new HandlerError("Handler error", "HANDLER_ERROR");

    expect(callError).toBeInstanceOf(CallError);
    expect(callError).not.toBeInstanceOf(ExecutorError);
    expect(callError).not.toBeInstanceOf(HandlerError);

    expect(executorError).not.toBeInstanceOf(CallError);
    expect(executorError).toBeInstanceOf(ExecutorError);
    expect(executorError).not.toBeInstanceOf(HandlerError);

    expect(handlerError).not.toBeInstanceOf(CallError);
    expect(handlerError).not.toBeInstanceOf(ExecutorError);
    expect(handlerError).toBeInstanceOf(HandlerError);
  });

  it("should allow catching by specific type", () => {
    const errors = [
      new CallError("Call error", "CALL_ERROR"),
      new ExecutorError("Executor error", "EXECUTOR_ERROR"),
      new HandlerError("Handler error", "HANDLER_ERROR"),
    ];

    let callErrorCount = 0;
    let executorErrorCount = 0;
    let handlerErrorCount = 0;

    errors.forEach((error) => {
      if (error instanceof CallError) callErrorCount++;
      if (error instanceof ExecutorError) executorErrorCount++;
      if (error instanceof HandlerError) handlerErrorCount++;
    });

    expect(callErrorCount).toBe(1);
    expect(executorErrorCount).toBe(1);
    expect(handlerErrorCount).toBe(1);
  });

  it("should all be instances of base Error", () => {
    const errors = [
      new CallError("Call error", "CALL_ERROR"),
      new ExecutorError("Executor error", "EXECUTOR_ERROR"),
      new HandlerError("Handler error", "HANDLER_ERROR"),
    ];

    errors.forEach((error) => {
      expect(error).toBeInstanceOf(Error);
    });
  });
});

// ============================================================================
// Error Serialization Tests
// ============================================================================

describe("Error serialization", () => {
  it("should serialize CallError to JSON-like structure", () => {
    const error = new CallError("Test error", "TEST_CODE", "call-123", { extra: "data" });

    const serialized = {
      name: error.name,
      message: error.message,
      code: error.code,
      callId: error.callId,
      details: error.details,
    };

    expect(serialized).toEqual({
      name: "CallError",
      message: "Test error",
      code: "TEST_CODE",
      callId: "call-123",
      details: { extra: "data" },
    });
  });

  it("should serialize ExecutorError to JSON-like structure", () => {
    const error = new ExecutorError("Test error", "TEST_CODE", "chatbot-456", { provider: "openai" });

    const serialized = {
      name: error.name,
      message: error.message,
      code: error.code,
      chatbotId: error.chatbotId,
      details: error.details,
    };

    expect(serialized).toEqual({
      name: "ExecutorError",
      message: "Test error",
      code: "TEST_CODE",
      chatbotId: "chatbot-456",
      details: { provider: "openai" },
    });
  });

  it("should serialize HandlerError to JSON-like structure", () => {
    const error = new HandlerError("Test error", "TEST_CODE", "session-789", { type: "websocket" });

    const serialized = {
      name: error.name,
      message: error.message,
      code: error.code,
      sessionId: error.sessionId,
      details: error.details,
    };

    expect(serialized).toEqual({
      name: "HandlerError",
      message: "Test error",
      code: "TEST_CODE",
      sessionId: "session-789",
      details: { type: "websocket" },
    });
  });
});
