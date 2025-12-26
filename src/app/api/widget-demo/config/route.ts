import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { agents, companies } from "@/lib/db/schema";

/**
 * GET /api/widget-demo/config
 *
 * Returns the first active agent from the E2E test company for widget demo.
 * This is used for E2E testing purposes only.
 */
export async function GET() {
  try {
    // Find E2E test company
    const e2eCompany = await db.query.companies.findFirst({
      where: eq(companies.slug, "e2e-test"),
    });

    if (!e2eCompany) {
      // Fallback to any company with active agents
      const anyAgent = await db.query.agents.findFirst({
        where: eq(agents.status, "active"),
        with: {
          company: true,
        },
      });

      if (!anyAgent) {
        return NextResponse.json(
          { error: "No active agents found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        agentId: anyAgent.id,
        companyId: anyAgent.companyId,
        agentName: anyAgent.name,
      });
    }

    // Find active agent for E2E test company
    const e2eAgent = await db.query.agents.findFirst({
      where: and(
        eq(agents.companyId, e2eCompany.id),
        eq(agents.status, "active")
      ),
    });

    if (!e2eAgent) {
      return NextResponse.json(
        { error: "No active agent found for E2E test company" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      agentId: e2eAgent.id,
      companyId: e2eCompany.id,
      agentName: e2eAgent.name,
      companyName: e2eCompany.name,
    });
  } catch (error) {
    console.error("Error fetching widget demo config:", error);
    return NextResponse.json(
      { error: "Failed to fetch widget config" },
      { status: 500 }
    );
  }
}
