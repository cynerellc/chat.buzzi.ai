/**
 * Support Agent Settings API
 *
 * GET /api/support-agent/settings - Get agent settings
 * PATCH /api/support-agent/settings - Update agent settings
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { requireSupportAgent } from "@/lib/auth/guards";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

// Settings schema for support agents
const agentSettingsSchema = z.object({
  // Notification preferences
  notifications: z.object({
    sound: z.boolean().default(true),
    desktop: z.boolean().default(true),
    email: z.boolean().default(false),
    newConversation: z.boolean().default(true),
    newMessage: z.boolean().default(true),
    escalation: z.boolean().default(true),
    mentions: z.boolean().default(true),
  }).optional(),

  // Chat preferences
  chat: z.object({
    enterToSend: z.boolean().default(true),
    showTypingIndicator: z.boolean().default(true),
    autoAwayMinutes: z.number().min(0).max(120).default(15),
  }).optional(),

  // Display preferences
  display: z.object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    compactMode: z.boolean().default(false),
    showAvatars: z.boolean().default(true),
    fontSize: z.enum(["small", "medium", "large"]).default("medium"),
  }).optional(),

  // Keyboard shortcuts
  shortcuts: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
});

type AgentSettings = z.infer<typeof agentSettingsSchema>;

const DEFAULT_SETTINGS: AgentSettings = {
  notifications: {
    sound: true,
    desktop: true,
    email: false,
    newConversation: true,
    newMessage: true,
    escalation: true,
    mentions: true,
  },
  chat: {
    enterToSend: true,
    showTypingIndicator: true,
    autoAwayMinutes: 15,
  },
  display: {
    theme: "system",
    compactMode: false,
    showAvatars: true,
    fontSize: "medium",
  },
  shortcuts: {
    enabled: true,
  },
};

export async function GET() {
  try {
    const { user: authUser } = await requireSupportAgent();

    // Get user with settings
    const [userData] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        settings: users.settings,
      })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Merge with defaults
    const userSettings = userData.settings as AgentSettings | null;
    const settings = {
      ...DEFAULT_SETTINGS,
      ...userSettings,
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...userSettings?.notifications,
      },
      chat: {
        ...DEFAULT_SETTINGS.chat,
        ...userSettings?.chat,
      },
      display: {
        ...DEFAULT_SETTINGS.display,
        ...userSettings?.display,
      },
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        ...userSettings?.shortcuts,
      },
    };

    return NextResponse.json({
      profile: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        avatarUrl: userData.avatarUrl,
      },
      settings,
    });
  } catch (error) {
    console.error("Support agent get settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: authUser } = await requireSupportAgent();

    // Parse and validate body
    const body = await request.json();

    // Handle profile updates separately
    const profileUpdates: { name?: string; phone?: string } = {};
    if (body.name !== undefined) {
      profileUpdates.name = body.name;
    }
    if (body.phone !== undefined) {
      profileUpdates.phone = body.phone;
    }

    // Parse settings updates
    const settingsUpdates = agentSettingsSchema.partial().parse(body.settings ?? {});

    // Get current settings
    const [currentUser] = await db
      .select({ settings: users.settings })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentSettings = currentUser.settings as AgentSettings | null;

    // Merge settings
    const mergedSettings = {
      ...currentSettings,
      ...settingsUpdates,
      notifications: {
        ...currentSettings?.notifications,
        ...settingsUpdates.notifications,
      },
      chat: {
        ...currentSettings?.chat,
        ...settingsUpdates.chat,
      },
      display: {
        ...currentSettings?.display,
        ...settingsUpdates.display,
      },
      shortcuts: {
        ...currentSettings?.shortcuts,
        ...settingsUpdates.shortcuts,
      },
    };

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        ...profileUpdates,
        settings: mergedSettings,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authUser.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        settings: users.settings,
      });

    if (!updatedUser) {
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
      },
      settings: mergedSettings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Support agent update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
