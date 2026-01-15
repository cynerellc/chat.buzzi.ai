/**
 * WebSocket Server for Call Audio Streaming
 *
 * This module provides a WebSocket server for handling real-time audio
 * streaming for voice calls. It runs alongside the Next.js server.
 *
 * Usage:
 *   import { createCallWebSocketServer } from '@/lib/call/server/websocket-server';
 *
 *   // In custom server (server.ts):
 *   const httpServer = createServer(handler);
 *   createCallWebSocketServer(httpServer);
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { URL } from "url";

import { getCallRunner } from "../execution/call-runner";
import { getCallSessionManager } from "../execution/call-session-manager";
import { WebSocketCallHandler } from "../handlers/websocket-call-handler";
import { TwilioCallHandler } from "../handlers/twilio-call-handler";

// ============================================================================
// Types
// ============================================================================

interface WebSocketConnection {
  ws: WebSocket;
  sessionId: string;
  handler: WebSocketCallHandler;
}

interface TwilioConnection {
  ws: WebSocket;
  sessionId: string;
  handler: TwilioCallHandler;
}

// ============================================================================
// WebSocket Server
// ============================================================================

const connections = new Map<string, WebSocketConnection>();
const twilioConnections = new Map<string, TwilioConnection>();

/**
 * Create WebSocket servers for call audio streaming
 * Returns servers in noServer mode for manual upgrade handling
 */
export function createCallWebSocketServers(): { wss: WebSocketServer; twilioWss: WebSocketServer } {
  // Main WebSocket server for browser clients (noServer mode)
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false, // Disable compression for compatibility
  });

  console.log("[CallWebSocket] WebSocket server created on path: /api/widget/call/ws");

  wss.on("connection", async (ws: WebSocket, request: IncomingMessage) => {
    try {
      await handleConnection(ws, request);
    } catch (error) {
      console.error("[CallWebSocket] Connection error:", error);
      ws.close(1011, "Internal server error");
    }
  });

  wss.on("error", (error) => {
    console.error("[CallWebSocket] Server error:", error);
  });

  // Cleanup on server close
  wss.on("close", () => {
    console.log("[CallWebSocket] Server closing, cleaning up connections...");
    for (const [sessionId, conn] of connections) {
      conn.handler.end("Server shutdown");
      connections.delete(sessionId);
    }
  });

  // Twilio Media Streams WebSocket server (noServer mode)
  const twilioWss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false, // Disable compression for compatibility
  });

  console.log("[CallWebSocket] Twilio WebSocket server created on path: /api/widget/call/twilio/stream");

  twilioWss.on("connection", async (ws: WebSocket, request: IncomingMessage) => {
    try {
      await handleTwilioConnection(ws, request);
    } catch (error) {
      console.error("[CallWebSocket] Twilio connection error:", error);
      ws.close(1011, "Internal server error");
    }
  });

  twilioWss.on("error", (error) => {
    console.error("[CallWebSocket] Twilio server error:", error);
  });

  twilioWss.on("close", () => {
    console.log("[CallWebSocket] Twilio server closing, cleaning up connections...");
    for (const [sessionId, conn] of twilioConnections) {
      conn.handler.end("Server shutdown");
      twilioConnections.delete(sessionId);
    }
  });

  return { wss, twilioWss };
}

/**
 * Create WebSocket server for call audio streaming (legacy, attaches to server)
 * @deprecated Use createCallWebSocketServers() with manual upgrade handling
 */
export function createCallWebSocketServer(server: Server): WebSocketServer {
  const { wss } = createCallWebSocketServers();
  // Note: This function is deprecated but kept for backwards compatibility
  // The noServer approach prevents Next.js from interfering with WebSocket upgrades
  return wss;
}

/**
 * Handle new WebSocket connection
 */
async function handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
  // Extract sessionId from query string
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    console.error("[CallWebSocket] No sessionId provided");
    ws.close(4000, "Missing sessionId");
    return;
  }

  console.log(`[CallWebSocket] New connection for session: ${sessionId}`);

  // Validate session exists
  const sessionManager = getCallSessionManager();
  const session = await sessionManager.getSession(sessionId);

  if (!session) {
    console.error(`[CallWebSocket] Session not found: ${sessionId}`);
    ws.close(4001, "Session not found");
    return;
  }

  // Check if session is already connected
  if (connections.has(sessionId)) {
    console.error(`[CallWebSocket] Session already connected: ${sessionId}`);
    ws.close(4002, "Session already connected");
    return;
  }

  // Create handler
  const handler = new WebSocketCallHandler(ws, sessionId, session.callId);

  // Store connection
  connections.set(sessionId, { ws, sessionId, handler });

  // Start handler
  await handler.start();

  // Wire up handler to CallRunnerService
  const callRunner = getCallRunner();

  // When handler receives audio from client, start the call if not started
  handler.once("callStarted", async () => {
    try {
      await callRunner.startCall(sessionId, handler);
      console.log(`[CallWebSocket] Call started for session: ${sessionId}`);
    } catch (error) {
      console.error(`[CallWebSocket] Failed to start call:`, error);
      handler.end("Failed to start call");
    }
  });

  // Handle connection close
  ws.on("close", () => {
    console.log(`[CallWebSocket] Connection closed for session: ${sessionId}`);
    connections.delete(sessionId);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`[CallWebSocket] Connection error for session ${sessionId}:`, error);
    connections.delete(sessionId);
  });
}

/**
 * Handle new Twilio WebSocket connection
 */
async function handleTwilioConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
  // Extract sessionId from query string
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    console.error("[CallWebSocket] No sessionId provided for Twilio connection");
    ws.close(4000, "Missing sessionId");
    return;
  }

  console.log(`[CallWebSocket] New Twilio connection for session: ${sessionId}`);

  // Validate session exists
  const sessionManager = getCallSessionManager();
  const session = await sessionManager.getSession(sessionId);

  if (!session) {
    console.error(`[CallWebSocket] Session not found: ${sessionId}`);
    ws.close(4001, "Session not found");
    return;
  }

  // Check if session is already connected
  if (twilioConnections.has(sessionId)) {
    console.error(`[CallWebSocket] Twilio session already connected: ${sessionId}`);
    ws.close(4002, "Session already connected");
    return;
  }

  // Determine AI provider sample rate from session
  const aiProviderSampleRate = session.aiProvider === "GEMINI" ? 16000 : 24000;

  // Create Twilio handler
  const handler = new TwilioCallHandler(ws, sessionId, session.callId, aiProviderSampleRate);

  // Store connection
  twilioConnections.set(sessionId, { ws, sessionId, handler });

  // Start handler
  await handler.start();

  // Wire up handler to CallRunnerService
  const callRunner = getCallRunner();

  // When Twilio stream starts, start the call with AI provider
  handler.once("callStarted", async () => {
    try {
      await callRunner.startCall(sessionId, handler);
      console.log(`[CallWebSocket] Twilio call started for session: ${sessionId}`);
    } catch (error) {
      console.error(`[CallWebSocket] Failed to start Twilio call:`, error);
      handler.end("Failed to start call");
    }
  });

  // Handle connection close
  ws.on("close", () => {
    console.log(`[CallWebSocket] Twilio connection closed for session: ${sessionId}`);
    twilioConnections.delete(sessionId);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`[CallWebSocket] Twilio connection error for session ${sessionId}:`, error);
    twilioConnections.delete(sessionId);
  });
}

/**
 * Get active connection count
 */
export function getActiveConnectionCount(): number {
  return connections.size;
}

/**
 * Get connection for session
 */
export function getConnection(sessionId: string): WebSocketConnection | undefined {
  return connections.get(sessionId);
}

/**
 * Close connection for session (browser WebSocket)
 */
export function closeConnection(sessionId: string, reason?: string): void {
  const conn = connections.get(sessionId);
  if (conn) {
    conn.handler.end(reason || "Connection closed");
    conn.ws.close();
    connections.delete(sessionId);
  }
}

/**
 * Get active Twilio connection count
 */
export function getActiveTwilioConnectionCount(): number {
  return twilioConnections.size;
}

/**
 * Get Twilio connection for session
 */
export function getTwilioConnection(sessionId: string): TwilioConnection | undefined {
  return twilioConnections.get(sessionId);
}

/**
 * Close Twilio connection for session
 */
export function closeTwilioConnection(sessionId: string, reason?: string): void {
  const conn = twilioConnections.get(sessionId);
  if (conn) {
    conn.handler.end(reason || "Connection closed");
    conn.ws.close();
    twilioConnections.delete(sessionId);
  }
}

/**
 * Close any connection (browser or Twilio) for session
 */
export function closeAnyConnection(sessionId: string, reason?: string): void {
  closeConnection(sessionId, reason);
  closeTwilioConnection(sessionId, reason);
}
