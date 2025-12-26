"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { UserRole } from "@/lib/auth/role-utils";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
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
      image: session.user.image ?? null,
      role: session.user.role,
    };
  }, [session]);

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!user;

  const login = useCallback(
    async (email: string, password: string, callbackUrl?: string) => {
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
        router.push(callbackUrl);
        return result;
      }

      // Otherwise, get smart redirect from API
      try {
        const redirectResponse = await fetch("/api/auth/redirect");
        if (redirectResponse.ok) {
          const { redirectUrl } = await redirectResponse.json();
          router.push(redirectUrl);
        } else {
          // Fallback to basic redirect
          router.push(getDashboardUrl(user?.role));
        }
      } catch {
        // Fallback to basic redirect
        router.push(getDashboardUrl(user?.role));
      }

      return result;
    },
    [router, user?.role]
  );

  const loginWithGoogle = useCallback(
    async (callbackUrl?: string) => {
      await signIn("google", {
        callbackUrl: callbackUrl ?? getDashboardUrl(user?.role),
      });
    },
    [user?.role]
  );

  const loginWithGitHub = useCallback(
    async (callbackUrl?: string) => {
      await signIn("github", {
        callbackUrl: callbackUrl ?? getDashboardUrl(user?.role),
      });
    },
    [user?.role]
  );

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  // Check if user has the required base role
  // Note: company-specific permissions (company_admin, support_agent) are checked via company context
  const hasRole = useCallback(
    (role: UserRole): boolean => {
      if (!user) return false;

      const roleHierarchy: Record<UserRole, number> = {
        "chatapp.master_admin": 2,
        "chatapp.user": 1,
      };

      return roleHierarchy[user.role] >= roleHierarchy[role];
    },
    [user]
  );

  const isMasterAdmin = useMemo(() => user?.role === "chatapp.master_admin", [user]);

  // Note: These now only check if user is master_admin (god mode)
  // For company-specific permission checks, use useCompanyContext hook
  const isCompanyAdmin = useMemo(
    () => user?.role === "chatapp.master_admin",
    [user]
  );
  const isSupportAgent = useMemo(
    () => user?.role === "chatapp.master_admin",
    [user]
  );

  const refreshSession = useCallback(async () => {
    await update();
  }, [update]);

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
