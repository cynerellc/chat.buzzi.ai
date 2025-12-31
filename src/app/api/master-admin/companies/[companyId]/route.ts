import { and, count, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  agents,
  companies,
  companyPermissions,
  companySubscriptions,
  conversations,
  messages,
  subscriptionPlans,
  users,
  type Company,
} from "@/lib/db/schema";

// Company details interface
export interface CompanyDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  domain: string | null;
  domainVerified: boolean;
  primaryColor: string | null;
  secondaryColor: string | null;
  timezone: string | null;
  locale: string | null;
  status: Company["status"];
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  admin: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  stats: {
    users: number;
    agents: number;
    conversations: number;
    messages: number;
  };
  subscription: {
    id: string;
    planId: string;
    planName: string;
    status: string;
    billingCycle: string;
    currentPrice: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  } | null;
}

// Update company schema
const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().optional(),
  domain: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  status: z.enum(["trial", "active", "past_due", "grace_period", "expired", "cancelled"]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// GET /api/master-admin/companies/[companyId] - Get company details
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;

    // Get company
    const [company] = await db
      .select()
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

    // H1: Parallelize all independent queries after company validation
    const [
      [admin],
      [usersCount],
      [agentsCount],
      [conversationsCount],
      [messagesCount],
      [subscription],
    ] = await Promise.all([
      // Get admin user (first company_admin for this company)
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
        .where(
          and(
            eq(companyPermissions.companyId, companyId),
            eq(companyPermissions.role, "chatapp.company_admin"),
            sql`${users.deletedAt} IS NULL`
          )
        )
        .limit(1),

      // Get users count
      db
        .select({ count: count() })
        .from(companyPermissions)
        .innerJoin(users, eq(companyPermissions.userId, users.id))
        .where(
          and(
            eq(companyPermissions.companyId, companyId),
            sql`${users.deletedAt} IS NULL`
          )
        ),

      // Get agents count
      db
        .select({ count: count() })
        .from(agents)
        .where(
          and(
            eq(agents.companyId, companyId),
            sql`${agents.deletedAt} IS NULL`
          )
        ),

      // Get conversations count
      db
        .select({ count: count() })
        .from(conversations)
        .where(eq(conversations.companyId, companyId)),

      // Get message count using subquery (single query instead of two-step)
      db
        .select({ count: count() })
        .from(messages)
        .where(
          inArray(
            messages.conversationId,
            db.select({ id: conversations.id }).from(conversations).where(eq(conversations.companyId, companyId))
          )
        ),

      // Get subscription
      db
        .select({
          id: companySubscriptions.id,
          planId: companySubscriptions.planId,
          planName: subscriptionPlans.name,
          status: companySubscriptions.status,
          billingCycle: companySubscriptions.billingCycle,
          currentPrice: companySubscriptions.currentPrice,
          currentPeriodStart: companySubscriptions.currentPeriodStart,
          currentPeriodEnd: companySubscriptions.currentPeriodEnd,
        })
        .from(companySubscriptions)
        .innerJoin(
          subscriptionPlans,
          eq(companySubscriptions.planId, subscriptionPlans.id)
        )
        .where(eq(companySubscriptions.companyId, companyId))
        .limit(1),
    ]);

    const response: CompanyDetails = {
      id: company.id,
      name: company.name,
      slug: company.slug,
      description: company.description,
      logoUrl: company.logoUrl,
      domain: company.customDomain,
      domainVerified: company.customDomainVerified ?? false,
      primaryColor: company.primaryColor,
      secondaryColor: company.secondaryColor,
      timezone: company.timezone,
      locale: company.locale,
      status: company.status,
      settings: (company.settings as Record<string, unknown>) ?? {},
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      admin: admin ?? null,
      stats: {
        users: usersCount?.count ?? 0,
        agents: agentsCount?.count ?? 0,
        conversations: conversationsCount?.count ?? 0,
        messages: messagesCount?.count ?? 0,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            planName: subscription.planName,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            currentPrice: subscription.currentPrice,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    );
  }
}

// PATCH /api/master-admin/companies/[companyId] - Update company
export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const body = await request.json();
    const data = updateCompanySchema.parse(body);

    // Check if company exists
    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Partial<typeof companies.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.domain !== undefined) updateData.customDomain = data.domain;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.settings !== undefined) updateData.settings = data.settings;

    // Update company
    const [updated] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, companyId))
      .returning();

    return NextResponse.json({
      company: updated,
      message: "Company updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}

// DELETE /api/master-admin/companies/[companyId] - Soft delete company
export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;

    // Check if company exists
    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, companyId),
          sql`${companies.deletedAt} IS NULL`
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Soft delete company
    const now = new Date();
    await db
      .update(companies)
      .set({
        deletedAt: now,
        updatedAt: now,
        status: "cancelled",
      })
      .where(eq(companies.id, companyId));

    // Also soft delete all users in the company
    const companyUserIds = await db
      .select({ userId: companyPermissions.userId })
      .from(companyPermissions)
      .where(eq(companyPermissions.companyId, companyId));

    if (companyUserIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db
        .update(users)
        .set({
          deletedAt: now,
          updatedAt: now,
          isActive: false,
        })
        .where(inArray(users.id, companyUserIds.map(u => u.userId)));
    }

    return NextResponse.json({
      message: "Company deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json(
      { error: "Failed to delete company" },
      { status: 500 }
    );
  }
}
