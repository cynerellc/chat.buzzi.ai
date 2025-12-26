/**
 * Login Redirect API
 *
 * GET /api/auth/redirect - Get redirect URL after login
 *
 * Logic:
 * 1. Master admin → /admin/dashboard
 * 2. User with active company → that company's dashboard
 * 3. User with companies but no active → /companies (company selection)
 * 4. User with no companies → /companies (create company page)
 */

import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { users, companies, companyPermissions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/guards";
import { setActiveCompanyId } from "@/lib/auth/tenant";
import { getCompanyDashboardUrl } from "@/lib/auth/role-utils";
import type { CompanyPermissionRole } from "@/lib/auth/role-utils";

export async function GET() {
  try {
    const sessionUser = await requireAuth();

    // 1. Master admin → /admin/dashboard
    if (sessionUser.role === "chatapp.master_admin") {
      return NextResponse.json({
        redirectUrl: "/admin/dashboard",
        reason: "master_admin",
      });
    }

    // Get full user with activeCompanyId
    const user = await db.query.users.findFirst({
      where: eq(users.id, sessionUser.id),
    });

    if (!user) {
      return NextResponse.json({
        redirectUrl: "/companies",
        reason: "user_not_found",
      });
    }

    // 2. User with active company → check if still valid
    if (user.activeCompanyId) {
      // Verify the company still exists and user has permission
      const company = await db.query.companies.findFirst({
        where: and(
          eq(companies.id, user.activeCompanyId),
          isNull(companies.deletedAt)
        ),
      });

      if (company) {
        const permission = await db.query.companyPermissions.findFirst({
          where: and(
            eq(companyPermissions.userId, user.id),
            eq(companyPermissions.companyId, user.activeCompanyId)
          ),
        });

        if (permission) {
          // Set the cookie as well for consistency
          await setActiveCompanyId(user.activeCompanyId);

          const permissionRole = permission.role as CompanyPermissionRole;
          return NextResponse.json({
            redirectUrl: getCompanyDashboardUrl(permissionRole),
            reason: "active_company",
            companyId: user.activeCompanyId,
            companyName: company.name,
            role: permissionRole,
          });
        }
      }

      // Active company no longer valid, clear it
      await db
        .update(users)
        .set({ activeCompanyId: null, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    // 3. Check if user has any company permissions
    const userPermissions = await db.query.companyPermissions.findMany({
      where: eq(companyPermissions.userId, user.id),
      with: {
        company: true,
      },
    });

    // Filter valid companies (not deleted)
    const validPermissions = userPermissions.filter(
      (p) => p.company && !p.company.deletedAt
    );

    if (validPermissions.length === 0) {
      // 4. User has no companies → /companies (create company page)
      return NextResponse.json({
        redirectUrl: "/companies",
        reason: "no_companies",
      });
    }

    // Sort by role (company_admin first)
    validPermissions.sort((a, b) => {
      const roleOrder: Record<string, number> = {
        "chatapp.company_admin": 0,
        "chatapp.support_agent": 1,
      };
      return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
    });

    // If user has exactly one company, auto-select it
    if (validPermissions.length === 1) {
      const permission = validPermissions[0]!;
      await setActiveCompanyId(permission.companyId);

      const permissionRole = permission.role as CompanyPermissionRole;
      return NextResponse.json({
        redirectUrl: getCompanyDashboardUrl(permissionRole),
        reason: "single_company_auto_select",
        companyId: permission.companyId,
        companyName: permission.company?.name,
        role: permissionRole,
      });
    }

    // User has multiple companies but no active → /companies (company selection)
    return NextResponse.json({
      redirectUrl: "/companies",
      reason: "multiple_companies",
      companyCount: validPermissions.length,
    });
  } catch (error) {
    console.error("Login redirect error:", error);
    return NextResponse.json(
      { error: "Failed to determine redirect" },
      { status: 500 }
    );
  }
}
