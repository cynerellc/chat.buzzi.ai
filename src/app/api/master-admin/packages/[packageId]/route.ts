import { eq, count, and, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, agents } from "@/lib/db/schema";

// Response type for single package
export interface PackageDetails {
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

    // Get agent count
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
      defaultBehavior: pkg.defaultBehavior as Record<string, unknown>,
      features: pkg.features as unknown[],
      agentsCount: countResult?.count ?? 0,
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

// Update package schema
const updatePackageSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  defaultSystemPrompt: z.string().min(1).optional(),
  defaultModelId: z.string().optional(),
  defaultTemperature: z.number().int().min(0).max(100).optional(),
  defaultBehavior: z.record(z.string(), z.unknown()).optional(),
  features: z.array(z.string()).optional(),
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

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.defaultSystemPrompt !== undefined) updateData.defaultSystemPrompt = validatedData.defaultSystemPrompt;
    if (validatedData.defaultModelId !== undefined) updateData.defaultModelId = validatedData.defaultModelId;
    if (validatedData.defaultTemperature !== undefined) updateData.defaultTemperature = validatedData.defaultTemperature;
    if (validatedData.defaultBehavior !== undefined) updateData.defaultBehavior = validatedData.defaultBehavior;
    if (validatedData.features !== undefined) updateData.features = validatedData.features;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.isPublic !== undefined) updateData.isPublic = validatedData.isPublic;
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder;

    // Update the package
    const [updatedPackage] = await db
      .update(agentPackages)
      .set(updateData)
      .where(eq(agentPackages.id, packageId))
      .returning();

    return NextResponse.json({ package: updatedPackage });
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
