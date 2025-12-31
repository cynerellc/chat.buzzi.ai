import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { db } from "@/lib/db";
import { companies, companyPermissions, companySubscriptions, subscriptionPlans, users } from "@/lib/db/schema";
import { withRateLimit } from "@/lib/redis/rate-limit";

const registerSchema = z.object({
  companyName: z.string().min(2),
  fullName: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    // Rate limiting: 10 registrations per minute per IP
    const rateLimitResult = await withRateLimit(request, "auth");
    if (rateLimitResult) return rateLimitResult;

    const body = await request.json();
    const { companyName, fullName, email, password } = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Generate company slug
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug is unique
    const existingCompany = await db.query.companies.findFirst({
      where: eq(companies.slug, slug),
    });

    const finalSlug = existingCompany
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create company
    const companyResult = await db
      .insert(companies)
      .values({
        name: companyName,
        slug: finalSlug,
        status: "trial",
      })
      .returning();

    const company = companyResult[0];
    if (!company) {
      throw new Error("Failed to create company");
    }

    // Create user with base role
    const userResult = await db
      .insert(users)
      .values({
        email,
        name: fullName,
        hashedPassword,
        role: "chatapp.user",
        status: "active",
        isActive: true,
      })
      .returning();

    const user = userResult[0];
    if (!user) {
      // Rollback company creation
      await db.delete(companies).where(eq(companies.id, company.id));
      throw new Error("Failed to create user");
    }

    // Create company permission for the user as company admin
    await db.insert(companyPermissions).values({
      companyId: company.id,
      userId: user.id,
      role: "chatapp.company_admin",
    });

    // Create trial subscription
    const freePlan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.slug, "starter"),
    });

    if (freePlan) {
      const now = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      await db.insert(companySubscriptions).values({
        companyId: company.id,
        planId: freePlan.id,
        status: "trial",
        billingCycle: "monthly",
        currentPrice: freePlan.basePrice,
        trialStartDate: now,
        trialEndDate: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      });
    }

    return NextResponse.json(
      {
        message: "Account created successfully",
        companyId: company.id,
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid input", errors: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to create account" },
      { status: 500 }
    );
  }
}
