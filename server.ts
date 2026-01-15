/**
 * Custom Server for Next.js with WebSocket Support
 *
 * This server enables WebSocket connections for the call feature alongside
 * the standard Next.js HTTP server. Next.js doesn't natively support
 * WebSocket upgrades, so we use a custom server.
 *
 * Usage:
 *   Development: pnpm dev
 *   Production: pnpm start:server
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables BEFORE any other imports
// This must happen synchronously before dynamic imports
function loadEnvFile(filePath: string): void {
  const fullPath = resolve(process.cwd(), filePath);
  if (!existsSync(fullPath)) return;

  const content = readFileSync(fullPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Don't override existing env vars
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Load .env files in order (like Next.js does)
loadEnvFile(".env");
loadEnvFile(".env.local");

// Now we can safely do dynamic imports that depend on env vars
async function startServer() {
  const { createServer } = await import("http");
  const { parse } = await import("url");
  const next = (await import("next")).default;
  const { createCallWebSocketServers } = await import(
    "./src/lib/call/server/websocket-server"
  );

  const dev = process.env.NODE_ENV !== "production";
  const hostname = process.env.HOSTNAME || "localhost";
  const port = parseInt(process.env.PORT || "3000", 10);

  try {
    // Create Next.js app
    const app = next({ dev, hostname, port });
    const handle = app.getRequestHandler();

    // Prepare Next.js
    await app.prepare();

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url || "", true);
        await handle(req, res, parsedUrl);
      } catch (error) {
        console.error("[Server] Error handling request:", error);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    // Create WebSocket servers with noServer mode and handle upgrades manually
    const { wss, twilioWss } = createCallWebSocketServers();
    console.log(`[Server] WebSocket servers created for call audio streaming`);

    // Handle upgrade requests manually to prevent Next.js interference
    server.on("upgrade", (request, socket, head) => {
      const pathname = request.url?.split("?")[0] || "";

      if (pathname === "/api/widget/call/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else if (pathname === "/api/widget/call/twilio/stream") {
        twilioWss.handleUpgrade(request, socket, head, (ws) => {
          twilioWss.emit("connection", ws, request);
        });
      } else {
        // Not a call WebSocket - destroy the socket
        socket.destroy();
      }
    });

    // Start listening
    server.listen(port, () => {
      console.log(`[Server] Ready on http://${hostname}:${port}`);
      console.log(
        `[Server] WebSocket available at ws://${hostname}:${port}/api/widget/call/ws`
      );
      console.log(`[Server] Environment: ${dev ? "development" : "production"}`);
    });

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`[Server] Port ${port} is already in use`);
      } else {
        console.error("[Server] Server error:", error);
      }
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log("[Server] Shutting down gracefully...");
      wss.close(() => {
        console.log("[Server] WebSocket server closed");
        server.close(() => {
          console.log("[Server] HTTP server closed");
          process.exit(0);
        });
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error("[Server] Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

startServer();
