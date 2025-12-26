import { NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  companySubscriptions,
  conversations,
  messages,
  subscriptionPlans,
} from "@/lib/db/schema";

export interface UsageItem {
  name: string;
  current: number;
  limit: number;
  percentage: number;
}

export interface UsageOverview {
  planName: string;
  usage: UsageItem[];
}

export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    // Get current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get subscription with plan
    const subscription = await db
      .select({
        planName: subscriptionPlans.name,
        maxConversationsPerMonth: subscriptionPlans.maxConversationsPerMonth,
        maxStorageGb: subscriptionPlans.maxStorageGb,
      })
      .from(companySubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(companySubscriptions.planId, subscriptionPlans.id)
      )
      .where(
        and(
          eq(companySubscriptions.companyId, company.id),
          eq(companySubscriptions.status, "active")
        )
      )
      .limit(1);

    const planName = subscription[0]?.planName || "Free";
    const maxConversations = subscription[0]?.maxConversationsPerMonth || 100;
    const maxStorageGb = subscription[0]?.maxStorageGb || 1;

    // Get message count this month
    const [messageCountResult] = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.companyId, company.id),
          gte(messages.createdAt, monthStart)
        )
      );

    // Get conversation count this month
    const [conversationCountResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, company.id),
          gte(conversations.createdAt, monthStart)
        )
      );

    const messageCount = messageCountResult?.count ?? 0;
    const conversationCount = conversationCountResult?.count ?? 0;

    // Estimate message limit based on conversations (avg 10 messages per conversation)
    const messagesLimit = maxConversations * 10;

    // Build usage items
    const usage: UsageItem[] = [
      {
        name: "Messages",
        current: messageCount,
        limit: messagesLimit,
        percentage: Math.min(Math.round((messageCount / messagesLimit) * 100), 100),
      },
      {
        name: "Conversations",
        current: conversationCount,
        limit: maxConversations,
        percentage: Math.min(
          Math.round((conversationCount / maxConversations) * 100),
          100
        ),
      },
      {
        name: "Storage",
        current: 0, // Would need to calculate from knowledge base files
        limit: maxStorageGb * 1024, // Convert GB to MB for display
        percentage: 0,
      },
      {
        name: "API Calls",
        current: 0, // Would need to track API calls
        limit: 100000, // Default limit
        percentage: 0,
      },
    ];

    const response: UsageOverview = {
      planName,
      usage,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching usage overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage overview" },
      { status: 500 }
    );
  }
}
