import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

// Use base config for middleware (Edge runtime compatible)
const { auth } = NextAuth(authConfig);

// Routes that don't require authentication
const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/api/auth",
  "/api/widget",
  "/widget",
];

// Routes for each role
const roleRoutes: Record<string, string[]> = {
  master_admin: ["/admin"],
  company_admin: ["/dashboard", "/agents", "/knowledge", "/conversations", "/team", "/settings", "/analytics"],
  support_agent: ["/inbox", "/conversations"],
};

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes
  if (isPublicRoute) {
    // If user is already logged in and trying to access auth pages, redirect to dashboard
    if (session?.user && ["/login", "/register"].includes(pathname)) {
      return redirectToDashboard(req, session.user.role);
    }
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role;

  // Master admin has access to everything
  if (userRole === "master_admin") {
    return NextResponse.next();
  }

  // Check if user has access to admin routes
  if (pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // Check role-specific route access
  const allowedRoutes = roleRoutes[userRole] || [];
  const hasAccess = allowedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // For company admin and support agent, check if accessing valid routes
  if (!hasAccess && !pathname.startsWith("/api")) {
    // Redirect to appropriate dashboard
    return redirectToDashboard(req, userRole);
  }

  return NextResponse.next();
});

function redirectToDashboard(req: NextRequest, role: string) {
  let dashboardUrl: string;

  switch (role) {
    case "master_admin":
      dashboardUrl = "/admin/dashboard";
      break;
    case "company_admin":
      dashboardUrl = "/dashboard";
      break;
    case "support_agent":
      dashboardUrl = "/inbox";
      break;
    default:
      dashboardUrl = "/dashboard";
  }

  return NextResponse.redirect(new URL(dashboardUrl, req.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
