import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages } from "@/lib/db/schema";

export interface AgentPackageItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  features: unknown[];
}

export async function GET() {
  try {
    await requireCompanyAdmin();

    // Get all active and public packages
    const packages = await db
      .select({
        id: agentPackages.id,
        name: agentPackages.name,
        slug: agentPackages.slug,
        description: agentPackages.description,
        category: agentPackages.category,
        features: agentPackages.features,
      })
      .from(agentPackages)
      .where(
        and(
          eq(agentPackages.isActive, true),
          eq(agentPackages.isPublic, true)
        )
      )
      .orderBy(agentPackages.sortOrder, agentPackages.name);

    return NextResponse.json({ packages });
  } catch (error) {
    console.error("Error fetching agent packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent packages" },
      { status: 500 }
    );
  }
}
