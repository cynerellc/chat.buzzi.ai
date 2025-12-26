import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companySubscriptions, paymentHistory, subscriptionPlans } from "@/lib/db/schema";

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
  trialEndDate: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  conversationsUsed: number;
  conversationsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
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

export async function GET() {
  try {
    const { company } = await requireCompanyAdmin();

    // Get current subscription with plan details
    const [subscription] = await db
      .select({
        id: companySubscriptions.id,
        planId: companySubscriptions.planId,
        billingCycle: companySubscriptions.billingCycle,
        status: companySubscriptions.status,
        currentPrice: companySubscriptions.currentPrice,
        currency: companySubscriptions.currency,
        trialEndDate: companySubscriptions.trialEndDate,
        currentPeriodStart: companySubscriptions.currentPeriodStart,
        currentPeriodEnd: companySubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: companySubscriptions.cancelAtPeriodEnd,
        conversationsUsed: companySubscriptions.conversationsUsed,
        storageUsedMb: companySubscriptions.storageUsedMb,
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
      .where(eq(companySubscriptions.companyId, company.id))
      .limit(1);

    // Get available plans
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
          .where(eq(paymentHistory.companyId, company.id))
          .orderBy(desc(paymentHistory.createdAt))
          .limit(12)
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
          trialEndDate: subscription.trialEndDate?.toISOString() ?? null,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          conversationsUsed: subscription.conversationsUsed,
          conversationsLimit: subscription.plan?.maxConversationsPerMonth ?? 0,
          storageUsedMb: subscription.storageUsedMb,
          storageLimitMb: (subscription.plan?.maxStorageGb ?? 0) * 1024,
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
