import { eq, count, and, isNull, asc, desc, or, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, agents } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils/slug";

// Response type for list endpoint
export interface PackageListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  defaultSystemPrompt: string;
  defaultModelId: string;
  defaultTemperature: number;
  defaultBehavior: Record<string, unknown>;
  features: unknown[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  agentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackagesListResponse {
  packages: PackageListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// GET /api/master-admin/packages - List all packages
export async function GET(request: NextRequest) {
  try {
    await requireMasterAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50");
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category");
    const isActive = searchParams.get("isActive");
    const sortBy = searchParams.get("sortBy") ?? "sortOrder";
    const sortOrder = searchParams.get("sortOrder") ?? "asc";

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(agentPackages.name, `%${search}%`),
          ilike(agentPackages.slug, `%${search}%`),
          ilike(agentPackages.description, `%${search}%`)
        )
      );
    }

    if (category && category !== "all") {
      conditions.push(eq(agentPackages.category, category));
    }

    if (isActive !== null && isActive !== "") {
      conditions.push(eq(agentPackages.isActive, isActive === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(agentPackages)
      .where(whereClause);

    const totalItems = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Get packages
    const orderColumn = sortBy === "name" ? agentPackages.name
      : sortBy === "category" ? agentPackages.category
      : sortBy === "createdAt" ? agentPackages.createdAt
      : agentPackages.sortOrder;

    const orderDir = sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn);

    const packages = await db
      .select()
      .from(agentPackages)
      .where(whereClause)
      .orderBy(orderDir)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Get agent counts for each package
    const packageIds = packages.map((p) => p.id);
    const agentCounts = packageIds.length > 0
      ? await db
          .select({
            packageId: agents.packageId,
            count: count(),
          })
          .from(agents)
          .where(
            and(
              isNull(agents.deletedAt),
              // Only count agents that have a packageId in our list
              ...packageIds.map((id) => eq(agents.packageId, id))
            )
          )
          .groupBy(agents.packageId)
      : [];

    const countMap = new Map(
      agentCounts.filter((c) => c.packageId !== null).map((c) => [c.packageId, c.count])
    );

    const packagesWithCounts: PackageListItem[] = packages.map((pkg) => ({
      ...pkg,
      defaultBehavior: pkg.defaultBehavior as Record<string, unknown>,
      features: pkg.features as unknown[],
      agentsCount: countMap.get(pkg.id) ?? 0,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    }));

    const response: PackagesListResponse = {
      packages: packagesWithCounts,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

// Create package schema
const createPackageSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  defaultSystemPrompt: z.string().min(1),
  defaultModelId: z.string().default("gpt-4o-mini"),
  defaultTemperature: z.number().int().min(0).max(100).default(70),
  defaultBehavior: z.record(z.string(), z.unknown()).default({}),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// POST /api/master-admin/packages - Create a new package
export async function POST(request: NextRequest) {
  try {
    await requireMasterAdmin();
    const body = await request.json();
    const validatedData = createPackageSchema.parse(body);

    // Generate slug from name
    let slug = generateSlug(validatedData.name);

    // Check for slug uniqueness
    const existingPackage = await db
      .select({ id: agentPackages.id })
      .from(agentPackages)
      .where(eq(agentPackages.slug, slug))
      .limit(1);

    if (existingPackage.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    // Create the package
    const [newPackage] = await db
      .insert(agentPackages)
      .values({
        name: validatedData.name,
        slug,
        description: validatedData.description ?? null,
        category: validatedData.category ?? null,
        defaultSystemPrompt: validatedData.defaultSystemPrompt,
        defaultModelId: validatedData.defaultModelId,
        defaultTemperature: validatedData.defaultTemperature,
        defaultBehavior: validatedData.defaultBehavior,
        features: validatedData.features,
        isActive: validatedData.isActive,
        isPublic: validatedData.isPublic,
        sortOrder: validatedData.sortOrder,
      })
      .returning();

    return NextResponse.json({ package: newPackage }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating package:", error);
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}
