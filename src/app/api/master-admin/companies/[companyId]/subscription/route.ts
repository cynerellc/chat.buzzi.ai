import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  companies,
  companySubscriptions,
  subscriptionPlans,
} from "@/lib/db/schema";

// Subscription details interface
export interface SubscriptionDetails {
  id: string;
  companyId: string;
  plan: {
    id: string;
    name: string;
    slug: string;
    basePrice: string;
    maxAgents: number;
    maxConversationsPerMonth: number;
    maxKnowledgeSources: number;
    maxStorageGb: number;
    maxTeamMembers: number;
  };
  status: string;
  billingCycle: string;
  currentPrice: string;
  currency: string;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  conversationsUsed: number;
  storageUsedMb: number;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
}

// Update subscription schema
const updateSubscriptionSchema = z.object({
  planId: z.string().uuid().optional(),
  status: z.enum(["trial", "active", "past_due", "grace_period", "expired", "cancelled"]).optional(),
  billingCycle: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).optional(),
  currentPrice: z.string().optional(), // For custom pricing overrides
  cancelAtPeriodEnd: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// GET /api/master-admin/companies/[companyId]/subscription - Get subscription details
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;

    // Check if company exists
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get subscription with plan details
    const [subscription] = await db
      .select({
        id: companySubscriptions.id,
        companyId: companySubscriptions.companyId,
        planId: subscriptionPlans.id,
        planName: subscriptionPlans.name,
        planSlug: subscriptionPlans.slug,
        planBasePrice: subscriptionPlans.basePrice,
        planMaxAgents: subscriptionPlans.maxAgents,
        planMaxConversations: subscriptionPlans.maxConversationsPerMonth,
        planMaxKnowledgeSources: subscriptionPlans.maxKnowledgeSources,
        planMaxStorageGb: subscriptionPlans.maxStorageGb,
        planMaxTeamMembers: subscriptionPlans.maxTeamMembers,
        status: companySubscriptions.status,
        billingCycle: companySubscriptions.billingCycle,
        currentPrice: companySubscriptions.currentPrice,
        currency: companySubscriptions.currency,
        trialStartDate: companySubscriptions.trialStartDate,
        trialEndDate: companySubscriptions.trialEndDate,
        currentPeriodStart: companySubscriptions.currentPeriodStart,
        currentPeriodEnd: companySubscriptions.currentPeriodEnd,
        conversationsUsed: companySubscriptions.conversationsUsed,
        storageUsedMb: companySubscriptions.storageUsedMb,
        cancelAtPeriodEnd: companySubscriptions.cancelAtPeriodEnd,
        createdAt: companySubscriptions.createdAt,
      })
      .from(companySubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(companySubscriptions.planId, subscriptionPlans.id)
      )
      .where(eq(companySubscriptions.companyId, companyId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found for this company" },
        { status: 404 }
      );
    }

    const response: SubscriptionDetails = {
      id: subscription.id,
      companyId: subscription.companyId,
      plan: {
        id: subscription.planId,
        name: subscription.planName,
        slug: subscription.planSlug,
        basePrice: subscription.planBasePrice,
        maxAgents: subscription.planMaxAgents,
        maxConversationsPerMonth: subscription.planMaxConversations,
        maxKnowledgeSources: subscription.planMaxKnowledgeSources,
        maxStorageGb: subscription.planMaxStorageGb,
        maxTeamMembers: subscription.planMaxTeamMembers,
      },
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPrice: subscription.currentPrice,
      currency: subscription.currency,
      trialStartDate: subscription.trialStartDate,
      trialEndDate: subscription.trialEndDate,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      conversationsUsed: subscription.conversationsUsed,
      storageUsedMb: subscription.storageUsedMb,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

// PATCH /api/master-admin/companies/[companyId]/subscription - Update subscription
export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const body = await request.json();
    const data = updateSubscriptionSchema.parse(body);

    // Check if company exists
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get existing subscription
    const [existingSubscription] = await db
      .select({ id: companySubscriptions.id })
      .from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, companyId))
      .limit(1);

    if (!existingSubscription) {
      return NextResponse.json(
        { error: "No subscription found for this company" },
        { status: 404 }
      );
    }

    // If changing plan, verify the new plan exists
    if (data.planId) {
      const [plan] = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, data.planId))
        .limit(1);

      if (!plan) {
        return NextResponse.json(
          { error: "Invalid plan ID" },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Partial<typeof companySubscriptions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.planId !== undefined) updateData.planId = data.planId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
    if (data.currentPrice !== undefined) updateData.currentPrice = data.currentPrice;
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;

    // Update subscription
    const [updated] = await db
      .update(companySubscriptions)
      .set(updateData)
      .where(eq(companySubscriptions.id, existingSubscription.id))
      .returning();

    // Also update company status if subscription status changes
    if (data.status) {
      await db
        .update(companies)
        .set({
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));
    }

    return NextResponse.json({
      subscription: updated,
      message: "Subscription updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
