import { eq, count, and, isNull, asc, desc, or, ilike, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { subscriptionPlans, companySubscriptions } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils/slug";

// Response type for list endpoint
export interface PlanListItem {
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

export interface PlansListResponse {
  plans: PlanListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// GET /api/master-admin/plans - List all plans
export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50");
    const search = searchParams.get("search") ?? "";
    const isActive = searchParams.get("isActive");
    const sortBy = searchParams.get("sortBy") ?? "sortOrder";
    const sortOrder = searchParams.get("sortOrder") ?? "asc";

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(subscriptionPlans.name, `%${search}%`),
          ilike(subscriptionPlans.slug, `%${search}%`)
        )
      );
    }

    if (isActive !== null && isActive !== "") {
      conditions.push(eq(subscriptionPlans.isActive, isActive === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(subscriptionPlans)
      .where(whereClause);

    const totalItems = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get plans with company counts
    const orderColumn = sortBy === "name" ? subscriptionPlans.name
      : sortBy === "basePrice" ? subscriptionPlans.basePrice
      : sortBy === "createdAt" ? subscriptionPlans.createdAt
      : subscriptionPlans.sortOrder;

    const orderDir = sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn);

    const plans = await db
      .select({
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
        isActive: subscriptionPlans.isActive,
        isPublic: subscriptionPlans.isPublic,
        sortOrder: subscriptionPlans.sortOrder,
        trialDays: subscriptionPlans.trialDays,
        createdAt: subscriptionPlans.createdAt,
        updatedAt: subscriptionPlans.updatedAt,
      })
      .from(subscriptionPlans)
      .where(whereClause)
      .orderBy(orderDir)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Get company counts for each plan
    const planIds = plans.map((p) => p.id);
    const companyCounts = planIds.length > 0
      ? await db
          .select({
            planId: companySubscriptions.planId,
            count: count(),
          })
          .from(companySubscriptions)
          .where(
            and(
              inArray(companySubscriptions.planId, planIds),
              isNull(companySubscriptions.cancelledAt)
            )
          )
          .groupBy(companySubscriptions.planId)
      : [];

    const countMap = new Map(companyCounts.map((c) => [c.planId, c.count]));

    const plansWithCounts: PlanListItem[] = plans.map((plan) => ({
      ...plan,
      basePrice: plan.basePrice.toString(),
      features: plan.features as unknown[],
      companiesCount: countMap.get(plan.id) ?? 0,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }));

    const response: PlansListResponse = {
      plans: plansWithCounts,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

// Create plan schema
const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  basePrice: z.string().or(z.number()).transform((val) => String(val)),
  currency: z.string().length(3).default("USD"),
  maxAgents: z.number().int().min(1),
  maxConversationsPerMonth: z.number().int().min(0),
  maxKnowledgeSources: z.number().int().min(0),
  maxStorageGb: z.number().int().min(0),
  maxTeamMembers: z.number().int().min(1),
  features: z.array(z.string()).default([]),
  customBranding: z.boolean().default(false),
  prioritySupport: z.boolean().default(false),
  apiAccess: z.boolean().default(false),
  advancedAnalytics: z.boolean().default(false),
  customIntegrations: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  trialDays: z.number().int().min(0).default(14),
});

// POST /api/master-admin/plans - Create a new plan
export async function POST(request: NextRequest) {
  try {
    await requireMasterAdmin();
    const body = await request.json();
    const validatedData = createPlanSchema.parse(body);

    // Generate slug from name
    let slug = generateSlug(validatedData.name);

    // Check for slug uniqueness
    const existingPlan = await db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, slug))
      .limit(1);

    if (existingPlan.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    // Create the plan
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values({
        name: validatedData.name,
        slug,
        description: validatedData.description ?? null,
        basePrice: validatedData.basePrice,
        currency: validatedData.currency,
        maxAgents: validatedData.maxAgents,
        maxConversationsPerMonth: validatedData.maxConversationsPerMonth,
        maxKnowledgeSources: validatedData.maxKnowledgeSources,
        maxStorageGb: validatedData.maxStorageGb,
        maxTeamMembers: validatedData.maxTeamMembers,
        features: validatedData.features,
        customBranding: validatedData.customBranding,
        prioritySupport: validatedData.prioritySupport,
        apiAccess: validatedData.apiAccess,
        advancedAnalytics: validatedData.advancedAnalytics,
        customIntegrations: validatedData.customIntegrations,
        isActive: validatedData.isActive,
        isPublic: validatedData.isPublic,
        sortOrder: validatedData.sortOrder,
        trialDays: validatedData.trialDays,
      })
      .returning();

    return NextResponse.json({ plan: newPlan }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating plan:", error);
    return NextResponse.json(
      { error: "Failed to create plan" },
      { status: 500 }
    );
  }
}
