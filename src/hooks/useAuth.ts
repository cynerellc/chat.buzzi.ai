"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useEffect } from "react";

import type { UserRole } from "@/lib/auth/role-utils";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

export function useAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const user = useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      avatarUrl: session.user.avatarUrl ?? null,
      role: session.user.role,
    };
  }, [session]);

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!user;

  // Use refs to avoid complex callback dependencies
  const routerRef = useRef(router);
  const userRoleRef = useRef(user?.role);
  const updateRef = useRef(update);

  useEffect(() => {
    routerRef.current = router;
    userRoleRef.current = user?.role;
    updateRef.current = update;
  }, [router, user?.role, update]);

  const login = async (email: string, password: string, callbackUrl?: string) => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    // If there's a specific callback URL, use it
    if (callbackUrl) {
      routerRef.current.push(callbackUrl);
      return result;
    }

    // Otherwise, get smart redirect from API
    try {
      const redirectResponse = await fetch("/api/auth/redirect");
      if (redirectResponse.ok) {
        const { redirectUrl } = await redirectResponse.json();
        routerRef.current.push(redirectUrl);
      } else {
        // Fallback to basic redirect
        routerRef.current.push(getDashboardUrl(userRoleRef.current));
      }
    } catch {
      // Fallback to basic redirect
      routerRef.current.push(getDashboardUrl(userRoleRef.current));
    }

    return result;
  };

  const loginWithGoogle = async (callbackUrl?: string) => {
    await signIn("google", {
      callbackUrl: callbackUrl ?? getDashboardUrl(userRoleRef.current),
    });
  };

  const loginWithGitHub = async (callbackUrl?: string) => {
    await signIn("github", {
      callbackUrl: callbackUrl ?? getDashboardUrl(userRoleRef.current),
    });
  };

  const logout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  // Check if user has the required base role
  // Note: company-specific permissions (company_admin, support_agent) are checked via company context
  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;

    const roleHierarchy: Record<UserRole, number> = {
      "chatapp.master_admin": 2,
      "chatapp.user": 1,
    };

    return roleHierarchy[user.role] >= roleHierarchy[role];
  };

  const isMasterAdmin = user?.role === "chatapp.master_admin";

  // Note: These now only check if user is master_admin (god mode)
  // For company-specific permission checks, use useCompanyContext hook
  const isCompanyAdmin = user?.role === "chatapp.master_admin";
  const isSupportAgent = user?.role === "chatapp.master_admin";

  const refreshSession = async () => {
    await updateRef.current();
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    login,
    loginWithGoogle,
    loginWithGitHub,
    logout,
    hasRole,
    isMasterAdmin,
    isCompanyAdmin,
    isSupportAgent,
    refreshSession,
  };
}

function getDashboardUrl(role?: UserRole): string {
  switch (role) {
    case "chatapp.master_admin":
      return "/admin/dashboard";
    case "chatapp.user":
      return "/companies"; // Users go to company selection first
    default:
      return "/companies";
  }
}
