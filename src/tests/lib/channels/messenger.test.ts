/**
 * Messenger Channel Adapter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { messengerAdapter, MessengerAdapter } from "@/lib/realtime/channels/messenger";

describe("MessengerAdapter", () => {
  let adapter: MessengerAdapter;

  beforeEach(() => {
    adapter = new MessengerAdapter();
  });

  describe("parseMessage", () => {
    it("returns null for non-page objects", async () => {
      const payload = {
        object: "instagram",
        entry: [],
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null when no messaging entry", async () => {
      const payload = {
        object: "page",
        entry: [{ id: "123", time: Date.now() }],
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null when no message in messaging", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "page123" },
                timestamp: Date.now(),
                delivery: { watermark: 123 },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("parses valid text message", async () => {
      const timestamp = Date.now();
      const payload = {
        object: "page",
        entry: [
          {
            id: "123",
            time: timestamp,
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "page123" },
                timestamp,
                message: {
                  mid: "mid.123",
                  text: "Hello from Messenger",
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result).not.toBeNull();
      expect(result?.senderId).toBe("user123");
      expect(result?.content).toBe("Hello from Messenger");
      expect(result?.externalId).toBe("mid.123");
      expect(result?.contentType).toBe("text");
    });

    it("parses message with image attachment", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "page123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "image",
                      payload: {
                        url: "https://cdn.example.com/image.jpg",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.contentType).toBe("image");
      expect(result?.attachments).toHaveLength(1);
      expect(result?.attachments?.[0]?.type).toBe("image");
    });

    it("parses message with video attachment", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "page123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "video",
                      payload: {
                        url: "https://cdn.example.com/video.mp4",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.contentType).toBe("video");
      expect(result?.attachments?.[0]?.type).toBe("video");
    });

    it("parses message with location attachment", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "page123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "location",
                      payload: {
                        coordinates: { lat: 37.7749, long: -122.4194 },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.contentType).toBe("location");
      expect(result?.content).toContain("37.7749");
    });

    it("parses message with reply_to", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "page123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.456",
                  text: "Reply message",
                  reply_to: { mid: "mid.123" },
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.replyToId).toBe("mid.123");
    });
  });

  describe("handleVerification", () => {
    it("returns challenge when valid", () => {
      const searchParams = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": "test-token",
        "hub.challenge": "challenge-123",
      });

      const response = adapter.handleVerification(searchParams, "test-token");

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
    });

    it("returns 403 when token mismatch", () => {
      const searchParams = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "challenge-123",
      });

      const response = adapter.handleVerification(searchParams, "test-token");

      expect(response?.status).toBe(403);
    });

    it("returns 403 when mode is not subscribe", () => {
      const searchParams = new URLSearchParams({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "test-token",
        "hub.challenge": "challenge-123",
      });

      const response = adapter.handleVerification(searchParams, "test-token");

      expect(response?.status).toBe(403);
    });
  });

  describe("validateSignature", () => {
    it("returns false when signature is missing", () => {
      const result = adapter.validateSignature("payload", null, "secret");
      expect(result).toBe(false);
    });

    it("validates signature format", () => {
      const result = adapter.validateSignature("payload", "sha256=invalid", "secret");
      expect(result).toBe(false);
    });
  });

  describe("singleton export", () => {
    it("exports a singleton instance", () => {
      expect(messengerAdapter).toBeInstanceOf(MessengerAdapter);
      expect(messengerAdapter.channel).toBe("messenger");
    });
  });
});
