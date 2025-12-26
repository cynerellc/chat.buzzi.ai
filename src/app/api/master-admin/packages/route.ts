import { eq, count, and, isNull, asc, desc, or, ilike, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, agents, packageAgents, type PackageVariableDefinition } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils/slug";

// Response type for list endpoint
export interface PackageListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  packageType: "single_agent" | "multi_agent";
  defaultSystemPrompt: string;
  defaultModelId: string;
  defaultTemperature: number;
  defaultBehavior: Record<string, unknown>;
  features: unknown[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  agentsCount: number;
  packageAgentsCount: number;
  variablesCount: number;
  securedVariablesCount: number;
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
    const packageType = searchParams.get("packageType");
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

    if (packageType && packageType !== "all") {
      conditions.push(eq(agentPackages.packageType, packageType as "single_agent" | "multi_agent"));
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

    // Get agent counts for each package (deployed agents)
    const packageIds = packages.map((p) => p.id);

    let agentCounts: { packageId: string | null; count: number }[] = [];
    if (packageIds.length > 0) {
      agentCounts = await db
        .select({
          packageId: agents.packageId,
          count: count(),
        })
        .from(agents)
        .where(
          and(
            isNull(agents.deletedAt),
            inArray(agents.packageId, packageIds)
          )
        )
        .groupBy(agents.packageId);
    }

    const agentCountMap = new Map(
      agentCounts.filter((c) => c.packageId !== null).map((c) => [c.packageId, c.count])
    );

    // Get package agents count for each package
    let packageAgentCounts: { packageId: string; count: number }[] = [];
    if (packageIds.length > 0) {
      packageAgentCounts = await db
        .select({
          packageId: packageAgents.packageId,
          count: count(),
        })
        .from(packageAgents)
        .where(inArray(packageAgents.packageId, packageIds))
        .groupBy(packageAgents.packageId);
    }

    const packageAgentCountMap = new Map(
      packageAgentCounts.map((c) => [c.packageId, c.count])
    );

    // Variable counts are now computed from the JSONB array in each package
    const packagesWithCounts: PackageListItem[] = packages.map((pkg) => {
      const variables = (pkg.variables as PackageVariableDefinition[]) || [];
      const variablesCount = variables.filter((v) => v.variableType === "variable").length;
      const securedVariablesCount = variables.filter((v) => v.variableType === "secured_variable").length;

      return {
        ...pkg,
        packageType: pkg.packageType as "single_agent" | "multi_agent",
        defaultBehavior: pkg.defaultBehavior as Record<string, unknown>,
        features: pkg.features as unknown[],
        agentsCount: agentCountMap.get(pkg.id) ?? 0,
        packageAgentsCount: packageAgentCountMap.get(pkg.id) ?? (pkg.packageType === "single_agent" ? 1 : 0),
        variablesCount,
        securedVariablesCount,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
      };
    });

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

// Package agent schema for create/update
const packageAgentSchema = z.object({
  id: z.string().uuid().optional(),
  agentIdentifier: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  designation: z.string().max(255).nullable().optional(),
  agentType: z.enum(["worker", "supervisor"]).default("worker"),
  systemPrompt: z.string().min(1),
  modelId: z.string().default("gpt-4o-mini"),
  temperature: z.number().int().min(0).max(100).default(70),
  tools: z.array(z.unknown()).default([]),
  managedAgentIds: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});

// Package variable schema for create/update (matches PackageVariableDefinition)
const packageVariableSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[A-Z][A-Z0-9_]*$/, {
    message: "Variable name must be uppercase, start with a letter, and contain only letters, numbers, and underscores",
  }),
  displayName: z.string().min(1).max(255),
  description: z.string().optional(),
  variableType: z.enum(["variable", "secured_variable"]).default("variable"),
  dataType: z.enum(["string", "number", "boolean", "json"]).default("string"),
  defaultValue: z.string().optional(),
  required: z.boolean().default(true),
  validationPattern: z.string().max(500).optional(),
  placeholder: z.string().max(255).optional(),
});

// Create package schema
const createPackageSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  packageType: z.enum(["single_agent", "multi_agent"]).default("single_agent"),
  // Legacy fields for single agent or backward compatibility
  defaultSystemPrompt: z.string().optional().default(""),
  defaultModelId: z.string().default("gpt-4o-mini"),
  defaultTemperature: z.number().int().min(0).max(100).default(70),
  defaultBehavior: z.record(z.string(), z.unknown()).default({}),
  features: z.array(z.string()).default([]),
  // Multi-agent support
  packageAgents: z.array(packageAgentSchema).optional(),
  // Package variables (configurable settings for the package)
  variables: z.array(packageVariableSchema).optional(),
  // Bundle info
  bundlePath: z.string().max(500).nullable().optional(),
  bundleVersion: z.string().max(50).optional().default("1.0.0"),
  bundleChecksum: z.string().max(64).nullable().optional(),
  // Execution config
  executionConfig: z.object({
    maxExecutionTimeMs: z.number().default(30000),
    maxMemoryMb: z.number().default(128),
    allowedNetworkDomains: z.array(z.string()).default([]),
    sandboxMode: z.boolean().default(true),
  }).optional(),
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

    // Prepare variables array for JSONB field
    const variablesArray = (validatedData.variables || []).map((v) => ({
      name: v.name,
      displayName: v.displayName,
      description: v.description,
      variableType: v.variableType,
      dataType: v.dataType,
      defaultValue: v.variableType === "secured_variable" ? undefined : v.defaultValue,
      required: v.required,
      validationPattern: v.validationPattern,
      placeholder: v.placeholder,
    }));

    // Create the package with variables stored as JSONB
    const [newPackage] = await db
      .insert(agentPackages)
      .values({
        name: validatedData.name,
        slug,
        description: validatedData.description ?? null,
        category: validatedData.category ?? null,
        packageType: validatedData.packageType,
        defaultSystemPrompt: validatedData.defaultSystemPrompt,
        defaultModelId: validatedData.defaultModelId,
        defaultTemperature: validatedData.defaultTemperature,
        defaultBehavior: validatedData.defaultBehavior,
        features: validatedData.features,
        bundlePath: validatedData.bundlePath ?? null,
        bundleVersion: validatedData.bundleVersion,
        bundleChecksum: validatedData.bundleChecksum ?? null,
        executionConfig: validatedData.executionConfig ?? {
          maxExecutionTimeMs: 30000,
          maxMemoryMb: 128,
          allowedNetworkDomains: [],
          sandboxMode: true,
        },
        variables: variablesArray,
        isActive: validatedData.isActive,
        isPublic: validatedData.isPublic,
        sortOrder: validatedData.sortOrder,
      })
      .returning();

    if (!newPackage) {
      return NextResponse.json(
        { error: "Failed to create package" },
        { status: 500 }
      );
    }

    // Create package agents if provided
    if (validatedData.packageAgents && validatedData.packageAgents.length > 0) {
      await db.insert(packageAgents).values(
        validatedData.packageAgents.map((agent, index) => ({
          packageId: newPackage.id,
          agentIdentifier: agent.agentIdentifier,
          name: agent.name,
          designation: agent.designation ?? null,
          agentType: agent.agentType as "worker" | "supervisor",
          systemPrompt: agent.systemPrompt,
          modelId: agent.modelId,
          temperature: agent.temperature,
          tools: agent.tools,
          managedAgentIds: agent.managedAgentIds,
          sortOrder: agent.sortOrder ?? index,
        }))
      );
    }

    // Fetch the created package agents
    const createdAgents = await db
      .select()
      .from(packageAgents)
      .where(eq(packageAgents.packageId, newPackage.id))
      .orderBy(asc(packageAgents.sortOrder));

    return NextResponse.json({
      package: {
        ...newPackage,
        packageAgents: createdAgents,
        // Variables are now stored directly in newPackage.variables
        variables: (newPackage.variables as PackageVariableDefinition[]) || [],
      },
    }, { status: 201 });
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
