/**
 * Chat Session API
 *
 * POST /api/chat/session - Create a new chat session
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAgentRunner } from "@/lib/ai";
import type { ChannelType } from "@/lib/ai/types";

// ============================================================================
// Request Validation
// ============================================================================

const createSessionSchema = z.object({
  agentId: z.string().uuid({ message: "Invalid agent ID" }),
  companyId: z.string().uuid({ message: "Invalid company ID" }),
  channel: z.enum(["web", "whatsapp", "telegram", "messenger", "instagram", "slack", "teams", "custom"]).default("web"),
  endUserId: z.string().uuid().optional(),
  customerName: z.string().max(255).optional(),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pageUrl: z.string().url().optional(),
  referrer: z.string().url().optional(),
});

// ============================================================================
// POST - Create New Session
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = createSessionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get client info
    const ipAddress = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    // Create session using agent runner
    const runner = getAgentRunner();
    const session = await runner.createSession({
      agentId: data.agentId,
      companyId: data.companyId,
      channel: data.channel as ChannelType,
      endUserId: data.endUserId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      metadata: data.metadata,
      pageUrl: data.pageUrl,
      referrer: data.referrer,
      ipAddress,
      userAgent,
    });

    if (!session) {
      return NextResponse.json(
        {
          error: "Failed to create session",
          message: "Agent not found or company subscription inactive",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.conversationId,
        conversationId: session.conversationId,
        agentId: session.agentId,
        companyId: session.companyId,
        greeting: session.greeting,
      },
    });
  } catch (error) {
    console.error("Create session error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to create chat session",
      },
      { status: 500 }
    );
  }
}
