/**
 * Microsoft Teams Channel Adapter
 *
 * Handles Microsoft Teams Bot Framework integration.
 * Parses incoming activities and sends messages via Bot Framework Connector API.
 */

import crypto from "crypto";
import { BaseChannelAdapter } from "./adapter";
import type { UnifiedMessage, ChannelConfig, SendOptions, MessageAttachment } from "../types";

// ============================================================================
// Teams Types
// ============================================================================

interface TeamsActivity {
  type: "message" | "conversationUpdate" | "messageReaction" | "invoke" | "event";
  id: string;
  timestamp: string;
  localTimestamp?: string;
  serviceUrl: string;
  channelId: string;
  from: TeamsChannelAccount;
  conversation: {
    id: string;
    name?: string;
    conversationType?: "personal" | "channel" | "groupChat";
    tenantId?: string;
    isGroup?: boolean;
  };
  recipient: TeamsChannelAccount;
  text?: string;
  textFormat?: "plain" | "markdown" | "xml";
  attachments?: TeamsAttachment[];
  entities?: TeamsEntity[];
  channelData?: TeamsChannelData;
  value?: unknown;
  replyToId?: string;
}

interface TeamsChannelAccount {
  id: string;
  name?: string;
  aadObjectId?: string;
  role?: string;
  email?: string;
}

interface TeamsAttachment {
  contentType: string;
  contentUrl?: string;
  content?: unknown;
  name?: string;
  thumbnailUrl?: string;
}

interface TeamsEntity {
  type: string;
  mentioned?: TeamsChannelAccount;
  text?: string;
}

interface TeamsChannelData {
  tenant?: { id: string };
  team?: { id: string; name?: string };
  channel?: { id: string; name?: string };
  notification?: { alert: boolean };
}

// ============================================================================
// Teams Adapter
// ============================================================================

export class TeamsAdapter extends BaseChannelAdapter {
  readonly channel = "teams" as const;

  async parseMessage(payload: unknown): Promise<UnifiedMessage | null> {
    const activity = payload as TeamsActivity;

    // Only process message activities
    if (activity.type !== "message") {
      return null;
    }

    // Skip messages from bots (including self)
    if (activity.from.role === "bot") {
      return null;
    }

    // Parse attachments
    const attachments: MessageAttachment[] = [];
    let content = activity.text ?? "";
    let contentType: UnifiedMessage["contentType"] = "text";

    if (activity.attachments && activity.attachments.length > 0) {
      for (const attachment of activity.attachments) {
        // Skip inline images in adaptive cards
        if (attachment.contentType === "application/vnd.microsoft.card.adaptive") {
          continue;
        }

        // Handle file attachments
        if (attachment.contentUrl) {
          let type: MessageAttachment["type"] = "document";
          if (attachment.contentType.startsWith("image/")) {
            type = "image";
            contentType = "image";
          } else if (attachment.contentType.startsWith("audio/")) {
            type = "audio";
            contentType = "audio";
          } else if (attachment.contentType.startsWith("video/")) {
            type = "video";
            contentType = "video";
          }

          attachments.push({
            type,
            url: attachment.contentUrl,
            mimeType: attachment.contentType,
            filename: attachment.name,
          });
        }
      }
    }

    // Remove @mentions from text
    if (activity.entities) {
      for (const entity of activity.entities) {
        if (entity.type === "mention" && entity.text && activity.text) {
          content = content.replace(entity.text, "").trim();
        }
      }
    }

    return {
      externalId: activity.id,
      senderId: activity.from.id,
      senderName: activity.from.name,
      content,
      contentType,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(activity.timestamp),
      replyToId: activity.replyToId,
      channelMetadata: {
        serviceUrl: activity.serviceUrl,
        conversationId: activity.conversation.id,
        conversationType: activity.conversation.conversationType,
        tenantId: activity.channelData?.tenant?.id ?? activity.conversation.tenantId,
        teamId: activity.channelData?.team?.id,
        channelId: activity.channelData?.channel?.id,
      },
    };
  }

  async sendMessage(
    config: ChannelConfig,
    recipientId: string,
    content: string,
    options?: SendOptions
  ): Promise<void> {
    const { serviceUrl, botId, botPassword } = config.credentials as {
      serviceUrl: string;
      botId: string;
      botPassword: string;
    };

    // Get access token
    const token = await this.getAccessToken(botId, botPassword);

    const activity: Partial<TeamsActivity> = {
      type: "message",
      text: content,
      textFormat: options?.parseMode === "markdown" ? "markdown" : "plain",
    };

    // Set reply context
    if (options?.replyToId) {
      activity.replyToId = options.replyToId;
    }

    // Send message via Bot Framework
    const response = await fetch(
      `${serviceUrl}/v3/conversations/${recipientId}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activity),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Teams API error: ${JSON.stringify(error)}`);
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
    const { serviceUrl, botId, botPassword } = config.credentials as {
      serviceUrl: string;
      botId: string;
      botPassword: string;
    };

    const token = await this.getAccessToken(botId, botPassword);

    // Map media type to MIME type
    const mimeTypes: Record<string, string> = {
      image: "image/*",
      audio: "audio/*",
      video: "video/*",
      document: "application/octet-stream",
    };

    const attachment: TeamsAttachment = {
      contentType: mimeTypes[mediaType] ?? "application/octet-stream",
      contentUrl: mediaUrl,
      name: caption || "Attachment",
    };

    const activity: Partial<TeamsActivity> = {
      type: "message",
      text: caption || "",
      attachments: [attachment],
    };

    if (options?.replyToId) {
      activity.replyToId = options.replyToId;
    }

    const response = await fetch(
      `${serviceUrl}/v3/conversations/${recipientId}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activity),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Teams API error: ${JSON.stringify(error)}`);
    }
  }

  async downloadMedia(config: ChannelConfig, mediaUrl: string): Promise<Buffer> {
    const { botId, botPassword } = config.credentials as {
      botId: string;
      botPassword: string;
    };

    const token = await this.getAccessToken(botId, botPassword);

    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to download media from Teams");
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

    // Teams uses HMAC-SHA256 for signature verification
    const expectedSignature = this.createHmacSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get OAuth access token for Bot Framework
   */
  private async getAccessToken(botId: string, botPassword: string): Promise<string> {
    const tokenEndpoint = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: botId,
      client_secret: botPassword,
      scope: "https://api.botframework.com/.default",
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error("Failed to obtain Teams access token");
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Send adaptive card message
   */
  async sendAdaptiveCard(
    config: ChannelConfig,
    recipientId: string,
    card: unknown,
    options?: SendOptions
  ): Promise<void> {
    const { serviceUrl, botId, botPassword } = config.credentials as {
      serviceUrl: string;
      botId: string;
      botPassword: string;
    };

    const token = await this.getAccessToken(botId, botPassword);

    const activity: Partial<TeamsActivity> = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: card,
        },
      ],
    };

    if (options?.replyToId) {
      activity.replyToId = options.replyToId;
    }

    const response = await fetch(
      `${serviceUrl}/v3/conversations/${recipientId}/activities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(activity),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Teams API error: ${JSON.stringify(error)}`);
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(
    config: ChannelConfig,
    recipientId: string
  ): Promise<void> {
    const { serviceUrl, botId, botPassword } = config.credentials as {
      serviceUrl: string;
      botId: string;
      botPassword: string;
    };

    const token = await this.getAccessToken(botId, botPassword);

    const activity = {
      type: "typing",
    };

    await fetch(`${serviceUrl}/v3/conversations/${recipientId}/activities`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(activity),
    });
  }

  /**
   * Create a new conversation (for proactive messaging)
   */
  async createConversation(
    config: ChannelConfig,
    userId: string,
    tenantId: string
  ): Promise<string> {
    const { serviceUrl, botId, botPassword } = config.credentials as {
      serviceUrl: string;
      botId: string;
      botPassword: string;
    };

    const token = await this.getAccessToken(botId, botPassword);

    const conversationParams = {
      bot: { id: botId },
      members: [{ id: userId }],
      channelData: {
        tenant: { id: tenantId },
      },
      isGroup: false,
    };

    const response = await fetch(`${serviceUrl}/v3/conversations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(conversationParams),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Teams API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return result.id;
  }
}

// Export singleton
export const teamsAdapter = new TeamsAdapter();
