/**
 * Auth API
 *
 * POST /api/widget/[sessionId]/auth
 * Submit authentication form values for package auth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

// Request body schema
const authRequestSchema = z.object({
  stepId: z.string().min(1),
  values: z.record(z.string(), z.string()),
});

/**
 * Get conversation by session ID using Redis cache
 */
async function getConversationForSession(sessionId: string) {
  // Try Redis cache first
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

  // Cache miss - query by sessionId
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

    // Parse request body
    const body = await request.json();
    const parsed = authRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { stepId, values } = parsed.data;

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
      return NextResponse.json(
        { error: "Chatbot not configured" },
        { status: 400 }
      );
    }

    // Use package slug for registry/loader lookup
    const packageKey = chatbot.packageSlug || chatbot.packageId;

    // Load package using slug
    let pkg = getPackage(packageKey!);
    if (!pkg) {
      pkg = await loadPackage(packageKey!);
    }

    if (!pkg?.authGuard) {
      return NextResponse.json(
        { error: "Package does not support authentication" },
        { status: 400 }
      );
    }

    // Create variable context from chatbot config
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

    // Process auth input
    const result = await authInterceptor.processAuthInput(
      conversation.endUserId,
      conversation.id,
      stepId,
      values,
      {
        channel: conversation.channel,
        variables: variableContext.variables,
        securedVariables: variableContext.securedVariables,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          retryable: true,
          stepId,
        },
        { status: 400 }
      );
    }

    // Login complete
    if (result.session) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        userName: result.session.name || result.session.email,
        message: "Authentication successful",
      });
    }

    // Move to next step
    if (result.nextStep) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        nextStep: {
          stepId: result.nextStep.id,
          stepName: result.nextStep.name,
          fields: result.nextStep.fields,
          aiPrompt: result.nextStep.aiPrompt,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Unexpected auth result" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Auth API error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
