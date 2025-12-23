/**
 * WhatsApp Channel Adapter
 *
 * Handles WhatsApp Business API integration.
 * Parses incoming webhooks and sends messages via Meta Graph API.
 */

import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// WhatsApp Types
// ============================================================================

interface WhatsAppWebhook {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<WhatsAppMessage>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "contacts" | "interactive";
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  context?: { id: string; from: string };
}

// ============================================================================
// WhatsApp Adapter
// ============================================================================

export class WhatsAppAdapter extends BaseChannelAdapter {
  readonly channel = "whatsapp" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    const webhook = payload as WhatsAppWebhook;

    // Extract message from webhook payload
    const entry = webhook.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Skip status updates
    if (value?.statuses) {
      return null;
    }

    const message = value?.messages?.[0];
    if (!message) {
      return null;
    }

    const contact = value?.contacts?.[0];

    // Handle different message types
    let content = "";
    let contentType: UnifiedMessage["contentType"] = "text";
    const attachments: MessageAttachment[] = [];

    switch (message.type) {
      case "text":
        content = message.text?.body ?? "";
        break;

      case "image":
        contentType = "image";
        content = message.image?.caption ?? "";
        if (message.image) {
          attachments.push({
            type: "image",
            mediaId: message.image.id,
            mimeType: message.image.mime_type,
          });
        }
        break;

      case "audio":
        contentType = "audio";
        if (message.audio) {
          attachments.push({
            type: "audio",
            mediaId: message.audio.id,
            mimeType: message.audio.mime_type,
          });
        }
        break;

      case "video":
        contentType = "video";
        content = message.video?.caption ?? "";
        if (message.video) {
          attachments.push({
            type: "video",
            mediaId: message.video.id,
            mimeType: message.video.mime_type,
          });
        }
        break;

      case "document":
        contentType = "document";
        content = message.document?.caption ?? "";
        if (message.document) {
          attachments.push({
            type: "document",
            mediaId: message.document.id,
            mimeType: message.document.mime_type,
            filename: message.document.filename,
          });
        }
        break;

      case "location":
        contentType = "location";
        if (message.location) {
          content = message.location.name ??
            `Location: ${message.location.latitude}, ${message.location.longitude}`;
        }
        break;

      default:
        content = "[Unsupported message type]";
    }

    return {
      externalId: message.id,
      senderId: message.from,
      senderName: contact?.profile?.name,
      content,
      contentType,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      replyToId: message.context?.id,
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void> {
    const { phoneNumberId, accessToken } = config.credentials as {
      phoneNumberId: string;
      accessToken: string;
    };

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientId,
      type: "text",
      text: { body: content },
    };

    // Add reply context if replying
    if (options?.replyToId) {
      body.context = { message_id: options.replyToId };
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
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
    const { phoneNumberId, accessToken } = config.credentials as {
      phoneNumberId: string;
      accessToken: string;
    };

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientId,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl,
        ...(caption ? { caption } : {}),
      },
    };

    if (options?.replyToId) {
      body.context = { message_id: options.replyToId };
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }
  }

  async downloadMedia(config: ChannelConfig, mediaId: string): Promise<Buffer> {
    const { accessToken } = config.credentials as { accessToken: string };

    // 1. Get media URL
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!mediaResponse.ok) {
      throw new Error("Failed to get media URL");
    }

    const { url } = await mediaResponse.json();

    // 2. Download media
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error("Failed to download media");
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
}

// Export singleton
export const whatsappAdapter = new WhatsAppAdapter();
