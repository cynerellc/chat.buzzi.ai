/**
 * Auth Status API
 *
 * GET /api/widget/[sessionId]/auth-status
 * Check current authentication state for a widget conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, chatbots, chatbotPackages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getWidgetSessionCache,
} from "@/lib/redis/cache";
import { getPackage } from "@/chatbot-packages/registry";
import { loadPackage } from "@/lib/packages";
import { createAuthInterceptor } from "@/lib/ai/execution/auth-interceptor";

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

export async function GET(
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
      })
      .from(chatbots)
      .leftJoin(chatbotPackages, eq(chatbots.packageId, chatbotPackages.id))
      .where(eq(chatbots.id, conversation.chatbotId))
      .limit(1);

    const chatbot = chatbotResult[0];

    if (!chatbot?.packageId && !chatbot?.packageSlug) {
      // No package = no auth required
      return NextResponse.json({
        authRequired: false,
        authenticated: false,
      });
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
      return NextResponse.json({
        authRequired: false,
        authenticated: false,
      });
    }

    // Create auth interceptor
    const authInterceptor = createAuthInterceptor({
      chatbotId: chatbot.id,
      companyId: conversation.companyId,
      authGuard: pkg.authGuard,
      authConfig: pkg.authConfig,
    });

    // Get auth state
    const state = await authInterceptor.getAuthState(conversation.endUserId);

    if (!state) {
      return NextResponse.json({
        authRequired: true,
        authenticated: false,
        authState: "anonymous",
      });
    }

    // If authenticated, get session for user info
    if (state.authState === "authenticated") {
      const session = await authInterceptor.getSession(conversation.endUserId);

      return NextResponse.json({
        authRequired: true,
        authenticated: true,
        authState: "authenticated",
        userName: session?.name || session?.email,
        roles: state.roles,
        expiresAt: state.expiresAt,
      });
    }

    // Pending or anonymous
    if (state.authState === "pending") {
      // Get current step
      const steps = pkg.authGuard.getLoginSteps();
      const currentStep = steps.find((s) => s.id === state.currentStep);

      return NextResponse.json({
        authRequired: true,
        authenticated: false,
        authState: "pending",
        currentStep: currentStep
          ? {
              stepId: currentStep.id,
              stepName: currentStep.name,
              fields: currentStep.fields,
              aiPrompt: currentStep.aiPrompt,
            }
          : undefined,
      });
    }

    return NextResponse.json({
      authRequired: true,
      authenticated: false,
      authState: state.authState,
    });
  } catch (error) {
    console.error("Auth status API error:", error);
    return NextResponse.json(
      { error: "Failed to get auth status" },
      { status: 500 }
    );
  }
}
