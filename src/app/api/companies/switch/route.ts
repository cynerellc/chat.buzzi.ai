/**
 * Switch Active Company API
 *
 * POST /api/companies/switch - Switch to a different company
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { companies, companyPermissions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { setActiveCompanyId } from "@/lib/auth/tenant";
import { getCompanyDashboardUrl } from "@/lib/auth/role-utils";
import type { CompanyPermissionRole } from "@/lib/auth/role-utils";

const switchCompanySchema = z.object({
  companyId: z.string().uuid(),
});

/**
 * POST /api/companies/switch
 * Switch to a different company
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { companyId } = switchCompanySchema.parse(body);

    // Check if company exists
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, companyId), isNull(companies.deletedAt)),
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Master admins can access any company
    if (user.role === "chatapp.master_admin") {
      await setActiveCompanyId(companyId);
      return NextResponse.json({
        success: true,
        company,
        role: "chatapp.company_admin",
        redirectUrl: getCompanyDashboardUrl("chatapp.company_admin"),
      });
    }

    // Regular users need permission for this company
    const permission = await db.query.companyPermissions.findFirst({
      where: and(
        eq(companyPermissions.userId, user.id),
        eq(companyPermissions.companyId, companyId)
      ),
    });

    if (!permission) {
      return NextResponse.json(
        { error: "You do not have access to this company" },
        { status: 403 }
      );
    }

    await setActiveCompanyId(companyId);

    const permissionRole = permission.role as CompanyPermissionRole;

    return NextResponse.json({
      success: true,
      company,
      role: permissionRole,
      redirectUrl: getCompanyDashboardUrl(permissionRole),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Switch company error:", error);
    return NextResponse.json(
      { error: "Failed to switch company" },
      { status: 500 }
    );
  }
}
