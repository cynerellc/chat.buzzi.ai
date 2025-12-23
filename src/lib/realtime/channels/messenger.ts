/**
 * Facebook Messenger Channel Adapter
 *
 * Handles Facebook Messenger integration via Meta Graph API.
 * Similar to WhatsApp but with Messenger-specific features.
 */

import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// Messenger Types
// ============================================================================

interface MessengerWebhook {
  object: string;
  entry?: Array<{
    id: string;
    time: number;
    messaging?: Array<MessengerMessagingEvent>;
  }>;
}

interface MessengerMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: MessengerMessage;
  postback?: { title: string; payload: string };
  read?: { watermark: number };
  delivery?: { watermark: number; mids?: string[] };
}

interface MessengerMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: "image" | "audio" | "video" | "file" | "location" | "fallback";
    payload: {
      url?: string;
      coordinates?: { lat: number; long: number };
      sticker_id?: number;
    };
  }>;
  quick_reply?: { payload: string };
  reply_to?: { mid: string };
}

interface MessengerUserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
}

// ============================================================================
// Messenger Adapter
// ============================================================================

export class MessengerAdapter extends BaseChannelAdapter {
  readonly channel = "messenger" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    const webhook = payload as MessengerWebhook;

    // Only handle page events
    if (webhook.object !== "page") {
      return null;
    }

    const entry = webhook.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging?.message) {
      return null; // Skip deliveries, reads, postbacks for now
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

          case "file":
            if (attachment.payload.url) {
              attachments.push({
                type: "document",
                url: attachment.payload.url,
                mimeType: "application/octet-stream",
              });
            }
            break;

          case "location":
            contentType = "location";
            if (attachment.payload.coordinates) {
              content = `Location: ${attachment.payload.coordinates.lat}, ${attachment.payload.coordinates.long}`;
            }
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
    options?: SendOptions
  ): Promise<void> {
    const { pageAccessToken } = config.credentials as { pageAccessToken: string };

    const body: Record<string, unknown> = {
      messaging_type: "RESPONSE",
      recipient: { id: recipientId },
      message: { text: content },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Messenger API error: ${JSON.stringify(error)}`);
    }
  }

  async sendMediaMessage(
    config: ChannelConfig,
    recipientId: string,
    mediaUrl: string,
    mediaType: "image" | "audio" | "video" | "document",
    _caption?: string,
    _options?: SendOptions
  ): Promise<void> {
    const { pageAccessToken } = config.credentials as { pageAccessToken: string };

    // Map to Messenger attachment types
    const typeMap: Record<string, string> = {
      image: "image",
      audio: "audio",
      video: "video",
      document: "file",
    };

    const body: Record<string, unknown> = {
      messaging_type: "RESPONSE",
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: typeMap[mediaType] ?? "file",
          payload: {
            url: mediaUrl,
            is_reusable: true,
          },
        },
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Messenger API error: ${JSON.stringify(error)}`);
    }
  }

  async downloadMedia(config: ChannelConfig, mediaUrl: string): Promise<Buffer> {
    const { pageAccessToken } = config.credentials as { pageAccessToken: string };

    // Messenger attachment URLs are already accessible
    const response = await fetch(mediaUrl);

    if (!response.ok) {
      throw new Error("Failed to download media from Messenger");
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
   * Get user profile from Messenger
   */
  async getUserProfile(
    config: ChannelConfig,
    userId: string
  ): Promise<MessengerUserProfile | null> {
    const { pageAccessToken } = config.credentials as { pageAccessToken: string };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${userId}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(
    config: ChannelConfig,
    recipientId: string,
    isTyping: boolean
  ): Promise<void> {
    const { pageAccessToken } = config.credentials as { pageAccessToken: string };

    const body = {
      recipient: { id: recipientId },
      sender_action: isTyping ? "typing_on" : "typing_off",
    };

    await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Send quick reply buttons
   */
  async sendQuickReplies(
    config: ChannelConfig,
    recipientId: string,
    text: string,
    quickReplies: Array<{ title: string; payload: string }>
  ): Promise<void> {
    const { pageAccessToken } = config.credentials as { pageAccessToken: string };

    const body = {
      messaging_type: "RESPONSE",
      recipient: { id: recipientId },
      message: {
        text,
        quick_replies: quickReplies.map((qr) => ({
          content_type: "text",
          title: qr.title,
          payload: qr.payload,
        })),
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Messenger API error: ${JSON.stringify(error)}`);
    }
  }
}

// Export singleton
export const messengerAdapter = new MessengerAdapter();
