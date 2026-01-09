import { eq, count, and, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, agents, type PackageVariableDefinition, type AgentListItem } from "@/lib/db/schema";

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
  agentsList: AgentListItem[];
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

    const response: PackageDetails = {
      ...pkg,
      packageType: pkg.packageType as "single_agent" | "multi_agent",
      defaultBehavior: pkg.defaultBehavior as Record<string, unknown>,
      features: pkg.features as unknown[],
      executionConfig: pkg.executionConfig as Record<string, unknown>,
      agentsCount: countResult?.count ?? 0,
      // Agents list is now stored directly in the package as JSONB
      agentsList: (pkg.agentsList as AgentListItem[]) || [],
      // Variables are also stored directly in the package as JSONB
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

// Agent list item schema for update (matches AgentListItem interface)
const agentListItemSchema = z.object({
  agent_identifier: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  designation: z.string().max(255).optional(),
  agent_type: z.enum(["worker", "supervisor"]).default("worker"),
  avatar_url: z.string().max(500).optional(),
  default_system_prompt: z.string().min(1),
  default_model_id: z.string().default("gpt-5-mini"),
  model_settings: z.record(z.string(), z.unknown()).default({ temperature: 0.7, max_tokens: 4096, top_p: 1 }),
  knowledge_base_enabled: z.boolean().optional(),
  knowledge_categories: z.array(z.string()).default([]),
  tools: z.array(z.unknown()).default([]),
  managed_agent_ids: z.array(z.string()).default([]),
  sort_order: z.number().int().default(0),
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
  defaultBehavior: z.record(z.string(), z.unknown()).optional(),
  features: z.array(z.string()).optional(),
  agentsList: z.array(agentListItemSchema).optional(),
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

    // Agents list is now stored directly in the package as JSONB array
    if (validatedData.agentsList !== undefined) {
      updateData.agentsList = validatedData.agentsList.map((agent, index) => ({
        agent_identifier: agent.agent_identifier,
        name: agent.name,
        designation: agent.designation,
        agent_type: agent.agent_type,
        avatar_url: agent.avatar_url,
        default_system_prompt: agent.default_system_prompt,
        default_model_id: agent.default_model_id,
        model_settings: agent.model_settings,
        knowledge_base_enabled: agent.knowledge_base_enabled,
        knowledge_categories: agent.knowledge_categories,
        tools: agent.tools,
        managed_agent_ids: agent.managed_agent_ids,
        sort_order: agent.sort_order ?? index,
      }));
    }

    // Update the package
    const [updatedPackage] = await db
      .update(agentPackages)
      .set(updateData)
      .where(eq(agentPackages.id, packageId))
      .returning();

    if (!updatedPackage) {
      return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
    }

    return NextResponse.json({
      package: {
        ...updatedPackage,
        packageType: updatedPackage.packageType as "single_agent" | "multi_agent",
        defaultBehavior: updatedPackage.defaultBehavior as Record<string, unknown>,
        features: updatedPackage.features as unknown[],
        executionConfig: updatedPackage.executionConfig as Record<string, unknown>,
        // Agents list is now stored directly in the package as JSONB
        agentsList: (updatedPackage.agentsList as AgentListItem[]) || [],
        // Variables are now stored directly in the package as JSONB
        variables: (updatedPackage.variables as PackageVariableDefinition[]) || [],
        createdAt: updatedPackage.createdAt.toISOString(),
        updatedAt: updatedPackage.updatedAt.toISOString(),
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

    // Hard delete if no agents (agents_list is stored in package JSONB, no separate table)
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
