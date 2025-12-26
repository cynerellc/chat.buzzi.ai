import { eq, count, and, isNull, asc, notInArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, agents, packageAgents, type PackageVariableDefinition } from "@/lib/db/schema";

// Package agent response type
export interface PackageAgentDetails {
  id: string;
  packageId: string;
  agentIdentifier: string;
  name: string;
  designation: string | null;
  agentType: "worker" | "supervisor";
  systemPrompt: string;
  modelId: string;
  temperature: number;
  tools: unknown[];
  managedAgentIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Package variable response type (matches PackageVariableDefinition from schema)
export type PackageVariableDetails = PackageVariableDefinition;

// Response type for single package
export interface PackageDetails {
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
  bundlePath: string | null;
  bundleVersion: string | null;
  bundleChecksum: string | null;
  executionConfig: Record<string, unknown>;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  agentsCount: number;
  packageAgents: PackageAgentDetails[];
  variables: PackageVariableDetails[];
  createdAt: string;
  updatedAt: string;
}

interface RouteParams {
  params: Promise<{ packageId: string }>;
}

// GET /api/master-admin/packages/[packageId] - Get package details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { packageId } = await params;

    // Get package details
    const [pkg] = await db
      .select()
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Get deployed agent count
    const [countResult] = await db
      .select({ count: count() })
      .from(agents)
      .where(
        and(
          eq(agents.packageId, packageId),
          isNull(agents.deletedAt)
        )
      );

    // Get package agents
    const pkgAgents = await db
      .select()
      .from(packageAgents)
      .where(eq(packageAgents.packageId, packageId))
      .orderBy(asc(packageAgents.sortOrder));

    const response: PackageDetails = {
      ...pkg,
      packageType: pkg.packageType as "single_agent" | "multi_agent",
      defaultBehavior: pkg.defaultBehavior as Record<string, unknown>,
      features: pkg.features as unknown[],
      executionConfig: pkg.executionConfig as Record<string, unknown>,
      agentsCount: countResult?.count ?? 0,
      packageAgents: pkgAgents.map((agent) => ({
        ...agent,
        agentType: agent.agentType as "worker" | "supervisor",
        tools: agent.tools as unknown[],
        managedAgentIds: agent.managedAgentIds as string[],
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      })),
      // Variables are now stored directly in the package as JSONB
      variables: (pkg.variables as PackageVariableDefinition[]) || [],
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    };

    return NextResponse.json({ package: response });
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

// Package agent schema for update
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

// Package variable schema for update (matches PackageVariableDefinition)
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

// Update package schema
const updatePackageSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  packageType: z.enum(["single_agent", "multi_agent"]).optional(),
  defaultSystemPrompt: z.string().optional(),
  defaultModelId: z.string().optional(),
  defaultTemperature: z.number().int().min(0).max(100).optional(),
  defaultBehavior: z.record(z.string(), z.unknown()).optional(),
  features: z.array(z.string()).optional(),
  packageAgents: z.array(packageAgentSchema).optional(),
  variables: z.array(packageVariableSchema).optional(),
  bundlePath: z.string().max(500).nullable().optional(),
  bundleVersion: z.string().max(50).optional(),
  bundleChecksum: z.string().max(64).nullable().optional(),
  executionConfig: z.object({
    maxExecutionTimeMs: z.number().optional(),
    maxMemoryMb: z.number().optional(),
    allowedNetworkDomains: z.array(z.string()).optional(),
    sandboxMode: z.boolean().optional(),
  }).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// PATCH /api/master-admin/packages/[packageId] - Update package
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { packageId } = await params;
    const body = await request.json();
    const validatedData = updatePackageSchema.parse(body);

    // Check if package exists
    const [existingPackage] = await db
      .select({ id: agentPackages.id })
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!existingPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Build update object for agentPackages table
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.packageType !== undefined) updateData.packageType = validatedData.packageType;
    if (validatedData.defaultSystemPrompt !== undefined) updateData.defaultSystemPrompt = validatedData.defaultSystemPrompt;
    if (validatedData.defaultModelId !== undefined) updateData.defaultModelId = validatedData.defaultModelId;
    if (validatedData.defaultTemperature !== undefined) updateData.defaultTemperature = validatedData.defaultTemperature;
    if (validatedData.defaultBehavior !== undefined) updateData.defaultBehavior = validatedData.defaultBehavior;
    if (validatedData.features !== undefined) updateData.features = validatedData.features;
    if (validatedData.bundlePath !== undefined) updateData.bundlePath = validatedData.bundlePath;
    if (validatedData.bundleVersion !== undefined) updateData.bundleVersion = validatedData.bundleVersion;
    if (validatedData.bundleChecksum !== undefined) updateData.bundleChecksum = validatedData.bundleChecksum;
    if (validatedData.executionConfig !== undefined) updateData.executionConfig = validatedData.executionConfig;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic;
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder;
    // Variables are now stored directly in the package as JSONB array
    if (validatedData.variables !== undefined) {
      updateData.variables = validatedData.variables.map((v) => ({
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
    }

    // Update the package
    const [updatedPackage] = await db
      .update(agentPackages)
      .set(updateData)
      .where(eq(agentPackages.id, packageId))
      .returning();

    // Handle package agents updates if provided
    if (validatedData.packageAgents !== undefined) {
      const incomingAgents = validatedData.packageAgents;
      const incomingIds = incomingAgents
        .filter((a) => a.id)
        .map((a) => a.id as string);

      // Delete agents that are no longer in the list
      if (incomingIds.length > 0) {
        await db
          .delete(packageAgents)
          .where(
            and(
              eq(packageAgents.packageId, packageId),
              notInArray(packageAgents.id, incomingIds)
            )
          );
      } else {
        // Delete all existing agents if none have IDs
        await db
          .delete(packageAgents)
          .where(eq(packageAgents.packageId, packageId));
      }

      // Upsert agents
      for (let i = 0; i < incomingAgents.length; i++) {
        const agent = incomingAgents[i];
        if (!agent) continue;

        if (agent.id) {
          // Update existing agent
          await db
            .update(packageAgents)
            .set({
              agentIdentifier: agent.agentIdentifier,
              name: agent.name,
              designation: agent.designation ?? null,
              agentType: agent.agentType as "worker" | "supervisor",
              systemPrompt: agent.systemPrompt,
              modelId: agent.modelId,
              temperature: agent.temperature,
              tools: agent.tools,
              managedAgentIds: agent.managedAgentIds,
              sortOrder: agent.sortOrder ?? i,
              updatedAt: new Date(),
            })
            .where(eq(packageAgents.id, agent.id));
        } else {
          // Insert new agent
          await db.insert(packageAgents).values({
            packageId,
            agentIdentifier: agent.agentIdentifier,
            name: agent.name,
            designation: agent.designation ?? null,
            agentType: agent.agentType as "worker" | "supervisor",
            systemPrompt: agent.systemPrompt,
            modelId: agent.modelId,
            temperature: agent.temperature,
            tools: agent.tools,
            managedAgentIds: agent.managedAgentIds,
            sortOrder: agent.sortOrder ?? i,
          });
        }
      }
    }

    // Fetch updated package agents
    const pkgAgents = await db
      .select()
      .from(packageAgents)
      .where(eq(packageAgents.packageId, packageId))
      .orderBy(asc(packageAgents.sortOrder));

    if (!updatedPackage) {
      return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
    }

    return NextResponse.json({
      package: {
        ...updatedPackage,
        packageAgents: pkgAgents.map((agent) => ({
          ...agent,
          agentType: agent.agentType as "worker" | "supervisor",
          tools: agent.tools as unknown[],
          managedAgentIds: agent.managedAgentIds as string[],
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        })),
        // Variables are now stored directly in the package as JSONB
        variables: (updatedPackage.variables as PackageVariableDefinition[]) || [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

// DELETE /api/master-admin/packages/[packageId] - Delete package (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireMasterAdmin();
    const { packageId } = await params;

    // Check if package exists
    const [existingPackage] = await db
      .select({ id: agentPackages.id, name: agentPackages.name })
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!existingPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Check if there are any agents using this package
    const [agentCount] = await db
      .select({ count: count() })
      .from(agents)
      .where(
        and(
          eq(agents.packageId, packageId),
          isNull(agents.deletedAt)
        )
      );

    if ((agentCount?.count ?? 0) > 0) {
      // Soft delete by setting isActive to false instead of hard delete
      await db
        .update(agentPackages)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(agentPackages.id, packageId));

      return NextResponse.json({
        success: true,
        message: "Package deactivated (has active agents)",
        deactivated: true,
      });
    }

    // Hard delete package agents first (cascade should handle this, but being explicit)
    await db
      .delete(packageAgents)
      .where(eq(packageAgents.packageId, packageId));

    // Hard delete if no agents
    await db
      .delete(agentPackages)
      .where(eq(agentPackages.id, packageId));

    return NextResponse.json({ success: true, message: "Package deleted successfully" });
  } catch (error) {
    console.error("Error deleting package:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}
