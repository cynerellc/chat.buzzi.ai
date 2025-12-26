/**
 * Support Agent Customer Profile API
 *
 * GET /api/support-agent/customers/[customerId] - Get customer profile with conversations
 * PATCH /api/support-agent/customers/[customerId] - Update customer data
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endUsers, conversations } from "@/lib/db/schema/conversations";
import { agents } from "@/lib/db/schema/agents";
import { requireSupportAgent } from "@/lib/auth/guards";
import { and, eq, desc, sql, avg, count } from "drizzle-orm";
import { z } from "zod/v4";

interface RouteParams {
  customerId: string;
}

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { customerId } = await params;

    const { user, company } = await requireSupportAgent();

    // Get customer
    const [customer] = await db
      .select()
      .from(endUsers)
      .where(
        and(
          eq(endUsers.id, customerId),
          eq(endUsers.companyId, company.id)
        )
      )
      .limit(1);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get conversations with agent info
    const customerConversations = await db
      .select({
        id: conversations.id,
        subject: conversations.subject,
        status: conversations.status,
        channel: conversations.channel,
        messageCount: conversations.messageCount,
        sentiment: conversations.sentiment,
        satisfactionRating: conversations.satisfactionRating,
        createdAt: conversations.createdAt,
        resolvedAt: conversations.resolvedAt,
        lastMessageAt: conversations.lastMessageAt,
        agent: {
          id: agents.id,
          name: agents.name,
          avatarUrl: agents.avatarUrl,
        },
      })
      .from(conversations)
      .leftJoin(agents, eq(conversations.agentId, agents.id))
      .where(eq(conversations.endUserId, customerId))
      .orderBy(desc(conversations.createdAt));

    // Calculate stats
    const statsResult = await db
      .select({
        totalConversations: count(),
        resolvedConversations: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
        averageSatisfaction: avg(conversations.satisfactionRating),
        averageSentiment: avg(conversations.sentiment),
      })
      .from(conversations)
      .where(eq(conversations.endUserId, customerId));

    const stats = statsResult[0] ?? {
      totalConversations: 0,
      resolvedConversations: 0,
      averageSatisfaction: null,
      averageSentiment: null,
    };

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        avatarUrl: customer.avatarUrl,
        channel: customer.channel,
        externalId: customer.externalId,
        metadata: customer.metadata,
        location: customer.location,
        totalConversations: customer.totalConversations,
        lastSeenAt: customer.lastSeenAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      conversations: customerConversations,
      stats: {
        totalConversations: Number(stats.totalConversations),
        resolvedConversations: Number(stats.resolvedConversations),
        averageSatisfaction: stats.averageSatisfaction !== null ? Number(stats.averageSatisfaction) : null,
        averageSentiment: stats.averageSentiment !== null ? Math.round(Number(stats.averageSentiment)) : null,
        averageResponseTime: null, // TODO: Calculate from message timestamps
      },
    });
  } catch (error) {
    console.error("Get customer error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { customerId } = await params;

    const { user, company } = await requireSupportAgent();

    // Verify customer exists and belongs to company
    const [existing] = await db
      .select()
      .from(endUsers)
      .where(
        and(
          eq(endUsers.id, customerId),
          eq(endUsers.companyId, company.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const data = updateCustomerSchema.parse(body);

    // Update customer
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.metadata !== undefined) {
      updateData.metadata = { ...(existing.metadata as Record<string, unknown> ?? {}), ...data.metadata };
    }

    const [updated] = await db
      .update(endUsers)
      .set(updateData)
      .where(eq(endUsers.id, customerId))
      .returning();

    return NextResponse.json({ customer: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Update customer error:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}
