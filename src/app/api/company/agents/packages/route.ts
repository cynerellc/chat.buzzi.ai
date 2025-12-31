import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages, type PackageVariableDefinition } from "@/lib/db/schema";

// Variable definition for agent packages
export interface PackageVariableItem {
  name: string;
  displayName: string;
  description?: string;
  variableType: "variable" | "secured_variable";
  dataType: "string" | "number" | "boolean" | "json";
  defaultValue?: string;
  required: boolean;
  placeholder?: string;
}

export interface AgentPackageItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  features: unknown[];
  variables: PackageVariableItem[];
}

export async function GET() {
  try {
    await requireCompanyAdmin();

    // Get all active and public packages with their variable definitions
    const packages = await db
      .select({
        id: agentPackages.id,
        name: agentPackages.name,
        slug: agentPackages.slug,
        description: agentPackages.description,
        category: agentPackages.category,
        features: agentPackages.features,
        variables: agentPackages.variables,
      })
      .from(agentPackages)
      .where(
        and(
          eq(agentPackages.isActive, true),
          eq(agentPackages.isPublic, true)
        )
      )
      .orderBy(agentPackages.sortOrder, agentPackages.name);

    // Transform variables to a clean format
    const transformedPackages: AgentPackageItem[] = packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      category: pkg.category,
      features: pkg.features as unknown[],
      variables: ((pkg.variables as PackageVariableDefinition[]) || []).map((v) => ({
        name: v.name,
        displayName: v.displayName,
        description: v.description,
        variableType: v.variableType,
        dataType: v.dataType,
        defaultValue: v.variableType === "secured_variable" ? undefined : v.defaultValue,
        required: v.required,
        placeholder: v.placeholder,
      })),
    }));

    // L1: Add cache headers - agent packages rarely change
    const response = NextResponse.json({ packages: transformedPackages });
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("Error fetching agent packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent packages" },
      { status: 500 }
    );
  }
}
