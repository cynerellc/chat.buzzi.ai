/**
 * Telegram Channel Adapter
 *
 * Handles Telegram Bot API integration.
 * Parses incoming updates and sends messages via Bot API.
 */

import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// Telegram Types
// ============================================================================

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
  voice?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string };
  audio?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string; title?: string };
  video?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string };
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string };
  location?: { latitude: number; longitude: number };
  reply_to_message?: TelegramMessage;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

// ============================================================================
// Telegram Adapter
// ============================================================================

export class TelegramAdapter extends BaseChannelAdapter {
  readonly channel = "telegram" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    const update = payload as TelegramUpdate;

    // Get message from update or edited message
    const message = update.message ?? update.edited_message;
    if (!message) {
      return null;
    }

    // Build sender name
    const senderName = [message.from.first_name, message.from.last_name]
      .filter(Boolean)
      .join(" ");

    // Parse message content
    let content = message.text ?? message.caption ?? "";
    let contentType: UnifiedMessage["contentType"] = "text";
    const attachments: MessageAttachment[] = [];

    if (message.photo) {
      contentType = "image";
      // Get largest photo (last in array)
      const photo = message.photo[message.photo.length - 1];
      if (photo) {
        attachments.push({
          type: "image",
          mediaId: photo.file_id,
          mimeType: "image/jpeg", // Telegram photos are always JPEG
        });
      }
    } else if (message.voice) {
      contentType = "audio";
      attachments.push({
        type: "audio",
        mediaId: message.voice.file_id,
        mimeType: message.voice.mime_type ?? "audio/ogg",
      });
    } else if (message.audio) {
      contentType = "audio";
      attachments.push({
        type: "audio",
        mediaId: message.audio.file_id,
        mimeType: message.audio.mime_type ?? "audio/mpeg",
      });
    } else if (message.video) {
      contentType = "video";
      attachments.push({
        type: "video",
        mediaId: message.video.file_id,
        mimeType: message.video.mime_type ?? "video/mp4",
      });
    } else if (message.document) {
      contentType = "document";
      attachments.push({
        type: "document",
        mediaId: message.document.file_id,
        mimeType: message.document.mime_type ?? "application/octet-stream",
        filename: message.document.file_name,
      });
    } else if (message.location) {
      contentType = "location";
      content = `Location: ${message.location.latitude}, ${message.location.longitude}`;
    }

    return {
      externalId: message.message_id.toString(),
      senderId: message.from.id.toString(),
      senderName,
      content,
      contentType,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(message.date * 1000),
      replyToId: message.reply_to_message?.message_id?.toString(),
      channelMetadata: {
        chatId: message.chat.id,
        chatType: message.chat.type,
        username: message.from.username,
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
      chat_id: recipientId,
      text: content,
    };

    // Set parse mode
    if (options?.parseMode === "markdown") {
      body.parse_mode = "Markdown";
    } else if (options?.parseMode === "html") {
      body.parse_mode = "HTML";
    }

    // Add reply
    if (options?.replyToId) {
      body.reply_to_message_id = parseInt(options.replyToId);
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
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

    // Map media type to Telegram endpoint
    const endpointMap: Record<string, string> = {
      image: "sendPhoto",
      audio: "sendAudio",
      video: "sendVideo",
      document: "sendDocument",
    };

    const fieldMap: Record<string, string> = {
      image: "photo",
      audio: "audio",
      video: "video",
      document: "document",
    };

    const fieldKey = fieldMap[mediaType] ?? mediaType;
    const body: Record<string, unknown> = {
      chat_id: recipientId,
      [fieldKey]: mediaUrl,
    };

    if (caption) {
      body.caption = caption;
    }

    if (options?.replyToId) {
      body.reply_to_message_id = parseInt(options.replyToId);
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/${endpointMap[mediaType]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
    }
  }

  async downloadMedia(config: ChannelConfig, mediaId: string): Promise<Buffer> {
    const { botToken } = config.credentials as { botToken: string };

    // 1. Get file path
    const fileResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${mediaId}`
    );

    if (!fileResponse.ok) {
      throw new Error("Failed to get file info");
    }

    const { result } = await fileResponse.json();

    // 2. Download file
    const response = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${result.file_path}`
    );

    if (!response.ok) {
      throw new Error("Failed to download file");
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  validateSignature(
    _payload: string,
    signature: string | null,
    secret: string
  ): boolean {
    // Telegram uses secret token in header for verification
    return signature === secret;
  }

  /**
   * Send typing action to indicate bot is processing
   */
  async sendTypingAction(config: ChannelConfig, chatId: string): Promise<void> {
    const { botToken } = config.credentials as { botToken: string };

    await fetch(
      `https://api.telegram.org/bot${botToken}/sendChatAction`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          action: "typing",
        }),
      }
    );
  }
}

// Export singleton
export const telegramAdapter = new TelegramAdapter();
