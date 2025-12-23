/**
 * Channel Adapter Interface
 *
 * Defines the interface for channel-specific adapters.
 * Each channel (WhatsApp, Telegram, etc.) implements this interface
 * to provide a unified way to handle incoming and outgoing messages.
 */

import crypto from "crypto";
import type {
  UnifiedMessage,
  ChannelConfig,
  SendOptions,
  ChannelType,
} from "../types";

// ============================================================================
// Channel Adapter Interface
// ============================================================================

export interface ChannelAdapter {
  /**
   * The channel type this adapter handles
   */
  readonly channel: ChannelType;

  /**
   * Parse incoming webhook payload to unified message format
   * Returns null for non-message events (e.g., status updates)
   */
  parseMessage(payload: unknown): Promise<UnifiedMessage | null>;

  /**
   * Send a message to the channel
   */
  sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void>;

  /**
   * Send a message with an attachment
   */
  sendMediaMessage?(
    config: ChannelConfig,
    recipientId: string,
    mediaUrl: string,
    mediaType: "image" | "audio" | "video" | "document",
    caption?: string,
    options?: SendOptions
  ): Promise<void>;

  /**
   * Download media from the channel
   */
  downloadMedia?(config: ChannelConfig, mediaId: string): Promise<Buffer>;

  /**
   * Validate webhook signature
   */
  validateSignature(
    payload: string,
    signature: string | null,
    secret: string
  ): boolean;

  /**
   * Handle webhook verification request (for channels that require it)
   */
  handleVerification?(
    searchParams: URLSearchParams,
    verifyToken: string
  ): Response | null;
}

// ============================================================================
// Base Adapter Class
// ============================================================================

export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract readonly channel: ChannelType;

  abstract parseMessage(payload: unknown): Promise<UnifiedMessage | null>;

  abstract sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void>;

  abstract validateSignature(
    payload: string,
    signature: string | null,
    secret: string
  ): boolean;

  /**
   * Default: no verification needed
   */
  handleVerification(
    _searchParams: URLSearchParams,
    _verifyToken: string
  ): Response | null {
    return null;
  }

  /**
   * Default: media download not supported
   */
  async downloadMedia(_config: ChannelConfig, _mediaId: string): Promise<Buffer> {
    throw new Error(`Media download not supported for ${this.channel}`);
  }

  /**
   * Helper to create HMAC-SHA256 signature
   */
  protected createHmacSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }
}
