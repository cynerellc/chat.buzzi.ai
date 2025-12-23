import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  companies,
  companySubscriptions,
  subscriptionPlans,
  users,
  type Company,
} from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils";

// Company list item interface
export interface CompanyListItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  domain: string | null;
  status: Company["status"];
  plan: {
    id: string;
    name: string;
  } | null;
  usersCount: number;
  createdAt: Date;
}

// Paginated response interface
export interface CompaniesListResponse {
  companies: CompanyListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// Create company request schema
const createCompanySchema = z.object({
  name: z.string().min(2).max(255),
  domain: z.string().optional(),
  planId: z.string().uuid().optional(),
  adminName: z.string().min(2).max(255),
  adminEmail: z.string().email(),
  sendWelcomeEmail: z.boolean().default(true),
});

// GET /api/master-admin/companies - List companies with filters
export async function GET(request: Request) {
  try {
    await requireMasterAdmin();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "10"))
    );
    const offset = (page - 1) * pageSize;

    // Filters
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const planId = searchParams.get("planId");
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortOrder = searchParams.get("sortOrder") ?? "desc";

    // Build where conditions
    const conditions = [sql`${companies.deletedAt} IS NULL`];

    if (search) {
      conditions.push(
        or(
          ilike(companies.name, `%${search}%`),
          ilike(companies.slug, `%${search}%`),
          ilike(companies.customDomain, `%${search}%`)
        ) ?? sql`TRUE`
      );
    }

    if (status) {
      conditions.push(eq(companies.status, status as Company["status"]));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(companies)
      .where(and(...conditions));

    const totalItems = totalResult?.count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get companies with sorting
    const orderByColumn =
      sortBy === "name"
        ? companies.name
        : sortBy === "status"
          ? companies.status
          : companies.createdAt;

    const companiesList = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        logoUrl: companies.logoUrl,
        domain: companies.customDomain,
        status: companies.status,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .where(and(...conditions))
      .orderBy(sortOrder === "asc" ? orderByColumn : desc(orderByColumn))
      .limit(pageSize)
      .offset(offset);

    // Enrich with subscription and user count data
    const enrichedCompanies = await Promise.all(
      companiesList.map(async (company): Promise<CompanyListItem | null> => {
        // Get subscription plan
        const [subscription] = await db
          .select({
            planId: subscriptionPlans.id,
            planName: subscriptionPlans.name,
          })
          .from(companySubscriptions)
          .innerJoin(
            subscriptionPlans,
            eq(companySubscriptions.planId, subscriptionPlans.id)
          )
          .where(eq(companySubscriptions.companyId, company.id))
          .limit(1);

        // Filter by plan if specified
        if (planId && subscription?.planId !== planId) {
          return null;
        }

        // Get user count
        const [userCountResult] = await db
          .select({ count: count() })
          .from(users)
          .where(
            and(
              eq(users.companyId, company.id),
              sql`${users.deletedAt} IS NULL`
            )
          );

        return {
          ...company,
          plan: subscription
            ? { id: subscription.planId, name: subscription.planName }
            : null,
          usersCount: userCountResult?.count ?? 0,
        };
      })
    );

    // Filter out nulls (from plan filter)
    const filteredCompanies = enrichedCompanies.filter(
      (c): c is CompanyListItem => c !== null
    );

    const response: CompaniesListResponse = {
      companies: filteredCompanies,
      pagination: {
        page,
        pageSize,
        totalItems: planId ? filteredCompanies.length : totalItems,
        totalPages: planId
          ? Math.ceil(filteredCompanies.length / pageSize)
          : totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

// POST /api/master-admin/companies - Create a new company
export async function POST(request: Request) {
  try {
    await requireMasterAdmin();

    const body = await request.json();
    const data = createCompanySchema.parse(body);

    // Generate slug from name
    const slug = generateSlug(data.name);

    // Check if slug already exists
    const [existingCompany] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);

    if (existingCompany) {
      return NextResponse.json(
        { error: "A company with this name already exists" },
        { status: 400 }
      );
    }

    // Check if admin email already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.adminEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Create company
    const [newCompany] = await db
      .insert(companies)
      .values({
        name: data.name,
        slug,
        customDomain: data.domain ?? null,
        status: "trial",
      })
      .returning();

    if (!newCompany) {
      throw new Error("Failed to create company");
    }

    // Create admin user
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.adminEmail,
        name: data.adminName,
        companyId: newCompany.id,
        role: "company_admin",
        status: "pending",
      })
      .returning();

    // Create subscription if plan is specified
    if (data.planId) {
      const [plan] = await db
        .select({ basePrice: subscriptionPlans.basePrice })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, data.planId))
        .limit(1);

      if (plan) {
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 14); // 14-day trial

        await db.insert(companySubscriptions).values({
          companyId: newCompany.id,
          planId: data.planId,
          status: "trial",
          currentPrice: plan.basePrice,
          trialStartDate: now,
          trialEndDate: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
        });
      }
    }

    // TODO: Send welcome email if data.sendWelcomeEmail is true

    return NextResponse.json(
      {
        company: newCompany,
        admin: newUser,
        message: "Company created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating company:", error);
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}
