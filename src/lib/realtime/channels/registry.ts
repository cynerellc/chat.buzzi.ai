/**
 * Channel Registry
 *
 * Central registry for all channel adapters.
 * Provides a unified interface to get the appropriate adapter for a channel.
 */

import type { ChannelAdapter } from "./adapter";
import type { ChannelType } from "../types";
import { whatsappAdapter } from "./whatsapp";
import { telegramAdapter } from "./telegram";
import { slackAdapter } from "./slack";
import { messengerAdapter } from "./messenger";
import { instagramAdapter } from "./instagram";

// ============================================================================
// Registry
// ============================================================================

const adapters: Record<string, ChannelAdapter> = {
  whatsapp: whatsappAdapter,
  telegram: telegramAdapter,
  slack: slackAdapter,
  messenger: messengerAdapter,
  instagram: instagramAdapter,
  // Custom adapters can be registered at runtime
};

/**
 * Get the adapter for a specific channel
 */
export function getChannelAdapter(channel: ChannelType): ChannelAdapter {
  const adapter = adapters[channel];
  if (!adapter) {
    throw new Error(`No adapter available for channel: ${channel}`);
  }
  return adapter;
}

/**
 * Check if an adapter is available for a channel
 */
export function hasChannelAdapter(channel: ChannelType): boolean {
  return channel in adapters;
}

/**
 * Get all available channel types
 */
export function getAvailableChannels(): ChannelType[] {
  return Object.keys(adapters) as ChannelType[];
}

/**
 * Register a custom channel adapter
 */
export function registerChannelAdapter(
  channel: ChannelType,
  adapter: ChannelAdapter
): void {
  adapters[channel] = adapter;
}

// ============================================================================
// Exports
// ============================================================================

export { whatsappAdapter } from "./whatsapp";
export { telegramAdapter } from "./telegram";
export { slackAdapter } from "./slack";
export { messengerAdapter } from "./messenger";
export { instagramAdapter } from "./instagram";
export type { ChannelAdapter } from "./adapter";
