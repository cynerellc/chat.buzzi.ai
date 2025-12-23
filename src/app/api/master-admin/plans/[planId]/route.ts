import { eq, count, and, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { subscriptionPlans, companySubscriptions } from "@/lib/db/schema";

// Response type for single plan
export interface PlanDetails {
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
  features: unknown[];
  customBranding: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  advancedAnalytics: boolean;
  customIntegrations: boolean;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
  companiesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RouteParams {
  params: Promise<{ planId: string }>;
}

// GET /api/master-admin/plans/[planId] - Get plan details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { planId } = await params;

    // Get plan details
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Get company count
    const [countResult] = await db
      .select({ count: count() })
      .from(companySubscriptions)
      .where(
        and(
          eq(companySubscriptions.planId, planId),
          isNull(companySubscriptions.cancelledAt)
        )
      );

    const response: PlanDetails = {
      ...plan,
      basePrice: plan.basePrice.toString(),
      features: plan.features as unknown[],
      companiesCount: countResult?.count ?? 0,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };

    return NextResponse.json({ plan: response });
  } catch (error) {
    console.error("Error fetching plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

// Update plan schema
const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  basePrice: z.string().or(z.number()).transform((val) => String(val)).optional(),
  currency: z.string().length(3).optional(),
  maxAgents: z.number().int().min(1).optional(),
  maxConversationsPerMonth: z.number().int().min(0).optional(),
  maxKnowledgeSources: z.number().int().min(0).optional(),
  maxStorageGb: z.number().int().min(0).optional(),
  maxTeamMembers: z.number().int().min(1).optional(),
  features: z.array(z.string()).optional(),
  customBranding: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  apiAccess: z.boolean().optional(),
  advancedAnalytics: z.boolean().optional(),
  customIntegrations: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  trialDays: z.number().int().min(0).optional(),
});

// PATCH /api/master-admin/plans/[planId] - Update plan
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { planId } = await params;
    const body = await request.json();
    const validatedData = updatePlanSchema.parse(body);

    // Check if plan exists
    const [existingPlan] = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.basePrice !== undefined) updateData.basePrice = validatedData.basePrice;
    if (validatedData.currency !== undefined) updateData.currency = validatedData.currency;
    if (validatedData.maxAgents !== undefined) updateData.maxAgents = validatedData.maxAgents;
    if (validatedData.maxConversationsPerMonth !== undefined) updateData.maxConversationsPerMonth = validatedData.maxConversationsPerMonth;
    if (validatedData.maxKnowledgeSources !== undefined) updateData.maxKnowledgeSources = validatedData.maxKnowledgeSources;
    if (validatedData.maxStorageGb !== undefined) updateData.maxStorageGb = validatedData.maxStorageGb;
    if (validatedData.maxTeamMembers !== undefined) updateData.maxTeamMembers = validatedData.maxTeamMembers;
    if (validatedData.features !== undefined) updateData.features = validatedData.features;
    if (validatedData.customBranding !== undefined) updateData.customBranding = validatedData.customBranding;
    if (validatedData.prioritySupport !== undefined) updateData.prioritySupport = validatedData.prioritySupport;
    if (validatedData.apiAccess !== undefined) updateData.apiAccess = validatedData.apiAccess;
    if (validatedData.advancedAnalytics !== undefined) updateData.advancedAnalytics = validatedData.advancedAnalytics;
    if (validatedData.customIntegrations !== undefined) updateData.customIntegrations = validatedData.customIntegrations;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic;
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder;
    if (validatedData.trialDays !== undefined) updateData.trialDays = validatedData.trialDays;

    // Update the plan
    const [updatedPlan] = await db
      .update(subscriptionPlans)
      .set(updateData)
      .where(eq(subscriptionPlans.id, planId))
      .returning();

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating plan:", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/master-admin/plans/[planId] - Delete plan (only if no active subscriptions)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { planId } = await params;

    // Check if plan exists
    const [existingPlan] = await db
      .select({ id: subscriptionPlans.id, name: subscriptionPlans.name })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Check if there are any active subscriptions using this plan
    const [subscriptionCount] = await db
      .select({ count: count() })
      .from(companySubscriptions)
      .where(
        and(
          eq(companySubscriptions.planId, planId),
          isNull(companySubscriptions.cancelledAt)
        )
      );

    if ((subscriptionCount?.count ?? 0) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete plan with active subscriptions",
          details: `There are ${subscriptionCount?.count} active subscriptions using this plan. Please migrate them first.`
        },
        { status: 400 }
      );
    }

    // Delete the plan (hard delete since no active subscriptions)
    await db
      .delete(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId));

    return NextResponse.json({ success: true, message: "Plan deleted successfully" });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json(
      { error: "Failed to delete plan" },
      { status: 500 }
    );
  }
}
