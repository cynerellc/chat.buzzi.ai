/**
 * Instagram Channel Adapter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { instagramAdapter, InstagramAdapter } from "@/lib/realtime/channels/instagram";

describe("InstagramAdapter", () => {
  let adapter: InstagramAdapter;

  beforeEach(() => {
    adapter = new InstagramAdapter();
  });

  describe("parseMessage", () => {
    it("returns null for non-instagram objects", async () => {
      const payload = {
        object: "page",
        entry: [],
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null when no messaging entry", async () => {
      const payload = {
        object: "instagram",
        entry: [{ id: "123", time: Date.now() }],
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null for echo messages", async () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  text: "Echo message",
                  is_echo: true,
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null for deleted messages", async () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  text: "Deleted",
                  is_deleted: true,
                },
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
        object: "instagram",
        entry: [
          {
            id: "123",
            time: timestamp,
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp,
                message: {
                  mid: "mid.123",
                  text: "Hello from Instagram",
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result).not.toBeNull();
      expect(result?.senderId).toBe("user123");
      expect(result?.content).toBe("Hello from Instagram");
      expect(result?.externalId).toBe("mid.123");
      expect(result?.contentType).toBe("text");
    });

    it("parses message with image attachment", async () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "image",
                      payload: {
                        url: "https://cdn.instagram.com/image.jpg",
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
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "video",
                      payload: {
                        url: "https://cdn.instagram.com/video.mp4",
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

    it("parses message with share attachment", async () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "share",
                      payload: {},
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.content).toBe("[Shared content]");
    });

    it("parses message with story mention", async () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.123",
                  attachments: [
                    {
                      type: "story_mention",
                      payload: {},
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.content).toBe("[Shared content]");
    });

    it("parses message with reply_to", async () => {
      const payload = {
        object: "instagram",
        entry: [
          {
            id: "123",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "user123" },
                recipient: { id: "ig123" },
                timestamp: Date.now(),
                message: {
                  mid: "mid.456",
                  text: "Reply to story",
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
      expect(instagramAdapter).toBeInstanceOf(InstagramAdapter);
      expect(instagramAdapter.channel).toBe("instagram");
    });
  });
});
