/**
 * Slack Channel Adapter Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { slackAdapter, SlackAdapter } from "@/lib/realtime/channels/slack";

describe("SlackAdapter", () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter();
  });

  describe("parseMessage", () => {
    it("returns null for url_verification events", async () => {
      const payload = {
        type: "url_verification",
        challenge: "test-challenge",
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null for non-event_callback types", async () => {
      const payload = {
        type: "some_other_type",
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null for bot messages", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          bot_id: "B123456",
          text: "Bot message",
          ts: "1234567890.123456",
          channel: "C123456",
        },
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("returns null for message subtypes", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          subtype: "message_changed",
          text: "Edited message",
          ts: "1234567890.123456",
          channel: "C123456",
        },
      };

      const result = await adapter.parseMessage(payload);
      expect(result).toBeNull();
    });

    it("parses valid user message", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          user: "U123456",
          text: "Hello world",
          ts: "1234567890.123456",
          channel: "C123456",
          channel_type: "channel",
        },
      };

      const result = await adapter.parseMessage(payload);

      expect(result).not.toBeNull();
      expect(result?.senderId).toBe("U123456");
      expect(result?.content).toBe("Hello world");
      expect(result?.externalId).toBe("1234567890.123456");
      expect(result?.contentType).toBe("text");
      expect(result?.channelMetadata?.channelId).toBe("C123456");
    });

    it("parses message with thread_ts as replyToId", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          user: "U123456",
          text: "Thread reply",
          ts: "1234567890.123456",
          channel: "C123456",
          thread_ts: "1234567880.000000",
        },
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.replyToId).toBe("1234567880.000000");
    });

    it("parses message with image attachment", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          user: "U123456",
          text: "",
          ts: "1234567890.123456",
          channel: "C123456",
          files: [
            {
              id: "F123",
              name: "image.png",
              mimetype: "image/png",
              filetype: "png",
              url_private: "https://files.slack.com/image.png",
              url_private_download: "https://files.slack.com/image.png?download=1",
            },
          ],
        },
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.contentType).toBe("image");
      expect(result?.attachments).toHaveLength(1);
      expect(result?.attachments?.[0]?.type).toBe("image");
      expect(result?.attachments?.[0]?.mimeType).toBe("image/png");
    });

    it("parses message with video attachment", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          user: "U123456",
          text: "",
          ts: "1234567890.123456",
          channel: "C123456",
          files: [
            {
              id: "F123",
              name: "video.mp4",
              mimetype: "video/mp4",
              filetype: "mp4",
              url_private: "https://files.slack.com/video.mp4",
              url_private_download: "https://files.slack.com/video.mp4?download=1",
            },
          ],
        },
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.contentType).toBe("video");
      expect(result?.attachments?.[0]?.type).toBe("video");
    });

    it("parses message with document attachment", async () => {
      const payload = {
        type: "event_callback",
        event: {
          type: "message",
          user: "U123456",
          text: "",
          ts: "1234567890.123456",
          channel: "C123456",
          files: [
            {
              id: "F123",
              name: "document.pdf",
              mimetype: "application/pdf",
              filetype: "pdf",
              url_private: "https://files.slack.com/doc.pdf",
              url_private_download: "https://files.slack.com/doc.pdf?download=1",
            },
          ],
        },
      };

      const result = await adapter.parseMessage(payload);

      expect(result?.contentType).toBe("text");
      expect(result?.attachments?.[0]?.type).toBe("document");
    });
  });

  describe("handleSlackChallenge", () => {
    it("returns challenge response for url_verification", () => {
      const payload = {
        type: "url_verification",
        challenge: "test-challenge-123",
      };

      const response = adapter.handleSlackChallenge(payload);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
    });

    it("returns null for non-verification events", () => {
      const payload = {
        type: "event_callback",
        event: { type: "message", ts: "123", channel: "C123" },
      };

      const response = adapter.handleSlackChallenge(payload);
      expect(response).toBeNull();
    });
  });

  describe("handleVerification", () => {
    it("returns null (Slack uses body verification)", () => {
      const searchParams = new URLSearchParams();
      const response = adapter.handleVerification(searchParams, "token");
      expect(response).toBeNull();
    });
  });

  describe("validateSignature", () => {
    it("returns false when signature is missing", () => {
      const result = adapter.validateSignature("payload", null, "secret");
      expect(result).toBe(false);
    });

    it("returns false when timestamp is missing", () => {
      const result = adapter.validateSignature("payload", "v0=sig", "secret");
      expect(result).toBe(false);
    });

    it("validates correct signature format", () => {
      const payload = "test payload";
      const timestamp = "1234567890";
      const secret = "test-secret";

      // The signature validation should use the format v0:timestamp:payload
      const result = adapter.validateSignature(payload, "v0=invalid", secret, timestamp);
      expect(result).toBe(false);
    });
  });

  describe("singleton export", () => {
    it("exports a singleton instance", () => {
      expect(slackAdapter).toBeInstanceOf(SlackAdapter);
      expect(slackAdapter.channel).toBe("slack");
    });
  });
});
