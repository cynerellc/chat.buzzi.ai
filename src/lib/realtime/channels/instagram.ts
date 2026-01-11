/**
 * Instagram Direct Channel Adapter
 *
 * Handles Instagram Direct Messages via Meta Graph API.
 * Uses the Instagram Messaging API (similar to Messenger).
 */

import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// Instagram Types
// ============================================================================

interface InstagramWebhook {
  object: string;
  entry?: Array<{
    id: string;
    time: number;
    messaging?: Array<InstagramMessagingEvent>;
  }>;
}

interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: InstagramMessage;
  reaction?: { mid: string; action: "react" | "unreact"; reaction?: string };
  read?: { mid: string };
}

interface InstagramMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: "image" | "video" | "audio" | "file" | "share" | "story_mention";
    payload: {
      url?: string;
      reel_video_id?: string;
    };
  }>;
  reply_to?: { mid: string };
  is_echo?: boolean;
  is_deleted?: boolean;
}

// ============================================================================
// Instagram Adapter
// ============================================================================

export class InstagramAdapter extends BaseChannelAdapter {
  readonly channel = "instagram" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    const webhook = payload as InstagramWebhook;

    // Only handle Instagram events
    if (webhook.object !== "instagram") {
      return null;
    }

    const entry = webhook.entry?.[0];
    const messaging = entry?.messaging?.[0];

    // Skip if no message or if it's an echo/deleted message
    if (!messaging?.message || messaging.message.is_echo || messaging.message.is_deleted) {
      return null;
    }

    const message = messaging.message;

    // Parse attachments
    const attachments: MessageAttachment[] = [];
    let content = message.text ?? "";
    let contentType: UnifiedMessage["contentType"] = "text";

    if (message.attachments) {
      for (const attachment of message.attachments) {
        switch (attachment.type) {
          case "image":
            contentType = "image";
            if (attachment.payload.url) {
              attachments.push({
                type: "image",
                url: attachment.payload.url,
                mimeType: "image/jpeg",
              });
            }
            break;

          case "video":
            contentType = "video";
            if (attachment.payload.url) {
              attachments.push({
                type: "video",
                url: attachment.payload.url,
                mimeType: "video/mp4",
              });
            }
            break;

          case "audio":
            contentType = "audio";
            if (attachment.payload.url) {
              attachments.push({
                type: "audio",
                url: attachment.payload.url,
                mimeType: "audio/mpeg",
              });
            }
            break;

          case "share":
          case "story_mention":
            // Handle shared posts or story mentions
            content = content || "[Shared content]";
            break;
        }
      }
    }

    return {
      externalId: message.mid,
      senderId: messaging.sender.id,
      content,
      contentType,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(messaging.timestamp),
      replyToId: message.reply_to?.mid,
      channelMetadata: {
        recipientId: messaging.recipient.id,
      },
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: SendOptions
  ): Promise<void> {
    const { accessToken, instagramAccountId } = config.credentials as {
      accessToken: string;
      instagramAccountId: string;
    };

    const body = {
      recipient: { id: recipientId },
      message: { text: content },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/messages?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram API error: ${JSON.stringify(error)}`);
    }
  }

  async sendMediaMessage(
    config: ChannelConfig,
    recipientId: string,
    mediaUrl: string,
    mediaType: "image" | "audio" | "video" | "document",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _caption?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: SendOptions
  ): Promise<void> {
    const { accessToken, instagramAccountId } = config.credentials as {
      accessToken: string;
      instagramAccountId: string;
    };

    // Instagram only supports image and video in DMs
    if (mediaType !== "image" && mediaType !== "video") {
      // For unsupported types, send as a link
      await this.sendMessage(config, recipientId, `File: ${mediaUrl}`);
      return;
    }

    const body = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: mediaType,
          payload: {
            url: mediaUrl,
          },
        },
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/messages?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram API error: ${JSON.stringify(error)}`);
    }
  }

  async downloadMedia(_config: ChannelConfig, mediaUrl: string): Promise<Buffer> {
    // Instagram attachment URLs are directly accessible
    const response = await fetch(mediaUrl);

    if (!response.ok) {
      throw new Error("Failed to download media from Instagram");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  validateSignature(
    payload: string,
    signature: string | null,
    secret: string
  ): boolean {
    if (!signature) return false;

    const expectedSignature = this.createHmacSignature(payload, secret);
    return `sha256=${expectedSignature}` === signature;
  }

  handleVerification(
    searchParams: URLSearchParams,
    verifyToken: string
  ): Response | null {
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  /**
   * Send ice breaker buttons (conversation starters)
   */
  async sendIceBreakers(
    config: ChannelConfig,
    iceBreakers: Array<{ question: string; payload: string }>
  ): Promise<void> {
    const { accessToken, instagramAccountId } = config.credentials as {
      accessToken: string;
      instagramAccountId: string;
    };

    const body = {
      platform: "instagram",
      ice_breakers: iceBreakers.map((ib) => ({
        call_to_actions: [
          {
            type: "postback",
            title: ib.question,
            payload: ib.payload,
          },
        ],
      })),
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/messenger_profile?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram API error: ${JSON.stringify(error)}`);
    }
  }

  /**
   * React to a message
   */
  async reactToMessage(
    config: ChannelConfig,
    recipientId: string,
    messageId: string,
    reaction: string
  ): Promise<void> {
    const { accessToken, instagramAccountId } = config.credentials as {
      accessToken: string;
      instagramAccountId: string;
    };

    const body = {
      recipient: { id: recipientId },
      sender_action: "react",
      payload: {
        message_id: messageId,
        reaction,
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/messages?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram API error: ${JSON.stringify(error)}`);
    }
  }
}

// Export singleton
export const instagramAdapter = new InstagramAdapter();
