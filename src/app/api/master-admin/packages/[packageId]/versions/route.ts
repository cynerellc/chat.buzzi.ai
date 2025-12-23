import { eq, desc, and, count } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/logger";
import { db } from "@/lib/db";
import { agentPackages, agents, users } from "@/lib/db/schema";

interface RouteContext {
  params: Promise<{ packageId: string }>;
}

// Response types
export interface PackageVersionItem {
  id: string;
  version: string;
  changelog: string | null;
  packageUrl: string | null;
  packageSize: number;
  packageHash: string | null;
  isActive: boolean;
  isCurrent: boolean;
  createdAt: string;
  createdByName: string | null;
  deploymentCount: number;
}

// For simplicity, we'll store version history in a versions JSONB array on the package
// In production, you'd likely have a separate package_versions table
interface VersionRecord {
  id: string;
  version: string;
  changelog: string | null;
  packageUrl: string | null;
  packageSize: number;
  packageHash: string | null;
  isActive: boolean;
  isCurrent: boolean;
  createdAt: string;
  createdById: string | null;
}

const createVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/, "Invalid semantic version format"),
  changelog: z.string().max(2000).optional(),
  packageUrl: z.string().url().optional(),
  packageHash: z.string().optional(),
  packageSize: z.number().int().min(0).optional(),
  setAsCurrent: z.boolean().default(true),
});

/**
 * GET /api/master-admin/packages/[packageId]/versions
 * List all versions of a package
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;

    // Get package with version history
    const [pkg] = await db
      .select()
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Get version history from package features (using it as version storage)
    // In production, this would be a separate table
    const versionHistory = (pkg.features as VersionRecord[] | null) ?? [];

    // Add current version if not in history
    const currentVersionExists = versionHistory.some((v) => v.isCurrent);
    if (!currentVersionExists) {
      versionHistory.unshift({
        id: `${packageId}-v1`,
        version: "1.0.0",
        changelog: "Initial version",
        packageUrl: null,
        packageSize: 0,
        packageHash: null,
        isActive: pkg.isActive,
        isCurrent: true,
        createdAt: pkg.createdAt.toISOString(),
        createdById: null,
      });
    }

    // Get deployment counts per version
    const [deploymentCount] = await db
      .select({ count: count() })
      .from(agents)
      .where(eq(agents.packageId, packageId));

    // Map versions to response format
    const versions: PackageVersionItem[] = await Promise.all(
      versionHistory.map(async (v) => {
        // Get creator name if available
        let createdByName: string | null = null;
        if (v.createdById) {
          const [creator] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, v.createdById))
            .limit(1);
          createdByName = creator?.name ?? creator?.email ?? null;
        }

        return {
          id: v.id,
          version: v.version,
          changelog: v.changelog,
          packageUrl: v.packageUrl,
          packageSize: v.packageSize,
          packageHash: v.packageHash,
          isActive: v.isActive,
          isCurrent: v.isCurrent,
          createdAt: v.createdAt,
          createdByName,
          deploymentCount: v.isCurrent ? deploymentCount?.count ?? 0 : 0,
        };
      })
    );

    // Sort by version (newest first)
    versions.sort((a, b) => {
      const parseVersion = (v: string) => {
        const versionPart = v.split("-")[0] ?? v;
        const parts = versionPart.split(".").map(Number);
        return (parts[0] ?? 0) * 10000 + (parts[1] ?? 0) * 100 + (parts[2] ?? 0);
      };
      return parseVersion(b.version) - parseVersion(a.version);
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Error fetching package versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch package versions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-admin/packages/[packageId]/versions
 * Create a new version of a package
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireMasterAdmin();
    const { packageId } = await context.params;
    const body = await request.json();
    const data = createVersionSchema.parse(body);

    // Get existing package
    const [pkg] = await db
      .select()
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Get current version history
    const versionHistory = (pkg.features as VersionRecord[] | null) ?? [];

    // Check if version already exists
    if (versionHistory.some((v) => v.version === data.version)) {
      return NextResponse.json(
        { error: `Version ${data.version} already exists` },
        { status: 400 }
      );
    }

    // Create new version record
    const newVersion: VersionRecord = {
      id: `${packageId}-v${Date.now()}`,
      version: data.version,
      changelog: data.changelog ?? null,
      packageUrl: data.packageUrl ?? null,
      packageSize: data.packageSize ?? 0,
      packageHash: data.packageHash ?? null,
      isActive: true,
      isCurrent: data.setAsCurrent,
      createdAt: new Date().toISOString(),
      createdById: session.id,
    };

    // If setting as current, unset previous current version
    const updatedHistory = versionHistory.map((v) => ({
      ...v,
      isCurrent: data.setAsCurrent ? false : v.isCurrent,
    }));

    // Add new version to history
    updatedHistory.unshift(newVersion);

    // Update package
    await db
      .update(agentPackages)
      .set({
        features: updatedHistory as unknown[],
        updatedAt: new Date(),
      })
      .where(eq(agentPackages.id, packageId));

    // Log the version creation
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      action: "package.version.create",
      resource: "package_version",
      resourceId: newVersion.id,
      details: {
        packageId,
        packageName: pkg.name,
        version: data.version,
        changelog: data.changelog,
        setAsCurrent: data.setAsCurrent,
      },
    });

    return NextResponse.json({
      success: true,
      version: {
        id: newVersion.id,
        version: newVersion.version,
        changelog: newVersion.changelog,
        packageUrl: newVersion.packageUrl,
        packageSize: newVersion.packageSize,
        packageHash: newVersion.packageHash,
        isActive: newVersion.isActive,
        isCurrent: newVersion.isCurrent,
        createdAt: newVersion.createdAt,
        createdByName: session.name ?? session.email,
        deploymentCount: 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating package version:", error);
    return NextResponse.json(
      { error: "Failed to create package version" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/master-admin/packages/[packageId]/versions
 * Set a specific version as current
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireMasterAdmin();
    const { packageId } = await context.params;
    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: "versionId is required" },
        { status: 400 }
      );
    }

    // Get existing package
    const [pkg] = await db
      .select()
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Get current version history
    const versionHistory = (pkg.features as VersionRecord[] | null) ?? [];

    // Find the version to set as current
    const targetVersion = versionHistory.find((v) => v.id === versionId);
    if (!targetVersion) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // Update all versions - unset current, then set new current
    const updatedHistory = versionHistory.map((v) => ({
      ...v,
      isCurrent: v.id === versionId,
    }));

    // Update package
    await db
      .update(agentPackages)
      .set({
        features: updatedHistory as unknown[],
        updatedAt: new Date(),
      })
      .where(eq(agentPackages.id, packageId));

    // Log the version change
    await createAuditLog({
      userId: session.id,
      userEmail: session.email,
      action: "package.version.setCurrent",
      resource: "package_version",
      resourceId: versionId,
      details: {
        packageId,
        packageName: pkg.name,
        version: targetVersion.version,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Version ${targetVersion.version} is now the current version`,
    });
  } catch (error) {
    console.error("Error setting current version:", error);
    return NextResponse.json(
      { error: "Failed to set current version" },
      { status: 500 }
    );
  }
}
