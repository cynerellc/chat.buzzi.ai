import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

// Use base config for middleware (Edge runtime compatible)
const { auth } = NextAuth(authConfig);

// M6: Use Set for O(1) exact match lookup on public routes
// Routes that don't require authentication
const publicRoutesExact = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/widget-demo",
  "/embed-widget",
]);

// Public route prefixes (still need startsWith check)
const publicRoutePrefixes = [
  "/api/auth",
  "/api/widget",
  "/widget",
  "/preview",
];

// Routes that require master_admin role (prefix check)
const masterAdminPrefixes = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // M6: O(1) exact match check + O(prefixes) prefix check
  const isPublicRoute =
    publicRoutesExact.has(pathname) ||
    publicRoutePrefixes.some((prefix) => pathname.startsWith(prefix));

  // Allow public routes
  if (isPublicRoute) {
    // If user is already logged in and trying to access auth pages, redirect
    if (session?.user && (pathname === "/login" || pathname === "/register")) {
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

  // Regular users cannot access master admin routes (O(prefixes) check)
  if (masterAdminPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  // For regular users, company-level access is checked in layouts/routes
  // since Edge runtime can't query the database
  // Just allow the request to proceed
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/widget/call/ws (WebSocket endpoint)
     * - api/widget/call/twilio (Twilio WebSocket endpoint)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/widget/call/ws|api/widget/call/twilio|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
