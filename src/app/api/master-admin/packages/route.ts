import { eq, count, and, isNull, asc, desc, or, ilike, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, agents, type PackageVariableDefinition, type AgentListItem } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils/slug";

// Response type for list endpoint
export interface PackageListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  packageType: "single_agent" | "multi_agent";
  chatbotType: "chat" | "call";
  isCustomPackage: boolean;
  defaultBehavior: Record<string, unknown>;
  features: unknown[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  agentsCount: number;
  agentsListCount: number;
  variablesCount: number;
  securedVariablesCount: number;
  bundlePath: string | null;
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

    // Variable and agents list counts are now computed from the JSONB arrays in each package
    const packagesWithCounts: PackageListItem[] = packages.map((pkg) => {
      const variables = (pkg.variables as PackageVariableDefinition[]) || [];
      const agentsList = (pkg.agentsList as AgentListItem[]) || [];
      const variablesCount = variables.filter((v) => v.variableType === "variable").length;
      const securedVariablesCount = variables.filter((v) => v.variableType === "secured_variable").length;

      return {
        ...pkg,
        packageType: pkg.packageType as "single_agent" | "multi_agent",
        chatbotType: pkg.chatbotType as "chat" | "call",
        isCustomPackage: pkg.isCustomPackage,
        defaultBehavior: pkg.defaultBehavior as Record<string, unknown>,
        features: pkg.features as unknown[],
        agentsCount: agentCountMap.get(pkg.id) ?? 0,
        agentsListCount: agentsList.length,
        variablesCount,
        securedVariablesCount,
        bundlePath: pkg.bundlePath,
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

// Agent list item schema for create/update (matches AgentListItem interface)
const agentListItemSchema = z.object({
  agent_identifier: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  designation: z.string().max(255).optional(),
  agent_type: z.enum(["worker", "supervisor"]).default("worker"),
  avatar_url: z.string().max(500).optional(),
  default_system_prompt: z.string().min(1),
  default_model_id: z.string().default("gpt-5-mini"),
  default_temperature: z.number().int().min(0).max(100).default(70),
  knowledge_categories: z.array(z.string()).default([]),
  tools: z.array(z.unknown()).default([]),
  managed_agent_ids: z.array(z.string()).default([]),
  sort_order: z.number().int().default(0),
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
  chatbotType: z.enum(["chat", "call"]).default("chat"),
  isCustomPackage: z.boolean().default(false),
  // Default behavior shared across all agents in the package
  defaultBehavior: z.record(z.string(), z.unknown()).default({}),
  features: z.array(z.string()).default([]),
  // Agents list (stored as JSONB array in agentPackages.agents_list)
  agentsList: z.array(agentListItemSchema).optional(),
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

    // Prepare agents list array for JSONB field
    const agentsListArray: AgentListItem[] = (validatedData.agentsList || []).map((agent, index) => ({
      agent_identifier: agent.agent_identifier,
      name: agent.name,
      designation: agent.designation,
      agent_type: agent.agent_type,
      avatar_url: agent.avatar_url,
      default_system_prompt: agent.default_system_prompt,
      default_model_id: agent.default_model_id,
      default_temperature: agent.default_temperature,
      knowledge_categories: agent.knowledge_categories,
      tools: agent.tools,
      managed_agent_ids: agent.managed_agent_ids,
      sort_order: agent.sort_order ?? index,
    }));

    // Create the package with variables and agents_list stored as JSONB
    const [newPackage] = await db
      .insert(agentPackages)
      .values({
        name: validatedData.name,
        slug,
        description: validatedData.description ?? null,
        category: validatedData.category ?? null,
        packageType: validatedData.packageType,
        chatbotType: validatedData.chatbotType,
        isCustomPackage: validatedData.isCustomPackage,
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
        agentsList: agentsListArray,
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

    return NextResponse.json({
      package: {
        ...newPackage,
        packageType: newPackage.packageType as "single_agent" | "multi_agent",
        defaultBehavior: newPackage.defaultBehavior as Record<string, unknown>,
        features: newPackage.features as unknown[],
        executionConfig: newPackage.executionConfig as Record<string, unknown>,
        agentsList: (newPackage.agentsList as AgentListItem[]) || [],
        variables: (newPackage.variables as PackageVariableDefinition[]) || [],
        createdAt: newPackage.createdAt.toISOString(),
        updatedAt: newPackage.updatedAt.toISOString(),
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
