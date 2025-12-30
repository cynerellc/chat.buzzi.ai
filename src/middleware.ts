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
  "/widget-demo",
  "/embed-widget",
];

// Routes that require master_admin role
const masterAdminRoutes = ["/admin"];

// Routes for regular authenticated users (company-level access checked in layouts/routes)
const userRoutes = [
  "/dashboard",
  "/agents",
  "/knowledge",
  "/conversations",
  "/team",
  "/settings",
  "/analytics",
  "/billing",
  "/integrations",
  "/widget",
  "/files",
  "/inbox",
  "/customers",
  "/responses",
  "/agent-settings",
  "/companies",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Allow public routes
  if (isPublicRoute) {
    // If user is already logged in and trying to access auth pages, redirect
    if (session?.user && ["/login", "/register"].includes(pathname)) {
      // For master admin, go directly to admin dashboard
      if (session.user.role === "chatapp.master_admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      }
      // For regular users, redirect to companies page (smart redirect happens on client)
      return NextResponse.redirect(new URL("/companies", req.url));
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
  if (userRole === "chatapp.master_admin") {
    return NextResponse.next();
  }

  // Regular users cannot access master admin routes
  if (masterAdminRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // For regular users, company-level access is checked in layouts/routes
  // since Edge runtime can't query the database
  // Just allow the request to proceed
  return NextResponse.next();
});

function redirectToDashboard(req: NextRequest, role: string) {
  let dashboardUrl: string;

  switch (role) {
    case "chatapp.master_admin":
      dashboardUrl = "/admin/dashboard";
      break;
    case "chatapp.user":
      // Regular users go to company selection
      dashboardUrl = "/companies";
      break;
    default:
      dashboardUrl = "/companies";
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
