/**
 * Companies API
 *
 * GET /api/companies - Get all companies the user has access to
 * POST /api/companies - Create a new company
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { eq, isNull, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, companyPermissions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { setActiveCompanyId } from "@/lib/auth/tenant";

const createCompanySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, {
    message: "Slug must be lowercase letters, numbers, and hyphens only",
  }),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/companies
 * Get all companies the user has access to
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Master admins see all companies
    if (user.role === "chatapp.master_admin") {
      const allCompanies = await db.query.companies.findMany({
        where: isNull(companies.deletedAt),
        orderBy: (companies, { asc }) => [asc(companies.name)],
      });

      return NextResponse.json({
        companies: allCompanies.map((company) => ({
          ...company,
          role: "chatapp.company_admin", // Master admins have admin access
        })),
      });
    }

    // Regular users see companies from permissions
    const userPermissions = await db.query.companyPermissions.findMany({
      where: eq(companyPermissions.userId, user.id),
      with: {
        company: true,
      },
    });

    // Filter out deleted companies and map to response format
    const userCompanies = userPermissions
      .filter((p) => p.company && !p.company.deletedAt)
      .map((p) => ({
        ...p.company,
        role: p.role,
      }))
      // Sort by role: company_admin first, then support_agent
      .sort((a, b) => {
        const roleOrder: Record<string, number> = {
          "chatapp.company_admin": 0,
          "chatapp.support_agent": 1,
        };
        return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
      });

    return NextResponse.json({ companies: userCompanies });
  } catch (error) {
    console.error("Get companies error:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies
 * Create a new company
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validatedData = createCompanySchema.parse(body);

    // Check if slug is already taken
    const existingCompany = await db.query.companies.findFirst({
      where: and(
        eq(companies.slug, validatedData.slug),
        isNull(companies.deletedAt)
      ),
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: "A company with this slug already exists" },
        { status: 400 }
      );
    }

    // Create the company
    const [newCompany] = await db
      .insert(companies)
      .values({
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description ?? null,
        status: "trial",
        createdBy: user.id,
      })
      .returning();

    if (!newCompany) {
      throw new Error("Failed to create company");
    }

    // Add company_admin permission for the creator
    await db.insert(companyPermissions).values({
      companyId: newCompany.id,
      userId: user.id,
      role: "chatapp.company_admin",
    });

    // Set this as the active company
    await setActiveCompanyId(newCompany.id);

    return NextResponse.json({
      company: {
        ...newCompany,
        role: "chatapp.company_admin",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Create company error:", error);
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}
