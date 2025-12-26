import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companySubscriptions, subscriptionPlans } from "@/lib/db/schema";

interface UpgradeRequest {
  planId: string;
  billingCycle?: "monthly" | "quarterly" | "semi_annual" | "annual";
}

export async function POST(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body: UpgradeRequest = await request.json();

    if (!body.planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Get the target plan
    const [targetPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, body.planId))
      .limit(1);

    if (!targetPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!targetPlan.isActive) {
      return NextResponse.json(
        { error: "This plan is no longer available" },
        { status: 400 }
      );
    }

    // Get current subscription
    const [currentSubscription] = await db
      .select()
      .from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, company.id))
      .limit(1);

    const billingCycle = body.billingCycle || currentSubscription?.billingCycle || "monthly";

    // Calculate price based on billing cycle
    let price = parseFloat(targetPlan.basePrice);
    if (billingCycle === "annual") {
      // 20% discount for annual
      price = price * 12 * 0.8;
    } else if (billingCycle === "semi_annual") {
      // 10% discount for semi-annual
      price = price * 6 * 0.9;
    } else if (billingCycle === "quarterly") {
      // 5% discount for quarterly
      price = price * 3 * 0.95;
    }

    // Calculate period
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else if (billingCycle === "semi_annual") {
      periodEnd.setMonth(periodEnd.getMonth() + 6);
    } else if (billingCycle === "quarterly") {
      periodEnd.setMonth(periodEnd.getMonth() + 3);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    if (currentSubscription) {
      // Update existing subscription
      const [updatedSubscription] = await db
        .update(companySubscriptions)
        .set({
          planId: body.planId,
          billingCycle,
          currentPrice: price.toFixed(2),
          currency: targetPlan.currency,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(companySubscriptions.id, currentSubscription.id))
        .returning();

      // TODO: Integrate with payment provider (Stripe, etc.)
      // - Create/update Stripe subscription
      // - Handle proration for mid-cycle upgrades
      // - Process payment

      if (!updatedSubscription) {
        return NextResponse.json(
          { error: "Failed to update subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        subscription: {
          id: updatedSubscription.id,
          planId: updatedSubscription.planId,
          planName: targetPlan.name,
          billingCycle: updatedSubscription.billingCycle,
          currentPrice: updatedSubscription.currentPrice,
          currency: updatedSubscription.currency,
          status: updatedSubscription.status,
          currentPeriodStart: updatedSubscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: updatedSubscription.currentPeriodEnd.toISOString(),
        },
        message: `Successfully upgraded to ${targetPlan.name}`,
      });
    } else {
      // Create new subscription
      const [newSubscription] = await db
        .insert(companySubscriptions)
        .values({
          companyId: company.id,
          planId: body.planId,
          billingCycle,
          status: "active",
          currentPrice: price.toFixed(2),
          currency: targetPlan.currency,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          conversationsUsed: 0,
          storageUsedMb: 0,
        })
        .returning();

      if (!newSubscription) {
        return NextResponse.json(
          { error: "Failed to create subscription" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          subscription: {
            id: newSubscription.id,
            planId: newSubscription.planId,
            planName: targetPlan.name,
            billingCycle: newSubscription.billingCycle,
            currentPrice: newSubscription.currentPrice,
            currency: newSubscription.currency,
            status: newSubscription.status,
            currentPeriodStart: newSubscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: newSubscription.currentPeriodEnd.toISOString(),
          },
          message: `Successfully subscribed to ${targetPlan.name}`,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Error upgrading subscription:", error);
    return NextResponse.json(
      { error: "Failed to upgrade subscription" },
      { status: 500 }
    );
  }
}

// Handle subscription cancellation
export async function DELETE(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const immediate = searchParams.get("immediate") === "true";

    // Get current subscription
    const [subscription] = await db
      .select()
      .from(companySubscriptions)
      .where(eq(companySubscriptions.companyId, company.id))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    if (immediate) {
      // Immediate cancellation
      await db
        .update(companySubscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companySubscriptions.id, subscription.id));

      return NextResponse.json({
        message: "Subscription canceled immediately",
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
        message: `Subscription will be canceled at ${subscription.currentPeriodEnd.toISOString()}`,
        cancelAt: subscription.currentPeriodEnd.toISOString(),
      });
    }
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
