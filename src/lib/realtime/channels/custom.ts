/**
 * Custom Webhook Channel Adapter
 *
 * Generic webhook adapter for custom integrations.
 * Provides a flexible interface for connecting arbitrary systems
 * with configurable message parsing and delivery.
 */

import { createHmac } from "crypto";
import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// Custom Webhook Types
// ============================================================================

/**
 * Standard incoming webhook payload structure
 * Integrations should conform to this format
 */
export interface CustomWebhookPayload {
  // Message identification
  messageId: string;
  senderId: string;
  senderName?: string;

  // Content
  content: string;
  contentType?: "text" | "image" | "audio" | "video" | "document" | "location";

  // Attachments
  attachments?: Array<{
    type: "image" | "audio" | "video" | "document";
    url?: string;
    mimeType: string;
    filename?: string;
    size?: number;
  }>;

  // Threading
  replyToId?: string;

  // Timestamp (ISO 8601 or Unix epoch ms)
  timestamp?: string | number;

  // Custom metadata
  metadata?: Record<string, unknown>;

  // Event type for non-message events
  eventType?: "message" | "typing" | "read" | "delivered" | "presence";
}

/**
 * Configuration for custom webhook response format
 */
export interface CustomWebhookConfig {
  // Response field mapping
  responseFormat?: {
    contentField?: string;
    attachmentsField?: string;
    metadataField?: string;
  };

  // Authentication
  auth?: {
    type: "header" | "query" | "body" | "bearer";
    headerName?: string;
    paramName?: string;
  };

  // Request customization
  headers?: Record<string, string>;
}

// ============================================================================
// Custom Webhook Adapter
// ============================================================================

export class CustomWebhookAdapter extends BaseChannelAdapter {
  readonly channel = "custom" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    // Try to parse as standard format
    const webhookPayload = this.normalizePayload(payload);

    // Skip non-message events
    if (webhookPayload.eventType && webhookPayload.eventType !== "message") {
      return null;
    }

    // Validate required fields
    if (!webhookPayload.messageId || !webhookPayload.senderId) {
      console.warn("Custom webhook: Missing required fields (messageId, senderId)");
      return null;
    }

    // Parse attachments
    const attachments: MessageAttachment[] = [];
    if (webhookPayload.attachments) {
      for (const att of webhookPayload.attachments) {
        attachments.push({
          type: att.type,
          url: att.url,
          mimeType: att.mimeType,
          filename: att.filename,
          size: att.size,
        });
      }
    }

    // Parse timestamp
    let timestamp: Date;
    if (typeof webhookPayload.timestamp === "number") {
      // Unix epoch milliseconds
      timestamp = new Date(webhookPayload.timestamp);
    } else if (typeof webhookPayload.timestamp === "string") {
      // ISO 8601
      timestamp = new Date(webhookPayload.timestamp);
    } else {
      timestamp = new Date();
    }

    return {
      externalId: webhookPayload.messageId,
      senderId: webhookPayload.senderId,
      senderName: webhookPayload.senderName,
      content: webhookPayload.content ?? "",
      contentType: webhookPayload.contentType ?? "text",
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp,
      replyToId: webhookPayload.replyToId,
      channelMetadata: webhookPayload.metadata,
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void> {
    const webhookConfig = config.credentials.webhookConfig as CustomWebhookConfig | undefined;
    const webhookUrl = config.credentials.responseWebhookUrl as string;

    if (!webhookUrl) {
      throw new Error("Custom webhook: responseWebhookUrl not configured");
    }

    // Build request body based on config
    const body = this.buildRequestBody(
      recipientId,
      content,
      undefined,
      options,
      webhookConfig
    );

    // Build headers
    const headers = this.buildHeaders(config, webhookConfig);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom webhook error: ${response.status} - ${errorText}`);
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
    const webhookConfig = config.credentials.webhookConfig as CustomWebhookConfig | undefined;
    const webhookUrl = config.credentials.responseWebhookUrl as string;

    if (!webhookUrl) {
      throw new Error("Custom webhook: responseWebhookUrl not configured");
    }

    const attachment: MessageAttachment = {
      type: mediaType,
      url: mediaUrl,
      mimeType: this.getMimeType(mediaType),
    };

    const body = this.buildRequestBody(
      recipientId,
      caption ?? "",
      [attachment],
      options,
      webhookConfig
    );

    const headers = this.buildHeaders(config, webhookConfig);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom webhook error: ${response.status} - ${errorText}`);
    }
  }

  validateSignature(
    payload: string,
    signature: string | null,
    secret: string
  ): boolean {
    if (!signature) return false;

    // Support multiple signature formats
    // Format 1: sha256=<hash>
    if (signature.startsWith("sha256=")) {
      const expectedSignature = this.createHmacSignature(payload, secret);
      return `sha256=${expectedSignature}` === signature;
    }

    // Format 2: sha1=<hash>
    if (signature.startsWith("sha1=")) {
      const expectedSignature = createHmac("sha1", secret)
        .update(payload)
        .digest("hex");
      return `sha1=${expectedSignature}` === signature;
    }

    // Format 3: Raw HMAC-SHA256 hex
    const expectedSignature = this.createHmacSignature(payload, secret);
    return expectedSignature === signature;
  }

  /**
   * Normalize various payload formats to standard format
   */
  private normalizePayload(payload: unknown): CustomWebhookPayload {
    const raw = payload as Record<string, unknown>;

    // Check for common field patterns and map to standard format
    return {
      // Message ID variations
      messageId: (raw.messageId ?? raw.message_id ?? raw.id ?? raw.msgId) as string,

      // Sender variations
      senderId: (raw.senderId ?? raw.sender_id ?? raw.from ?? raw.userId ?? raw.user_id) as string,
      senderName: (raw.senderName ?? raw.sender_name ?? raw.from_name ?? raw.userName ?? raw.user_name) as string | undefined,

      // Content variations
      content: (raw.content ?? raw.text ?? raw.message ?? raw.body ?? "") as string,
      contentType: this.normalizeContentType(raw.contentType ?? raw.content_type ?? raw.type),

      // Attachments variations
      attachments: this.normalizeAttachments(raw.attachments ?? raw.files ?? raw.media),

      // Threading
      replyToId: (raw.replyToId ?? raw.reply_to_id ?? raw.reply_to ?? raw.in_reply_to) as string | undefined,

      // Timestamp variations
      timestamp: (raw.timestamp ?? raw.created_at ?? raw.createdAt ?? raw.time ?? raw.date) as string | number | undefined,

      // Metadata
      metadata: (raw.metadata ?? raw.custom ?? raw.extra) as Record<string, unknown> | undefined,

      // Event type
      eventType: this.normalizeEventType(raw.eventType ?? raw.event_type ?? raw.event ?? raw.action),
    };
  }

  /**
   * Normalize content type field
   */
  private normalizeContentType(
    type: unknown
  ): "text" | "image" | "audio" | "video" | "document" | "location" {
    if (typeof type !== "string") return "text";

    const normalized = type.toLowerCase();
    if (["image", "photo", "picture"].includes(normalized)) return "image";
    if (["audio", "voice", "sound"].includes(normalized)) return "audio";
    if (["video", "movie"].includes(normalized)) return "video";
    if (["document", "file", "doc"].includes(normalized)) return "document";
    if (["location", "geo", "coordinates"].includes(normalized)) return "location";
    return "text";
  }

  /**
   * Normalize attachments array
   */
  private normalizeAttachments(attachments: unknown): CustomWebhookPayload["attachments"] {
    if (!Array.isArray(attachments)) return undefined;

    return attachments.map((att: Record<string, unknown>) => ({
      type: this.normalizeAttachmentType(att.type ?? att.contentType ?? att.content_type),
      url: (att.url ?? att.link ?? att.src) as string | undefined,
      mimeType: (att.mimeType ?? att.mime_type ?? att.contentType ?? "application/octet-stream") as string,
      filename: (att.filename ?? att.file_name ?? att.name) as string | undefined,
      size: (att.size ?? att.fileSize ?? att.file_size) as number | undefined,
    }));
  }

  /**
   * Normalize attachment type
   */
  private normalizeAttachmentType(type: unknown): "image" | "audio" | "video" | "document" {
    if (typeof type !== "string") return "document";

    const normalized = type.toLowerCase();
    if (normalized.includes("image") || normalized.includes("photo")) return "image";
    if (normalized.includes("audio") || normalized.includes("voice")) return "audio";
    if (normalized.includes("video")) return "video";
    return "document";
  }

  /**
   * Normalize event type
   */
  private normalizeEventType(
    type: unknown
  ): "message" | "typing" | "read" | "delivered" | "presence" | undefined {
    if (typeof type !== "string") return undefined;

    const normalized = type.toLowerCase();
    if (["message", "msg", "chat"].includes(normalized)) return "message";
    if (["typing", "composing"].includes(normalized)) return "typing";
    if (["read", "seen"].includes(normalized)) return "read";
    if (["delivered", "sent"].includes(normalized)) return "delivered";
    if (["presence", "status", "online"].includes(normalized)) return "presence";
    return "message";
  }

  /**
   * Build request body for outgoing webhook
   */
  private buildRequestBody(
    recipientId: string,
    content: string,
    attachments?: MessageAttachment[],
    options?: SendOptions,
    webhookConfig?: CustomWebhookConfig
  ): Record<string, unknown> {
    const format = webhookConfig?.responseFormat;

    const body: Record<string, unknown> = {
      recipientId,
      [format?.contentField ?? "content"]: content,
      timestamp: Date.now(),
    };

    if (attachments && attachments.length > 0) {
      body[format?.attachmentsField ?? "attachments"] = attachments;
    }

    if (options?.replyToId) {
      body.replyToId = options.replyToId;
    }

    if (options?.metadata) {
      body[format?.metadataField ?? "metadata"] = options.metadata;
    }

    return body;
  }

  /**
   * Build headers for outgoing webhook
   */
  private buildHeaders(
    config: ChannelConfig,
    webhookConfig?: CustomWebhookConfig
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...webhookConfig?.headers,
    };

    // Add authentication
    const auth = webhookConfig?.auth;
    if (auth) {
      const apiKey = config.credentials.apiKey as string | undefined;

      switch (auth.type) {
        case "header":
          if (apiKey && auth.headerName) {
            headers[auth.headerName] = apiKey;
          }
          break;
        case "bearer":
          if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }
          break;
      }
    }

    return headers;
  }

  /**
   * Get default MIME type for media type
   */
  private getMimeType(mediaType: "image" | "audio" | "video" | "document"): string {
    const mimeTypes: Record<string, string> = {
      image: "image/jpeg",
      audio: "audio/mpeg",
      video: "video/mp4",
      document: "application/octet-stream",
    };
    return mimeTypes[mediaType] ?? "application/octet-stream";
  }

  /**
   * Send typing indicator via webhook
   */
  async sendTypingIndicator(
    config: ChannelConfig,
    recipientId: string
  ): Promise<void> {
    const webhookUrl = config.credentials.responseWebhookUrl as string;
    if (!webhookUrl) return;

    const body = {
      recipientId,
      eventType: "typing",
      timestamp: Date.now(),
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // Ignore typing indicator failures
    });
  }

  /**
   * Send read receipt via webhook
   */
  async sendReadReceipt(
    config: ChannelConfig,
    recipientId: string,
    messageIds: string[]
  ): Promise<void> {
    const webhookUrl = config.credentials.responseWebhookUrl as string;
    if (!webhookUrl) return;

    const body = {
      recipientId,
      eventType: "read",
      messageIds,
      timestamp: Date.now(),
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // Ignore read receipt failures
    });
  }
}

// Export singleton
export const customWebhookAdapter = new CustomWebhookAdapter();
