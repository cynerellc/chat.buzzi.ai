/**
 * Company Escalation Stats API
 *
 * Provides analytics and statistics for escalations.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { getEscalationService } from "@/lib/escalation";

/**
 * GET /api/company/escalations/stats
 * Get escalation statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const escalationService = getEscalationService();
    const stats = await escalationService.getEscalationStats(company.id);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Failed to fetch escalation stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
