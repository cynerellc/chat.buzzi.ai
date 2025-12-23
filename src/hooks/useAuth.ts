"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { UserRole } from "@/lib/auth/config";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  companyId: string | null;
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
      companyId: session.user.companyId ?? null,
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
        callbackUrl: callbackUrl ?? getDashboardUrl(user?.role),
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.url) {
        router.push(result.url);
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

  const hasRole = useCallback(
    (role: UserRole): boolean => {
      if (!user) return false;

      const roleHierarchy: Record<UserRole, number> = {
        master_admin: 3,
        company_admin: 2,
        support_agent: 1,
      };

      return roleHierarchy[user.role] >= roleHierarchy[role];
    },
    [user]
  );

  const isMasterAdmin = useMemo(() => user?.role === "master_admin", [user]);
  const isCompanyAdmin = useMemo(
    () => user?.role === "company_admin" || user?.role === "master_admin",
    [user]
  );
  const isSupportAgent = useMemo(
    () => ["master_admin", "company_admin", "support_agent"].includes(user?.role ?? ""),
    [user]
  );

  const belongsToCompany = useCallback(
    (companyId: string): boolean => {
      if (!user) return false;
      if (user.role === "master_admin") return true;
      return user.companyId === companyId;
    },
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
    belongsToCompany,
    refreshSession,
  };
}

function getDashboardUrl(role?: UserRole): string {
  switch (role) {
    case "master_admin":
      return "/admin/dashboard";
    case "company_admin":
      return "/dashboard";
    case "support_agent":
      return "/inbox";
    default:
      return "/dashboard";
  }
}
