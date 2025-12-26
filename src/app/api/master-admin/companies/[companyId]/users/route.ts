import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies, companyPermissions, users } from "@/lib/db/schema";
import type { CompanyPermissionRole } from "@/lib/db/schema/company-permissions";

// User list item interface
export interface CompanyUserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// Add user request schema
const addUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(255),
  role: z.enum(["chatapp.company_admin", "chatapp.support_agent"]),
  sendInvite: z.boolean().default(true),
});

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// GET /api/master-admin/companies/[companyId]/users - List company users
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

    // Get users via company_permissions
    const companyUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: companyPermissions.role, // Company role from permissions
        status: users.status,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(companyPermissions, eq(users.id, companyPermissions.userId))
      .where(
        and(
          eq(companyPermissions.companyId, companyId),
          sql`${users.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: companyUsers });
  } catch (error) {
    console.error("Error fetching company users:", error);
    return NextResponse.json(
      { error: "Failed to fetch company users" },
      { status: 500 }
    );
  }
}

// POST /api/master-admin/companies/[companyId]/users - Add user to company
export async function POST(request: Request, context: RouteContext) {
  try {
    await requireMasterAdmin();

    const { companyId } = await context.params;
    const body = await request.json();
    const data = addUserSchema.parse(body);

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

    // Check if user email already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Create user with base role
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        role: "chatapp.user",
        status: "pending",
      })
      .returning();

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    // Create company permission for the user
    await db.insert(companyPermissions).values({
      companyId,
      userId: newUser.id,
      role: data.role as CompanyPermissionRole,
    });

    // TODO: Send invite email if data.sendInvite is true

    return NextResponse.json(
      {
        user: {
          ...newUser,
          role: data.role, // Return company role instead of base role
        },
        message: "User added successfully",
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

    console.error("Error adding user to company:", error);
    return NextResponse.json(
      { error: "Failed to add user to company" },
      { status: 500 }
    );
  }
}
