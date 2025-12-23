/**
 * Support Agent Canned Responses API
 *
 * GET /api/support-agent/responses - List canned responses
 * POST /api/support-agent/responses - Create a new canned response
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cannedResponses } from "@/lib/db/schema/conversations";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { and, eq, or, isNull, desc, ilike, sql } from "drizzle-orm";
import { z } from "zod/v4";

const createResponseSchema = z.object({
  name: z.string().min(1).max(255),
  shortcut: z.string().max(50).optional(),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  isPersonal: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const scope = searchParams.get("scope") ?? "all"; // all, personal, company

    // Build conditions - show shared and user's personal responses
    const conditions = [eq(cannedResponses.companyId, company.id)];

    // Scope filtering
    // isShared=true means team/shared, isShared=false + userId means personal
    if (scope === "personal") {
      conditions.push(eq(cannedResponses.userId, session.user.id));
      conditions.push(eq(cannedResponses.isShared, false));
    } else if (scope === "company") {
      conditions.push(eq(cannedResponses.isShared, true));
    } else {
      // All: shared OR personal (owned by this user)
      conditions.push(
        or(
          eq(cannedResponses.isShared, true),
          and(
            eq(cannedResponses.userId, session.user.id),
            eq(cannedResponses.isShared, false)
          )
        )!
      );
    }

    // Category filter
    if (category) {
      conditions.push(eq(cannedResponses.category, category));
    }

    // Search filter
    if (search) {
      conditions.push(
        or(
          ilike(cannedResponses.name, `%${search}%`),
          ilike(cannedResponses.content, `%${search}%`),
          ilike(cannedResponses.shortcut, `%${search}%`)
        )!
      );
    }

    // Get responses
    const responses = await db
      .select({
        id: cannedResponses.id,
        title: cannedResponses.name,
        shortcut: cannedResponses.shortcut,
        content: cannedResponses.content,
        category: cannedResponses.category,
        tags: cannedResponses.tags,
        usageCount: cannedResponses.usageCount,
        isPersonal: sql<boolean>`NOT ${cannedResponses.isShared}`,
        createdAt: cannedResponses.createdAt,
        updatedAt: cannedResponses.updatedAt,
      })
      .from(cannedResponses)
      .where(and(...conditions))
      .orderBy(desc(cannedResponses.usageCount), desc(cannedResponses.createdAt));

    // Get categories for filtering
    const categories = await db
      .selectDistinct({ category: cannedResponses.category })
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.companyId, company.id),
          or(
            eq(cannedResponses.isShared, true),
            and(
              eq(cannedResponses.userId, session.user.id),
              eq(cannedResponses.isShared, false)
            )
          )
        )
      );

    return NextResponse.json({
      responses,
      categories: categories
        .map((c) => c.category)
        .filter((c): c is string => c !== null),
    });
  } catch (error) {
    console.error("Support agent responses error:", error);
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get company
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const data = createResponseSchema.parse(body);

    // Check for duplicate shortcut
    if (data.shortcut) {
      const existing = await db
        .select({ id: cannedResponses.id })
        .from(cannedResponses)
        .where(
          and(
            eq(cannedResponses.companyId, company.id),
            eq(cannedResponses.shortcut, data.shortcut)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: "A response with this shortcut already exists" },
          { status: 400 }
        );
      }
    }

    // Create response
    const [response] = await db
      .insert(cannedResponses)
      .values({
        companyId: company.id,
        userId: data.isPersonal ? session.user.id : null,
        name: data.name,
        shortcut: data.shortcut || null,
        content: data.content,
        category: data.category || null,
        tags: data.tags,
        isShared: !data.isPersonal,
      })
      .returning();

    return NextResponse.json({ response }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Support agent create response error:", error);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}
