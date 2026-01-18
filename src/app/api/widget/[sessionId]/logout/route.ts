/**
 * Logout API
 *
 * POST /api/widget/[sessionId]/logout
 * Clear authentication session for a widget conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, chatbots, chatbotPackages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getWidgetSessionCache,
  type CachedWidgetSession,
} from "@/lib/redis/cache";
import { getPackage } from "@/chatbot-packages/registry";
import { loadPackage } from "@/lib/packages";
import { createAuthInterceptor } from "@/lib/ai/execution/auth-interceptor";
import { createVariableContext } from "@/lib/ai/types";

interface RouteParams {
  sessionId: string;
}

/**
 * Get conversation by session ID using Redis cache
 */
async function getConversationForSession(sessionId: string) {
  const cached = await getWidgetSessionCache(sessionId);

  if (cached) {
    if (cached.status === "resolved" || cached.status === "abandoned") {
      return null;
    }

    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, cached.conversationId))
      .limit(1);

    return result[0] ?? null;
  }

  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .limit(1);

  return result[0] ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { sessionId } = await params;

    // Get conversation
    const conversation = await getConversationForSession(sessionId);
    if (!conversation) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Get chatbot with package slug to load package
    const chatbotResult = await db
      .select({
        id: chatbots.id,
        companyId: chatbots.companyId,
        packageId: chatbots.packageId,
        packageSlug: chatbotPackages.slug,
        variableValues: chatbots.variableValues,
      })
      .from(chatbots)
      .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
      .where(eq(chatbots.id, conversation.chatbotId))
      .limit(1);

    const chatbot = chatbotResult[0];

    if (!chatbot?.packageId && !chatbot?.packageSlug) {
      // No package = no auth to clear
      return NextResponse.json({ success: true });
    }

    // Use package slug for registry/loader lookup
    const packageKey = chatbot.packageSlug || chatbot.packageId;

    // Load package using slug
    let pkg = getPackage(packageKey!);
    if (!pkg) {
      pkg = await loadPackage(packageKey!);
    }

    if (!pkg?.authGuard) {
      // Package doesn't support auth
      return NextResponse.json({ success: true });
    }

    // Create variable context
    const variableValues = chatbot.variableValues as Record<string, string> | null;
    const variableContext = createVariableContext(
      Object.entries(variableValues ?? {}).map(([name, value]) => ({
        name,
        value,
        variableType: "variable" as const,
        dataType: "string" as const,
      }))
    );

    // Create auth interceptor
    const authInterceptor = createAuthInterceptor({
      chatbotId: chatbot.id,
      companyId: conversation.companyId,
      authGuard: pkg.authGuard,
      authConfig: pkg.authConfig,
    });

    // Clear session
    await authInterceptor.logout(
      conversation.endUserId,
      conversation.id,
      {
        channel: conversation.channel,
        variables: variableContext.variables,
        securedVariables: variableContext.securedVariables,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
