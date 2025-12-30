import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  companies,
  companySubscriptions,
  subscriptionPlans,
  paymentHistory,
} from "@/lib/db/schema";

// Billing interfaces
export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: string;
  currency: string;
  maxAgents: number;
  maxConversationsPerMonth: number;
  maxKnowledgeSources: number;
  maxStorageGb: number;
  maxTeamMembers: number;
  features: string[];
  customBranding: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  advancedAnalytics: boolean;
  customIntegrations: boolean;
}

export interface BillingSubscription {
  id: string;
  planId: string;
  planName: string;
  billingCycle: string;
  status: string;
  currentPrice: string;
  currency: string;
  trialStartDate: string | null;
  trialEndDate: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  conversationsUsed: number;
  conversationsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  amount: string;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface BillingResponse {
  subscription: BillingSubscription | null;
  currentPlan: BillingPlan | null;
  availablePlans: BillingPlan[];
  paymentHistory: PaymentRecord[];
}

// Update subscription schema
const updateSubscriptionSchema = z.object({
  planId: z.string().uuid().optional(),
  status: z.enum(["trial", "active", "past_due", "grace_period", "expired", "cancelled"]).optional(),
  billingCycle: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).optional(),
  currentPrice: z.string().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  conversationsUsed: z.number().int().min(0).optional(),
  storageUsedMb: z.number().int().min(0).optional(),
  trialEndDate: z.string().datetime().optional().nullable(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
});

// Add payment schema
const addPaymentSchema = z.object({
  amount: z.string(),
  currency: z.string().default("USD"),
  status: z.enum(["succeeded", "failed", "pending", "refunded"]),
  invoiceNumber: z.string().optional(),
  invoiceUrl: z.string().url().optional(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// GET /api/master-admin/companies/[companyId]/billing - Get billing info
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Get current subscription with plan details
    const [subscription] = await db
      .select({
        id: companySubscriptions.id,
        planId: companySubscriptions.planId,
        billingCycle: companySubscriptions.billingCycle,
        status: companySubscriptions.status,
        currentPrice: companySubscriptions.currentPrice,
        currency: companySubscriptions.currency,
        trialStartDate: companySubscriptions.trialStartDate,
        trialEndDate: companySubscriptions.trialEndDate,
        currentPeriodStart: companySubscriptions.currentPeriodStart,
        currentPeriodEnd: companySubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: companySubscriptions.cancelAtPeriodEnd,
        cancelledAt: companySubscriptions.cancelledAt,
        conversationsUsed: companySubscriptions.conversationsUsed,
        storageUsedMb: companySubscriptions.storageUsedMb,
        stripeCustomerId: companySubscriptions.stripeCustomerId,
        stripeSubscriptionId: companySubscriptions.stripeSubscriptionId,
        createdAt: companySubscriptions.createdAt,
        plan: {
          id: subscriptionPlans.id,
          name: subscriptionPlans.name,
          slug: subscriptionPlans.slug,
          description: subscriptionPlans.description,
          basePrice: subscriptionPlans.basePrice,
          currency: subscriptionPlans.currency,
          maxAgents: subscriptionPlans.maxAgents,
          maxConversationsPerMonth: subscriptionPlans.maxConversationsPerMonth,
          maxKnowledgeSources: subscriptionPlans.maxKnowledgeSources,
          maxStorageGb: subscriptionPlans.maxStorageGb,
          maxTeamMembers: subscriptionPlans.maxTeamMembers,
          features: subscriptionPlans.features,
          customBranding: subscriptionPlans.customBranding,
          prioritySupport: subscriptionPlans.prioritySupport,
          apiAccess: subscriptionPlans.apiAccess,
          advancedAnalytics: subscriptionPlans.advancedAnalytics,
          customIntegrations: subscriptionPlans.customIntegrations,
        },
      })
      .from(companySubscriptions)
      .leftJoin(subscriptionPlans, eq(companySubscriptions.planId, subscriptionPlans.id))
      .where(eq(companySubscriptions.companyId, companyId))
      .limit(1);

    // Get all available plans
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    // Get payment history
    const payments = subscription
      ? await db
          .select()
          .from(paymentHistory)
          .where(eq(paymentHistory.companyId, companyId))
          .orderBy(desc(paymentHistory.createdAt))
          .limit(24)
      : [];

    // Transform to response format
    const billingSubscription: BillingSubscription | null = subscription
      ? {
          id: subscription.id,
          planId: subscription.planId,
          planName: subscription.plan?.name ?? "Unknown Plan",
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          currentPrice: subscription.currentPrice,
          currency: subscription.currency,
          trialStartDate: subscription.trialStartDate?.toISOString() ?? null,
          trialEndDate: subscription.trialEndDate?.toISOString() ?? null,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
          conversationsUsed: subscription.conversationsUsed,
          conversationsLimit: subscription.plan?.maxConversationsPerMonth ?? 0,
          storageUsedMb: subscription.storageUsedMb,
          storageLimitMb: (subscription.plan?.maxStorageGb ?? 0) * 1024,
          stripeCustomerId: subscription.stripeCustomerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          createdAt: subscription.createdAt.toISOString(),
        }
      : null;

    const currentPlan: BillingPlan | null = subscription?.plan
      ? {
          id: subscription.plan.id,
          name: subscription.plan.name,
          slug: subscription.plan.slug,
          description: subscription.plan.description,
          basePrice: subscription.plan.basePrice,
          currency: subscription.plan.currency,
          maxAgents: subscription.plan.maxAgents,
          maxConversationsPerMonth: subscription.plan.maxConversationsPerMonth,
          maxKnowledgeSources: subscription.plan.maxKnowledgeSources,
          maxStorageGb: subscription.plan.maxStorageGb,
          maxTeamMembers: subscription.plan.maxTeamMembers,
          features: (subscription.plan.features as string[]) || [],
          customBranding: subscription.plan.customBranding,
          prioritySupport: subscription.plan.prioritySupport,
          apiAccess: subscription.plan.apiAccess,
          advancedAnalytics: subscription.plan.advancedAnalytics,
          customIntegrations: subscription.plan.customIntegrations,
        }
      : null;

    const availablePlans: BillingPlan[] = plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      basePrice: p.basePrice,
      currency: p.currency,
      maxAgents: p.maxAgents,
      maxConversationsPerMonth: p.maxConversationsPerMonth,
      maxKnowledgeSources: p.maxKnowledgeSources,
      maxStorageGb: p.maxStorageGb,
      maxTeamMembers: p.maxTeamMembers,
      features: (p.features as string[]) || [],
      customBranding: p.customBranding,
      prioritySupport: p.prioritySupport,
      apiAccess: p.apiAccess,
      advancedAnalytics: p.advancedAnalytics,
      customIntegrations: p.customIntegrations,
    }));

    const paymentRecords: PaymentRecord[] = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      invoiceNumber: p.invoiceNumber,
      invoiceUrl: p.invoiceUrl,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      createdAt: p.createdAt.toISOString(),
    }));

    const response: BillingResponse = {
      subscription: billingSubscription,
      currentPlan,
      availablePlans,
      paymentHistory: paymentRecords,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching billing info:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing information" },
      { status: 500 }
    );
  }
}

// PATCH /api/master-admin/companies/[companyId]/billing - Update subscription
export async function PATCH(request: NextRequest, context: RouteContext) {
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
    if (data.conversationsUsed !== undefined) updateData.conversationsUsed = data.conversationsUsed;
    if (data.storageUsedMb !== undefined) updateData.storageUsedMb = data.storageUsedMb;
    if (data.trialEndDate !== undefined) {
      updateData.trialEndDate = data.trialEndDate ? new Date(data.trialEndDate) : null;
    }
    if (data.currentPeriodStart !== undefined) {
      updateData.currentPeriodStart = new Date(data.currentPeriodStart);
    }
    if (data.currentPeriodEnd !== undefined) {
      updateData.currentPeriodEnd = new Date(data.currentPeriodEnd);
    }

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

// POST /api/master-admin/companies/[companyId]/billing - Add payment record
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

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

    // Get subscription
    const [subscription] = await db
      .select({ id: companySubscriptions.id })
      .from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, companyId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found for this company" },
        { status: 404 }
      );
    }

    switch (action) {
      case "add-payment": {
        const body = await request.json();
        const data = addPaymentSchema.parse(body);

        const [payment] = await db
          .insert(paymentHistory)
          .values({
            companyId,
            subscriptionId: subscription.id,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            invoiceNumber: data.invoiceNumber || null,
            invoiceUrl: data.invoiceUrl || null,
            periodStart: new Date(data.periodStart),
            periodEnd: new Date(data.periodEnd),
          })
          .returning();

        return NextResponse.json({
          payment,
          message: "Payment record added successfully",
        });
      }

      case "reset-usage": {
        // Reset conversation and storage usage for new billing period
        await db
          .update(companySubscriptions)
          .set({
            conversationsUsed: 0,
            updatedAt: new Date(),
          })
          .where(eq(companySubscriptions.id, subscription.id));

        return NextResponse.json({
          message: "Usage counters reset successfully",
        });
      }

      case "extend-trial": {
        const body = await request.json();
        const { days } = body;

        if (!days || typeof days !== "number" || days < 1) {
          return NextResponse.json(
            { error: "Invalid trial extension days" },
            { status: 400 }
          );
        }

        // Get current trial end date or current period end
        const [currentSub] = await db
          .select({
            trialEndDate: companySubscriptions.trialEndDate,
            currentPeriodEnd: companySubscriptions.currentPeriodEnd,
          })
          .from(companySubscriptions)
          .where(eq(companySubscriptions.id, subscription.id))
          .limit(1);

        const baseDate = currentSub?.trialEndDate || currentSub?.currentPeriodEnd || new Date();
        const newTrialEnd = new Date(baseDate);
        newTrialEnd.setDate(newTrialEnd.getDate() + days);

        await db
          .update(companySubscriptions)
          .set({
            trialEndDate: newTrialEnd,
            currentPeriodEnd: newTrialEnd,
            status: "trial",
            updatedAt: new Date(),
          })
          .where(eq(companySubscriptions.id, subscription.id));

        // Also update company status
        await db
          .update(companies)
          .set({
            status: "trial",
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        return NextResponse.json({
          message: `Trial extended by ${days} days`,
          newTrialEndDate: newTrialEnd.toISOString(),
        });
      }

      case "cancel-subscription": {
        const body = await request.json();
        const { immediate } = body;

        if (immediate) {
          // Cancel immediately
          await db
            .update(companySubscriptions)
            .set({
              status: "cancelled",
              cancelledAt: new Date(),
              cancelAtPeriodEnd: false,
              updatedAt: new Date(),
            })
            .where(eq(companySubscriptions.id, subscription.id));

          await db
            .update(companies)
            .set({
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(eq(companies.id, companyId));

          return NextResponse.json({
            message: "Subscription cancelled immediately",
          });
        } else {
          // Cancel at period end
          await db
            .update(companySubscriptions)
            .set({
              cancelAtPeriodEnd: true,
              updatedAt: new Date(),
            })
            .where(eq(companySubscriptions.id, subscription.id));

          return NextResponse.json({
            message: "Subscription will be cancelled at period end",
          });
        }
      }

      case "reactivate": {
        await db
          .update(companySubscriptions)
          .set({
            status: "active",
            cancelAtPeriodEnd: false,
            cancelledAt: null,
            updatedAt: new Date(),
          })
          .where(eq(companySubscriptions.id, subscription.id));

        await db
          .update(companies)
          .set({
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));

        return NextResponse.json({
          message: "Subscription reactivated successfully",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error performing billing action:", error);
    return NextResponse.json(
      { error: "Failed to perform billing action" },
      { status: 500 }
    );
  }
}
