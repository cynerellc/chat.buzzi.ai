/**
 * Widget Config URL API
 *
 * GET /api/widget/config-url?chatbotId=xxx&companyId=xxx
 * Returns the signed URL to the pre-generated widget config JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatbots } from "@/lib/db/schema/chatbots";
import { companies } from "@/lib/db/schema/companies";
import { generateWidgetConfigJson } from "@/lib/widget/config-generator";
import type { ChatbotSettings } from "@/lib/db/schema/chatbots";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");
    const companyId = searchParams.get("companyId");

    // Validate required parameters
    if (!chatbotId || !companyId) {
      return NextResponse.json(
        { error: "Missing required parameters: chatbotId and companyId" },
        { status: 400 }
      );
    }

    // Verify company exists and is active
    const [company] = await db
      .select({ id: companies.id, status: companies.status })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          eq(companies.status, "active")
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found or inactive" },
        { status: 404 }
      );
    }

    // Verify chatbot exists and belongs to company
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        settings: chatbots.settings,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.companyId, companyId),
          eq(chatbots.status, "active"),
          isNull(chatbots.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json(
        { error: "Chatbot not found or inactive" },
        { status: 404 }
      );
    }

    // Check if we have a valid config URL
    const settings = chatbot.settings as ChatbotSettings | null;
    let configUrl = settings?.widgetConfigUrl;
    let generatedAt = settings?.widgetConfigGeneratedAt;

    // Generate if none exists
    if (!configUrl) {
      const result = await generateWidgetConfigJson(chatbotId);
      if (!result.success) {
        return NextResponse.json(
          { error: "Failed to generate config: " + result.error },
          { status: 500 }
        );
      }
      configUrl = result.configUrl;
      generatedAt = new Date().toISOString();
    }

    // Return the config URL
    const origin = request.headers.get("origin");
    const response = NextResponse.json({
      configUrl,
      chatbotId,
      generatedAt,
    });

    // Set CORS headers
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  } catch (error) {
    console.error("Widget config URL error:", error);
    return NextResponse.json(
      { error: "Failed to get config URL" },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  const response = new NextResponse(null, { status: 204 });
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}
