/**
 * Slack Channel Adapter
 *
 * Handles Slack App/Bot integration.
 * Parses incoming events and sends messages via Slack Web API.
 */

import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// Slack Types
// ============================================================================

interface SlackEvent {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  type: string;
  // URL verification challenge
  challenge?: string;
  // Event callback
  event?: SlackMessageEvent;
  event_id?: string;
  event_time?: number;
}

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  channel: string;
  channel_type?: string;
  thread_ts?: string;
  // File attachments
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    filetype: string;
    url_private: string;
    url_private_download: string;
  }>;
  // Blocks for rich formatting
  blocks?: unknown[];
}

interface SlackUserInfo {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
    email?: string;
  };
}

// ============================================================================
// Slack Adapter
// ============================================================================

export class SlackAdapter extends BaseChannelAdapter {
  readonly channel = "slack" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    const event = payload as SlackEvent;

    // Handle URL verification (Slack setup)
    if (event.type === "url_verification") {
      return null; // Handled separately
    }

    // Only process message events
    if (event.type !== "event_callback" || !event.event) {
      return null;
    }

    const messageEvent = event.event;

    // Skip bot messages, message changes, deletions, etc.
    if (
      messageEvent.type !== "message" ||
      messageEvent.subtype ||
      messageEvent.bot_id
    ) {
      return null;
    }

    // Parse attachments
    const attachments: MessageAttachment[] = [];
    if (messageEvent.files) {
      for (const file of messageEvent.files) {
        let type: "image" | "audio" | "video" | "document" = "document";
        if (file.mimetype.startsWith("image/")) type = "image";
        else if (file.mimetype.startsWith("audio/")) type = "audio";
        else if (file.mimetype.startsWith("video/")) type = "video";

        attachments.push({
          type,
          url: file.url_private_download,
          mimeType: file.mimetype,
          filename: file.name,
        });
      }
    }

    const firstAttachment = attachments[0];
    const contentType: UnifiedMessage["contentType"] =
      firstAttachment && firstAttachment.type !== "document"
        ? firstAttachment.type
        : "text";

    return {
      externalId: messageEvent.ts,
      senderId: messageEvent.user ?? "unknown",
      content: messageEvent.text ?? "",
      contentType,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(parseFloat(messageEvent.ts) * 1000),
      replyToId: messageEvent.thread_ts,
      channelMetadata: {
        channelId: messageEvent.channel,
        channelType: messageEvent.channel_type,
        threadTs: messageEvent.thread_ts,
      },
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void> {
    const { botToken } = config.credentials as { botToken: string };

    const body: Record<string, unknown> = {
      channel: recipientId,
      text: content,
    };

    // Reply in thread if replying
    if (options?.replyToId) {
      body.thread_ts = options.replyToId;
    }

    // Parse mode support
    if (options?.parseMode === "markdown") {
      body.mrkdwn = true;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
  }

  async sendMediaMessage(
    config: ChannelConfig,
    recipientId: string,
    mediaUrl: string,
    mediaType: "image" | "audio" | "video" | "document",
    caption?: string,
    options?: SendOptions
  ): Promise<void> {
    const { botToken } = config.credentials as { botToken: string };

    // Slack handles media through blocks
    const blocks = [];

    if (mediaType === "image") {
      blocks.push({
        type: "image",
        image_url: mediaUrl,
        alt_text: caption ?? "Image",
      });
    } else {
      // For non-image files, we need to upload them
      // For now, send as a link
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: caption ? `${caption}\n<${mediaUrl}|Download file>` : `<${mediaUrl}|Download file>`,
        },
      });
    }

    const body: Record<string, unknown> = {
      channel: recipientId,
      blocks,
      text: caption ?? "Shared a file",
    };

    if (options?.replyToId) {
      body.thread_ts = options.replyToId;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
  }

  async downloadMedia(config: ChannelConfig, mediaUrl: string): Promise<Buffer> {
    const { botToken } = config.credentials as { botToken: string };

    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${botToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to download file from Slack");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  validateSignature(
    payload: string,
    signature: string | null,
    secret: string,
    timestamp?: string
  ): boolean {
    if (!signature || !timestamp) return false;

    // Slack signature format: v0=hash
    const sigBasestring = `v0:${timestamp}:${payload}`;
    const expectedSignature = this.createHmacSignature(sigBasestring, secret);
    return `v0=${expectedSignature}` === signature;
  }

  /**
   * Handle verification - Slack uses body-based verification, not URL params
   * This method is kept for interface compatibility but Slack verification
   * should use handleSlackChallenge instead
   */
  handleVerification(
    _searchParams: URLSearchParams,
    _verifyToken: string
  ): Response | null {
    // Slack doesn't use URL-based verification
    return null;
  }

  /**
   * Handle Slack URL verification challenge
   * Call this with the parsed request body for Slack event subscriptions
   */
  handleSlackChallenge(payload: SlackEvent): Response | null {
    if (payload.type === "url_verification" && payload.challenge) {
      return new Response(
        JSON.stringify({ challenge: payload.challenge }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return null;
  }

  /**
   * Get user info from Slack
   */
  async getUserInfo(config: ChannelConfig, userId: string): Promise<SlackUserInfo | null> {
    const { botToken } = config.credentials as { botToken: string };

    const response = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      {
        headers: { Authorization: `Bearer ${botToken}` },
      }
    );

    const result = await response.json();
    if (!result.ok) {
      return null;
    }

    return result.user;
  }

  /**
   * Add reaction to a message
   */
  async addReaction(
    config: ChannelConfig,
    channel: string,
    timestamp: string,
    emoji: string
  ): Promise<void> {
    const { botToken } = config.credentials as { botToken: string };

    const response = await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        timestamp,
        name: emoji,
      }),
    });

    const result = await response.json();
    if (!result.ok && result.error !== "already_reacted") {
      throw new Error(`Slack API error: ${result.error}`);
    }
  }
}

// Export singleton
export const slackAdapter = new SlackAdapter();
