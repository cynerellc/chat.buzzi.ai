/**
 * Channel Registry Tests
 */

import { describe, it, expect } from "vitest";
import {
  getChannelAdapter,
  hasChannelAdapter,
  getAvailableChannels,
  whatsappAdapter,
  telegramAdapter,
  slackAdapter,
  messengerAdapter,
  instagramAdapter,
} from "@/lib/realtime/channels/registry";

describe("Channel Registry", () => {
  describe("getChannelAdapter", () => {
    it("returns whatsapp adapter", () => {
      const adapter = getChannelAdapter("whatsapp");
      expect(adapter).toBe(whatsappAdapter);
      expect(adapter.channel).toBe("whatsapp");
    });

    it("returns telegram adapter", () => {
      const adapter = getChannelAdapter("telegram");
      expect(adapter).toBe(telegramAdapter);
      expect(adapter.channel).toBe("telegram");
    });

    it("returns slack adapter", () => {
      const adapter = getChannelAdapter("slack");
      expect(adapter).toBe(slackAdapter);
      expect(adapter.channel).toBe("slack");
    });

    it("returns messenger adapter", () => {
      const adapter = getChannelAdapter("messenger");
      expect(adapter).toBe(messengerAdapter);
      expect(adapter.channel).toBe("messenger");
    });

    it("returns instagram adapter", () => {
      const adapter = getChannelAdapter("instagram");
      expect(adapter).toBe(instagramAdapter);
      expect(adapter.channel).toBe("instagram");
    });

    it("throws error for unknown channel", () => {
      expect(() => getChannelAdapter("unknown" as never)).toThrow(
        "No adapter available for channel: unknown"
      );
    });
  });

  describe("hasChannelAdapter", () => {
    it("returns true for registered channels", () => {
      expect(hasChannelAdapter("whatsapp")).toBe(true);
      expect(hasChannelAdapter("telegram")).toBe(true);
      expect(hasChannelAdapter("slack")).toBe(true);
      expect(hasChannelAdapter("messenger")).toBe(true);
      expect(hasChannelAdapter("instagram")).toBe(true);
    });

    it("returns false for unregistered channels", () => {
      expect(hasChannelAdapter("unknown" as never)).toBe(false);
    });
  });

  describe("getAvailableChannels", () => {
    it("returns all registered channels", () => {
      const channels = getAvailableChannels();

      expect(channels).toContain("whatsapp");
      expect(channels).toContain("telegram");
      expect(channels).toContain("slack");
      expect(channels).toContain("messenger");
      expect(channels).toContain("instagram");
      expect(channels.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("adapter exports", () => {
    it("exports all adapters", () => {
      expect(whatsappAdapter).toBeDefined();
      expect(telegramAdapter).toBeDefined();
      expect(slackAdapter).toBeDefined();
      expect(messengerAdapter).toBeDefined();
      expect(instagramAdapter).toBeDefined();
    });
  });
});
